// ========== Formation Canalisateur – Auth & progression Supabase ==========

const TOTAL_MODULES = 8;
const QUIZ_PASS = 12;
const QUIZ_TOTAL = 15;
const MODULE_QUIZ_PASS = 3;
const MODULE_QUIZ_TOTAL = 5;

let state = {
  completedModules: [],
  bestScore: 0,
  userName: "",
  email: "",
  userId: null,
  isAdmin: false,
  currentQuiz: null,
  currentQ: 0,
  selectedAnswer: null,
  score: 0,
  moduleQuizId: null,
  moduleQuiz: null,
  moduleQ: 0,
  moduleScore: 0,
  moduleSelected: null
};

// ---------- Supabase helpers ----------
async function ensureSupabase() {
  if (sbClient) return true;
  if (initSupabase()) return true;
  for (let i = 0; i < 15; i++) {
    await new Promise(r => setTimeout(r, 200));
    if (initSupabase()) return true;
  }
  throw new Error("SDK Supabase non chargé. Vérifiez votre connexion internet.");
}

async function getSessionUser() {
  await ensureSupabase();
  const { data: { session } } = await sbClient.auth.getSession();
  return session ? session.user : null;
}

async function loadProgressFromCloud(userId) {
  const { data, error } = await sbClient
    .from("progressions")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.warn("loadProgress:", error.message);
    return null;
  }
  return data;
}

async function saveProgressToCloud() {
  if (!state.userId) return;
  const payload = {
    user_id: state.userId,
    email: state.email,
    user_name: state.userName,
    completed_modules: state.completedModules,
    best_score: state.bestScore,
    updated_at: new Date().toISOString()
  };

  const { error } = await sbClient
    .from("progressions")
    .upsert(payload, { onConflict: "user_id" });

  if (error) console.warn("saveProgress:", error.message);
}

async function ensureProgressRow(user) {
  const existing = await loadProgressFromCloud(user.id);
  if (existing) {
    state.completedModules = existing.completed_modules || [];
    state.bestScore = existing.best_score || 0;
    state.userName = existing.user_name || user.user_metadata?.name || "";
    state.isAdmin = !!existing.is_admin;
    state.email = existing.email || user.email;
    return;
  }
  // Create row
  const name = user.user_metadata?.name || state.userName || "";
  const { error } = await sbClient.from("progressions").insert({
    user_id: user.id,
    email: user.email,
    user_name: name,
    completed_modules: [],
    best_score: 0
  });
  if (error) console.warn("insert progress:", error.message);
  state.userName = name;
  state.email = user.email;
  state.completedModules = [];
  state.bestScore = 0;
  state.isAdmin = false;
}

// ---------- Auth UI ----------
function switchAuthTab(tab) {
  document.querySelectorAll(".auth-tab").forEach(t => {
    t.classList.toggle("active", t.dataset.tab === tab);
  });
  const tabs = document.querySelector(".auth-tabs");
  if (tabs) tabs.style.display = tab === "forgot" ? "none" : "flex";

  const login = document.getElementById("form-login");
  const reg = document.getElementById("form-register");
  const forgot = document.getElementById("form-forgot");
  const success = document.getElementById("auth-success");

  if (login) login.classList.toggle("hidden", tab !== "login");
  if (reg) reg.classList.toggle("hidden", tab !== "register");
  if (forgot) forgot.classList.toggle("hidden", tab !== "forgot");
  if (success) success.classList.add("hidden");

  ["login-error", "register-error", "forgot-error"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.add("hidden");
  });
}

function showSuccess(title, message, thenLogin) {
  document.getElementById("form-login")?.classList.add("hidden");
  document.getElementById("form-register")?.classList.add("hidden");
  document.getElementById("form-forgot")?.classList.add("hidden");
  const tabs = document.querySelector(".auth-tabs");
  if (tabs) tabs.style.display = "none";

  const box = document.getElementById("auth-success");
  document.getElementById("success-title").textContent = title;
  document.getElementById("success-message").textContent = message;
  box.classList.remove("hidden");
  box.dataset.thenLogin = thenLogin ? "1" : "0";
}

