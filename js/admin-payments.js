// Ajoute une file de validation Wave au tableau administrateur existant.
(function () {
  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  function mountPaymentQueue() {
    const dash = document.getElementById("admin-dash");
    if (!dash || document.getElementById("payment-queue")) return;
    const section = document.createElement("section");
    section.id = "payment-queue";
    section.className = "card";
    section.innerHTML = '<h2 style="margin-bottom:1rem">Validation des paiements Wave</h2><p style="margin-bottom:1rem">Vérifiez la preuve reçue sur WhatsApp avant de valider.</p><button class="btn btn-sm" id="refresh-payment-queue" type="button">Actualiser les demandes</button><p id="payment-queue-message" style="margin:.75rem 0"></p><div style="overflow-x:auto"><table><thead><tr><th>Apprenant</th><th>Email</th><th>Référence Wave</th><th>Montant</th><th>Date</th><th>Décision</th></tr></thead><tbody id="payment-queue-body"><tr><td colspan="6">Cliquez sur Actualiser.</td></tr></tbody></table></div>';
    dash.appendChild(section);
    section.querySelector("#refresh-payment-queue").addEventListener("click", load);
  }
  async function invoke(action, extra={}) {
    const { data, error } = await sbClient.functions.invoke("manage-payment-requests", { body: { action, ...extra } });
    if (error) throw new Error(error.message || "Erreur serveur");
    if (data?.error) throw new Error(data.error);
    return data;
  }
  async function load() {
    const body = document.getElementById("payment-queue-body");
    const message = document.getElementById("payment-queue-message");
    body.innerHTML = '<tr><td colspan="6">Chargement…</td></tr>';
    message.textContent = "";
    try {
      const data = await invoke("list");
      if (!data.requests?.length) { body.innerHTML = '<tr><td colspan="6">Aucune demande en attente.</td></tr>'; return; }
      body.innerHTML = data.requests.map(p => '<tr><td>'+esc(p.full_name)+'</td><td>'+esc(p.email)+'</td><td>'+esc(p.transaction_reference)+'</td><td>'+esc(p.amount_xof)+' FCFA</td><td>'+esc(new Date(p.submitted_at).toLocaleString("fr-FR"))+'</td><td><button class="btn-unlock" data-action="approve" data-id="'+esc(p.id)+'">Valider</button> <button class="btn-lock" data-action="reject" data-id="'+esc(p.id)+'">Refuser</button></td></tr>').join("");
      body.querySelectorAll("button[data-id]").forEach(btn => btn.addEventListener("click", async () => {
        const action = btn.dataset.action;
        if (!confirm((action === "approve" ? "Confirmer le paiement et ouvrir les modules 2 à 8 ?" : "Refuser cette demande de paiement ?"))) return;
        btn.disabled = true;
        try {
          await invoke(action, {id:btn.dataset.id});
          message.textContent = action === "approve" ? "Paiement validé, accès accordé." : "Demande refusée.";
          await load();
        } catch (e) { message.textContent = e.message || "Erreur"; btn.disabled = false; }
      }));
    } catch (e) {
      body.innerHTML = '<tr><td colspan="6">Impossible de charger les demandes.</td></tr>';
      message.textContent = e.message || "Vérifiez le déploiement de manage-payment-requests.";
    }
  }
  const oldShowDash = window.showDash;
  window.showDash = function () { if (oldShowDash) oldShowDash(); mountPaymentQueue(); };
  document.addEventListener("DOMContentLoaded", mountPaymentQueue);
})();
