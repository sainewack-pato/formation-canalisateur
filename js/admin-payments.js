// File de validation Wave : section présente dans admin.html, pour éviter les problèmes de montage dynamique.
(function () {
  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  async function invoke(action, extra = {}) {
    if (typeof sbClient === "undefined" || !sbClient) throw new Error("Connexion Supabase indisponible. Reconnectez-vous.");
    const { data, error } = await sbClient.functions.invoke("manage-payment-requests", { body: { action, ...extra } });
    if (error) throw new Error(error.message || "Erreur serveur");
    if (data?.error) throw new Error(data.error);
    return data;
  }
  async function load() {
    const body = document.getElementById("payment-queue-body");
    const message = document.getElementById("payment-queue-message");
    if (!body || !message) return;
    body.innerHTML = '<tr><td colspan="6">Chargement…</td></tr>';
    message.textContent = "";
    try {
      const data = await invoke("list");
      if (!data.requests?.length) { body.innerHTML = '<tr><td colspan="6">Aucune demande de paiement en attente.</td></tr>'; return; }
      body.innerHTML = data.requests.map(p => '<tr><td>'+esc(p.full_name)+'</td><td>'+esc(p.email)+'</td><td>'+esc(p.transaction_reference)+'</td><td>'+esc(p.amount_xof)+' FCFA</td><td>'+esc(p.submitted_at ? new Date(p.submitted_at).toLocaleString("fr-FR") : "—")+'</td><td><button class="btn-unlock" data-action="approve" data-id="'+esc(p.id)+'">Valider</button> <button class="btn-lock" data-action="reject" data-id="'+esc(p.id)+'">Refuser</button></td></tr>').join("");
      body.querySelectorAll("button[data-id]").forEach(btn => btn.addEventListener("click", async () => {
        const action = btn.dataset.action;
        if (!confirm(action === "approve" ? "Confirmer le paiement réel et ouvrir les modules 2 à 8 ?" : "Refuser cette demande de paiement ?")) return;
        btn.disabled = true;
        try { await invoke(action, {id:btn.dataset.id}); message.textContent = action === "approve" ? "Paiement validé, accès accordé." : "Demande refusée."; await load(); }
        catch (e) { message.textContent = e.message || "Erreur"; btn.disabled = false; }
      }));
    } catch (e) {
      body.innerHTML = '<tr><td colspan="6">Impossible de charger les demandes.</td></tr>';
      message.textContent = e.message || "Vérifiez que manage-payment-requests est déployée.";
    }
  }
  document.addEventListener("DOMContentLoaded", () => {
    const button = document.getElementById("refresh-payment-queue");
    if (button) button.addEventListener("click", load);
  });
  window.loadPaymentRequests = load;
})();