async function afterSuccess() {
  const box = document.getElementById("auth-success");
  const thenLogin = box.dataset.thenLogin === "1";
  box.classList.add("hidden");
  const tabs = document.querySelector(".auth-tabs");
  if (tabs) tabs.style.display = "flex";

  if (thenLogin) {
    switchAuthTab("login");
  } else {
    const user = await getSessionUser();
    if (user) {
      state.userId = user.id;
      await ensureProgressRow(user);
      enterApp();
    } else {
      switchAuthTab("login");
    }
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const errEl = document.getElementById("register-error");
  const btn = e.target.querySelector('button[type="submit"]');
  const resetBtn = () => {
    if (btn) { btn.disabled = false; btn.textContent = "Créer mon compte"; }
  };

  try {
    await ensureSupabase();

    const name = document.getElementById("reg-name").value.trim();
    const email = document.getElementById("reg-email").value.trim().toLowerCase();
    const password = document.getElementById("reg-password").value;
    const password2 = document.getElementById("reg-password2").value;

    if (!name || !email || !password) {
      errEl.textContent = "Veuillez remplir tous les champs.";
      errEl.classList.remove("hidden");
      return false;
    }
    if (password !== password2) {
      errEl.textContent = "Les mots de passe ne correspondent pas.";
      errEl.classList.remove("hidden");
      return false;
    }
    if (password.length < 6) {
      errEl.textContent = "Le mot de passe doit contenir au moins 6 caractères.";
      errEl.classList.remove("hidden");
      return false;
    }

    errEl.classList.add("hidden");
    if (btn) { btn.disabled = true; btn.textContent = "Création..."; }

    const { data, error } = await sbClient.auth.signUp({
      email,
      password,
      options: { data: { name } }
    });

    if (error) {
      resetBtn();
      const msg = (error.message || "").toLowerCase();
      if (msg.includes("already") || msg.includes("registered")) {
        errEl.textContent = "Un compte existe déjà avec cet email. Connectez-vous.";
      } else if (msg.includes("invalid") && msg.includes("email")) {
        errEl.textContent = "Adresse email invalide.";
      } else {
        errEl.textContent = error.message || "Erreur lors de la création du compte.";
      }
      errEl.classList.remove("hidden");
      return false;
    }

    state.userName = name;
    state.email = email;

    if (data.session && data.user) {
      state.userId = data.user.id;
      try {
        await ensureProgressRow(data.user);
      } catch (pe) {
        console.warn("Progress row:", pe);
      }
      resetBtn();
      showSuccess(
        "Compte créé avec succès !",
        "Bienvenue " + name + ". Cliquez sur Continuer pour accéder à la formation.",
        false
      );
    } else {
      resetBtn();
      showSuccess(
        "Compte créé avec succès !",
        "Vous pouvez maintenant vous connecter avec votre email et mot de passe." +
        (data.user && !data.session ? " (Si demandé, confirmez d'abord votre email.)" : ""),
        true
      );
    }
  } catch (err) {
    console.error(err);
    resetBtn();
    errEl.textContent = (err && err.message) ? err.message : "Erreur réseau ou technique. Vérifiez votre connexion et réessayez.";
    errEl.classList.remove("hidden");
  }
  return false;
}

async function handleLogin(e) {
  e.preventDefault();
  const errEl = document.getElementById("login-error");
  const btn = e.target.querySelector('button[type="submit"]');
  const resetBtn = () => {
    if (btn) { btn.disabled = false; btn.textContent = "Se connecter"; }
  };

  try {
    await ensureSupabase();
    const email = document.getElementById("login-email").value.trim().toLowerCase();
    const password = document.getElementById("login-password").value;
    errEl.classList.add("hidden");
    if (btn) { btn.disabled = true; btn.textContent = "Connexion..."; }

    const { data, error } = await sbClient.auth.signInWithPassword({ email, password });

    if (error) {
      resetBtn();
      const msg = (error.message || "").toLowerCase();
      if (msg.includes("confirm")) {
        errEl.textContent = "Email non confirmé. Désactivez Confirm email dans Supabase Auth, ou confirmez l'utilisateur.";
      } else {
        errEl.textContent = "Email ou mot de passe incorrect.";
      }
      errEl.classList.remove("hidden");
      return false;
    }

    state.userId = data.user.id;
    state.email = data.user.email;
    try {
      await ensureProgressRow(data.user);
    } catch (pe) {
      console.warn("Progress row:", pe);
    }
    resetBtn();
    enterApp();
  } catch (err) {
    console.error(err);
    resetBtn();
    errEl.textContent = "Erreur réseau. Vérifiez votre connexion.";
    errEl.classList.remove("hidden");
  }
  return false;
}

async function handleForgot(e) {
  e.preventDefault();
  await ensureSupabase();

  const email = document.getElementById("forgot-email").value.trim().toLowerCase();
  const errEl = document.getElementById("forgot-error");
  // For Supabase we use reset password email, ignore new password fields for cloud flow
  const password = document.getElementById("forgot-password")?.value;

  errEl.classList.add("hidden");

  // Send reset email via Supabase
  const { error } = await sbClient.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + window.location.pathname
  });

  if (error) {
    errEl.textContent = error.message;
    errEl.classList.remove("hidden");
    return false;
  }

  showSuccess(
    "Email envoyé !",
    "Si un compte existe avec cet email, vous recevrez un lien pour réinitialiser votre mot de passe.",
    true
  );
  return false;
}

