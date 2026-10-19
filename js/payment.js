async function submitManualPayment(event) {
  event.preventDefault();
  const status = document.getElementById("payment-request-status");
  const button = event.target.querySelector('button[type="submit"]');
  const reference = document.getElementById("payment-reference").value.trim();
  if (!reference) return false;
  try {
    if (!window.sbClient && typeof initSupabase === "function") initSupabase();
    if (!window.sbClient) throw new Error("Connexion Supabase indisponible.");
    const { data: { user }, error: authError } = await sbClient.auth.getUser();
    if (authError || !user) throw new Error("Connectez-vous avant d'envoyer votre demande.");
    button.disabled = true;
    status.textContent = "Enregistrement de la demande…";
    const { error } = await sbClient.from("payment_requests").insert({
      user_id: user.id,
      email: user.email,
      full_name: state.userName || user.user_metadata?.name || "",
      amount_xof: 20000,
      payment_method: "Wave",
      transaction_reference: reference
    });
    if (error) {
      if (error.code === "23505") throw new Error("Cette demande existe déjà.");
      throw new Error(error.message || "Impossible d’enregistrer la demande.");
    }
    status.textContent = "Demande enregistrée. L’administrateur vérifiera votre preuve Wave avant d’activer les modules.";
    event.target.reset();
  } catch (error) {
    status.textContent = error.message || "Erreur lors de l’envoi.";
  } finally {
    button.disabled = false;
  }
  return false;
}
