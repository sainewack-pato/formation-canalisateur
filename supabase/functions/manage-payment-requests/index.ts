// Secure admin queue for manual Wave payment validation.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (body, status=200) => new Response(JSON.stringify(body), {
  status, headers: { ...cors, "Content-Type": "application/json" }
});
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", {headers:cors});
  if (req.method !== "POST") return reply({error:"Method not allowed"},405);
  const url=Deno.env.get("SUPABASE_URL"), anon=Deno.env.get("SUPABASE_ANON_KEY"), service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anon || !service) return reply({error:"Configuration serveur incomplète"},500);
  const token=(req.headers.get("Authorization")||"").replace(/^Bearer\s+/i,"");
  if (!token) return reply({error:"Connexion requise"},401);
  const userClient=createClient(url,anon,{global:{headers:{Authorization:"Bearer "+token}},auth:{persistSession:false,autoRefreshToken:false}});
  const {data:{user},error:authErr}=await userClient.auth.getUser(token);
  if (authErr || !user) return reply({error:"Session invalide"},401);
  const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:profile,error:profileErr}=await admin.from("learner_progress").select("is_admin").eq("user_id",user.id).maybeSingle();
  if (profileErr || !profile?.is_admin) return reply({error:"Accès administrateur refusé"},403);
  let body;
  try { body=await req.json(); } catch { return reply({error:"Requête invalide"},400); }
  if (body.action==="list") {
    const {data,error}=await admin.from("payment_requests").select("id,user_id,email,full_name,amount_xof,payment_method,transaction_reference,status,submitted_at,admin_note").eq("status","pending").order("submitted_at",{ascending:true});
    if (error) return reply({error:"Lecture impossible"},500);
    return reply({requests:data||[]});
  }
  if (!["approve","reject"].includes(body.action) || typeof body.id!=="string") return reply({error:"Action invalide"},400);
  const {data:request,error:requestErr}=await admin.from("payment_requests").select("*").eq("id",body.id).eq("status","pending").maybeSingle();
  if (requestErr || !request) return reply({error:"Demande introuvable ou déjà traitée"},404);
  if (body.action==="approve") {
    const {error:grantErr}=await admin.from("module_access").upsert({user_id:request.user_id,granted_by:user.email||user.id,note:"Paiement Wave validé manuellement; demande "+request.id},{onConflict:"user_id"});
    if (grantErr) return reply({error:"Accès non accordé"},500);
    const paidAt = new Date().toISOString();
    // Synchroniser le statut global lu par le tableau de bord apprenant.
    const {error:legacyProgressErr}=await admin.from("learner_progress")
      .update({is_paid:true,paid_at:paidAt,updated_at:paidAt})
      .eq("user_id",request.user_id);
    if (legacyProgressErr) return reply({error:"Accès accordé mais statut de paiement non actualisé"},500);
    // Garder aussi le statut historique, sans dépendre du nombre de lignes par module.
    const {error:progressErr}=await admin.from("progressions")
      .update({is_paid:true,paid_at:paidAt,updated_at:paidAt})
      .eq("user_id",request.user_id);
    if (progressErr) return reply({error:"Accès accordé mais statut de paiement secondaire non actualisé"},500);
  }
  const {error:updateErr}=await admin.from("payment_requests").update({status:body.action==="approve"?"approved":"rejected",reviewed_at:new Date().toISOString(),reviewed_by:user.id,admin_note:typeof body.note==="string"?body.note.slice(0,500):null}).eq("id",request.id);
  if (updateErr) return reply({error:"Impossible d'enregistrer la décision"},500);
  return reply({success:true});
});