async function handleLogout() {
  if (!confirm("Voulez-vous vous déconnecter ?")) return;
  await saveProgressToCloud();
  await ensureSupabase();
  await sbClient.auth.signOut();
  state = {
    completedModules: [], bestScore: 0, userName: "", email: "", userId: null, isAdmin: false,
    currentQuiz: null, currentQ: 0, selectedAnswer: null, score: 0,
    moduleQuizId: null, moduleQuiz: null, moduleQ: 0, moduleScore: 0, moduleSelected: null
  };
  showScreen("auth");
  document.getElementById("form-login")?.reset();
  document.getElementById("form-register")?.reset();
  switchAuthTab("login");
}

function enterApp() {
  const nameEl = document.getElementById("user-display-name");
  if (nameEl) nameEl.textContent = state.userName || state.email || "Apprenant";
  const adminLink = document.getElementById("admin-link");
  if (adminLink) {
    adminLink.classList.toggle("hidden", !state.isAdmin);
  }
  showScreen("home");
  updateHomeProgress();
}

// ---------- Navigation ----------
function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.getElementById(id)?.classList.add("active");

  const nav = document.getElementById("bottom-nav");
  if (id === "auth" || id === "module-detail") {
    nav?.classList.add("hidden");
  } else {
    nav?.classList.remove("hidden");
  }

  document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.screen === id);
  });

  if (id === "home") updateHomeProgress();
  if (id === "modules") renderModules();
  if (id === "quiz") resetQuizUI();
  if (id === "attestation") updateAttestationScreen();
}

document.querySelectorAll(".nav-btn").forEach(btn => {
  btn.addEventListener("click", async () => {
    const user = await getSessionUser();
    if (!user) { showScreen("auth"); return; }
    showScreen(btn.dataset.screen);
  });
});

function updateHomeProgress() {
  const done = state.completedModules.length;
  const pct = Math.round((done / TOTAL_MODULES) * 100);
  const bar = document.getElementById("global-progress");
  const text = document.getElementById("progress-text");
  if (bar) bar.style.width = pct + "%";
  if (text) text.textContent = pct + " % complété (" + done + "/" + TOTAL_MODULES + " modules)";

  const teaser = document.getElementById("attestation-teaser");
  if (teaser) teaser.style.display = isFormationComplete() ? "block" : "none";

  const nameEl = document.getElementById("user-display-name");
  if (nameEl) nameEl.textContent = state.userName || state.email || "Apprenant";

  const adminLink = document.getElementById("admin-link");
  if (adminLink) adminLink.classList.toggle("hidden", !state.isAdmin);
}

function isFormationComplete() {
  return state.completedModules.length >= TOTAL_MODULES && state.bestScore >= QUIZ_PASS;
}

// Prototype d'interface uniquement : ne constitue pas une protection serveur.
const LEGACY_FULL_ACCESS_USERS = [
  "17a6bd12-5019-4b0f-8d96-caa2b02c8d37",
  "b376b5ec-623e-49f7-b120-2d59e3dce043",
  "3f73090d-921d-4e55-8462-9d4005046b77"
];

function hasFullTrainingAccessForPrototype() {
  return !!state.isAdmin || LEGACY_FULL_ACCESS_USERS.includes(state.userId);
}

function renderModules() {
  const container = document.getElementById("modules-list");
  if (!container) return;
  const fullAccess = hasFullTrainingAccessForPrototype();
  container.innerHTML = MODULES.map((m, index) => {
    const done = state.completedModules.includes(m.id);
    const isFree = index === 0;
    const locked = !isFree && !fullAccess;
    const clickAction = locked ? "showPaymentLock()" : "openModule(\'" + m.id + "\')";
    return `
      <div class="card module-card" onclick="${clickAction}">
        <div class="module-icon">${locked ? "🔒" : m.icon}</div>
        <div class="module-info">
          <h3>${m.title}</h3>
          <p>${locked ? "Accès après validation du paiement" : m.short}</p>
        </div>
        <span class="module-status ${locked ? "todo" : done ? "" : "todo"}">${locked ? "Verrouillé" : done ? "Validé" : isFree ? "Gratuit" : "À faire"}</span>
      </div>`;
  }).join("");
}

function showPaymentLock() {
  const container = document.getElementById("module-content");
  if (!container) return;
  document.getElementById("module-title").textContent = "Accès aux modules payants";
  container.innerHTML = `
    <div class="card" style="margin-top:1rem">
      <h3>🔒 Modules 2 à 8 réservés aux apprenants autorisés</h3>
      <p>Tarif de la formation complète : <strong>20 000 FCFA</strong>.</p>
      <p>Effectuez le paiement par Wave, puis envoyez votre preuve par WhatsApp. GIE I2DS vérifiera le paiement manuellement avant d'autoriser l'accès.</p>
      <a class="btn-primary full" style="display:block;text-align:center;text-decoration:none;margin-top:1rem" href="https://pay.wave.com/m/M_sn_cyRERGTCj1dt/c/sn/" target="_blank" rel="noopener">Payer avec Wave</a>
      <a class="btn-secondary full" style="display:block;text-align:center;text-decoration:none;margin-top:.5rem" href="https://wa.me/221775232762" target="_blank" rel="noopener">Envoyer la preuve par WhatsApp</a>
      <p style="font-size:.85rem;margin-top:1rem">Cette version est un prototype d'interface. L'accès réel ne sera sécurisé qu'après déplacement des contenus payants vers un stockage protégé et vérification côté serveur.</p>
      <button class="btn-secondary full" style="margin-top:.5rem" onclick="showScreen('modules')">Retour aux modules</button>
    </div>`;
  showScreen("module-detail");
}

function openModule(id) {
  const mod = MODULES.find(m => m.id === id);
  if (!mod) return;
  if (MODULES.indexOf(mod) > 0 && !hasFullTrainingAccessForPrototype()) {
    showPaymentLock();
    return;
  }
  document.getElementById("module-title").textContent = mod.title;
  const content = document.getElementById("module-content");
  const done = state.completedModules.includes(id);

  let html = mod.content.map(section => `
    <div class="lesson-section">
      <h3>${section.title}</h3>
      ${section.html}
    </div>`).join("");

  html += `
    <div class="card" style="margin-top:1.25rem; border-left:4px solid var(--primary);">
      <h3 style="color:var(--primary); margin-bottom:0.5rem;">📝 Quiz du module (5 questions)</h3>
      <p style="font-size:0.9rem; color:var(--text-light); margin-bottom:0.75rem;">
        Score minimum : <strong>${MODULE_QUIZ_PASS}/${MODULE_QUIZ_TOTAL}</strong>
      </p>
      <div id="module-quiz-area">
        ${done
          ? `<p style="color:var(--success); font-weight:600;">✓ Module déjà validé</p>
             <button class="btn-secondary full" onclick="startModuleQuiz('${id}')">Repasser le quiz</button>`
          : `<button class="btn-primary full" onclick="startModuleQuiz('${id}')">Lancer le quiz du module</button>`}
      </div>
    </div>`;
  content.innerHTML = html;
  showScreen("module-detail");
}

function startModuleQuiz(id) {
  const mod = MODULES.find(m => m.id === id);
  if (!mod?.quiz) return;
  state.moduleQuizId = id;
  state.moduleQuiz = [...mod.quiz];
  state.moduleQ = 0;
  state.moduleScore = 0;
  state.moduleSelected = null;
  renderModuleQuestion();
}

function renderModuleQuestion() {
  const area = document.getElementById("module-quiz-area");
  if (!area) return;
  const q = state.moduleQuiz[state.moduleQ];
  const num = state.moduleQ + 1;
  area.innerHTML = `
    <div class="quiz-progress">
      <span>Question ${num}/${MODULE_QUIZ_TOTAL}</span>
      <div class="progress-bar small">
        <div class="progress-fill" style="width:${(num / MODULE_QUIZ_TOTAL) * 100}%"></div>
      </div>
    </div>
    <h3 style="font-size:1rem; margin:0.75rem 0;">${q.q}</h3>
    <div class="answers" id="module-answers">
      ${q.answers.map((a, i) => `<button class="answer-btn" onclick="selectModuleAnswer(${i})">${a}</button>`).join("")}
    </div>
    <button id="module-next" class="btn-primary full hidden" style="margin-top:0.75rem;" onclick="nextModuleQuestion()">
      ${num === MODULE_QUIZ_TOTAL ? "Voir le résultat" : "Question suivante"}
    </button>`;
}

function selectModuleAnswer(index) {
  if (state.moduleSelected !== null) return;
  state.moduleSelected = index;
  const q = state.moduleQuiz[state.moduleQ];
  document.querySelectorAll("#module-answers .answer-btn").forEach((btn, i) => {
    btn.disabled = true;
    if (i === q.correct) btn.classList.add("correct");
    if (i === index && index !== q.correct) btn.classList.add("wrong");
    if (i === index) btn.classList.add("selected");
  });
  if (index === q.correct) state.moduleScore++;
  document.getElementById("module-next")?.classList.remove("hidden");
}

function nextModuleQuestion() {
  if (state.moduleQ < MODULE_QUIZ_TOTAL - 1) {
    state.moduleQ++;
    state.moduleSelected = null;
    renderModuleQuestion();
  } else {
    finishModuleQuiz();
  }
}

async function finishModuleQuiz() {
  const area = document.getElementById("module-quiz-area");
  const score = state.moduleScore;
  const passed = score >= MODULE_QUIZ_PASS;
  const id = state.moduleQuizId;

  if (passed && !state.completedModules.includes(id)) {
    state.completedModules.push(id);
    await saveProgressToCloud();
    updateHomeProgress();
  }

  area.innerHTML = `
    <div style="text-align:center; padding:0.5rem 0;">
      <h3 style="color:${passed ? "var(--success)" : "var(--danger)"}; margin-bottom:0.5rem;">
        ${passed ? "✓ Module validé !" : "Score insuffisant"}
      </h3>
      <p style="font-size:1.2rem; font-weight:700;">${score} / ${MODULE_QUIZ_TOTAL}</p>
      <p style="font-size:0.9rem; color:var(--text-light); margin:0.5rem 0 1rem;">
        ${passed ? "Bravo, passez au module suivant." : `Minimum ${MODULE_QUIZ_PASS}/${MODULE_QUIZ_TOTAL}. Réessayez.`}
      </p>
      <button class="btn-primary full" onclick="startModuleQuiz('${id}')">Recommencer</button>
      <button class="btn-secondary full" onclick="showScreen('modules')" style="margin-top:0.5rem;">Retour aux modules</button>
    </div>`;
}

// ---------- Quiz global ----------
function resetQuizUI() {
  document.getElementById("quiz-start")?.classList.remove("hidden");
  document.getElementById("quiz-area")?.classList.add("hidden");
  document.getElementById("quiz-result")?.classList.add("hidden");
}

function startQuiz() {
  state.currentQuiz = [...QUIZ_QUESTIONS].sort(() => Math.random() - 0.5).slice(0, QUIZ_TOTAL);
  state.currentQ = 0;
  state.score = 0;
  state.selectedAnswer = null;
  document.getElementById("quiz-start")?.classList.add("hidden");
  document.getElementById("quiz-result")?.classList.add("hidden");
  document.getElementById("quiz-area")?.classList.remove("hidden");
  showQuestion();
}

function showQuestion() {
  const q = state.currentQuiz[state.currentQ];
  document.getElementById("q-num").textContent = `Question ${state.currentQ + 1}/${QUIZ_TOTAL}`;
  document.getElementById("q-progress").style.width = ((state.currentQ + 1) / QUIZ_TOTAL * 100) + "%";
  document.getElementById("question-text").textContent = q.q;
  document.getElementById("answers").innerHTML = q.answers.map((a, i) =>
    `<button class="answer-btn" onclick="selectAnswer(${i})">${a}</button>`
  ).join("");
  document.getElementById("next-q")?.classList.add("hidden");
  state.selectedAnswer = null;
}

function selectAnswer(index) {
  if (state.selectedAnswer !== null) return;
  state.selectedAnswer = index;
  const q = state.currentQuiz[state.currentQ];
  document.querySelectorAll("#answers .answer-btn").forEach((btn, i) => {
    btn.disabled = true;
    if (i === q.correct) btn.classList.add("correct");
    if (i === index && index !== q.correct) btn.classList.add("wrong");
    if (i === index) btn.classList.add("selected");
  });
  if (index === q.correct) state.score++;
  const nextBtn = document.getElementById("next-q");
  nextBtn?.classList.remove("hidden");
  if (nextBtn) nextBtn.textContent = state.currentQ === QUIZ_TOTAL - 1 ? "Voir le résultat" : "Question suivante";
}

function nextQuestion() {
  if (state.currentQ < QUIZ_TOTAL - 1) {
    state.currentQ++;
    showQuestion();
  } else {
    finishQuiz();
  }
}

async function finishQuiz() {
  document.getElementById("quiz-area")?.classList.add("hidden");
  document.getElementById("quiz-result")?.classList.remove("hidden");
  const score = state.score;
  let title, message;
  if (score >= 13) { title = "Excellent !"; message = "Très bonne maîtrise."; }
  else if (score >= QUIZ_PASS) { title = "Bravo, validé !"; message = "Score suffisant pour l'attestation."; }
  else { title = "À retravailler"; message = "Minimum 12/15. Réessayez."; }

  document.getElementById("result-title").textContent = title;
  document.getElementById("result-score").textContent = `Vous avez obtenu ${score} / ${QUIZ_TOTAL}`;
  document.getElementById("result-message").textContent = message;

  if (score > state.bestScore) {
    state.bestScore = score;
    await saveProgressToCloud();
  }
  updateHomeProgress();
}

function resetQuiz() { resetQuizUI(); }

// ---------- Attestation ----------
function updateAttestationScreen() {
  const locked = document.getElementById("attestation-locked");
  const ready = document.getElementById("attestation-ready");
  const status = document.getElementById("attestation-status");
  const modulesOk = state.completedModules.length >= TOTAL_MODULES;
  const quizOk = state.bestScore >= QUIZ_PASS;

  if (modulesOk && quizOk) {
    locked?.classList.add("hidden");
    ready?.classList.remove("hidden");
    const name = state.userName || "";
    const nameInput = document.getElementById("user-name");
    if (nameInput) nameInput.value = name;
    document.getElementById("cert-score").textContent = state.bestScore + " / " + QUIZ_TOTAL;
    document.getElementById("cert-date").textContent = new Date().toLocaleDateString("fr-FR", {
      day: "numeric", month: "long", year: "numeric"
    });
    if (name) document.getElementById("cert-name").textContent = name;
  } else {
    locked?.classList.remove("hidden");
    ready?.classList.add("hidden");
    let msg = modulesOk
      ? "✓ 8 modules validés<br>"
      : `✗ Modules : ${state.completedModules.length}/${TOTAL_MODULES}<br>`;
    msg += quizOk
      ? `✓ Quiz final : ${state.bestScore}/15`
      : `✗ Quiz final : ${state.bestScore}/15 (min. 12)`;
    if (status) status.innerHTML = msg;
  }
}

async function generateCertificate() {
  const name = document.getElementById("user-name").value.trim();
  if (!name) { alert("Veuillez saisir votre prénom et nom."); return; }
  state.userName = name;
  await saveProgressToCloud();
  document.getElementById("cert-name").textContent = name;
  document.getElementById("cert-score").textContent = state.bestScore + " / " + QUIZ_TOTAL;
  document.getElementById("cert-date").textContent = new Date().toLocaleDateString("fr-FR", {
    day: "numeric", month: "long", year: "numeric"
  });
}

// ---------- Init ----------
(async function init() {
  await ensureSupabase();
  const { data: { session } } = await sbClient.auth.getSession();
  if (session?.user) {
    state.userId = session.user.id;
    state.email = session.user.email;
    await ensureProgressRow(session.user);
    enterApp();
  } else {
    showScreen("auth");
  }
})();
