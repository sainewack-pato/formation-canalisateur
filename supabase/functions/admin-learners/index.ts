// Liste sécurisée des comptes Auth et fusion avec les données de suivi.
// Le service_role reste uniquement côté Edge Function, jamais dans le navigateur.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...cors, "Content-Type": "application/json" },
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply({ error: "Method not allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anon || !service) return reply({ error: "Configuration serveur incomplète" }, 500);

  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return reply({ error: "Connexion requise" }, 401);
  const userClient = createClient(url, anon, {
    global: { headers: { Authorization: "Bearer " + token } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error: authError } = await userClient.auth.getUser(token);
  if (authError || !user) return reply({ error: "Session invalide" }, 401);

  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
  // Le rôle admin peut être stocké dans l'une ou l'autre table historique.
  const [primary, legacy] = await Promise.all([
    admin.from("progressions").select("is_admin").eq("user_id", user.id).limit(1),
    admin.from("learner_progress").select("is_admin").eq("user_id", user.id).maybeSingle(),
  ]);
  const isAdmin = (primary.data || []).some((row: { is_admin?: boolean }) => row.is_admin === true)
    || legacy.data?.is_admin === true;
  if (!isAdmin) return reply({ error: "Accès administrateur refusé" }, 403);

  try {
    const users: any[] = [];
    // Supabase Auth returns at most 1000 users per page; continue until exhausted.
    for (let page = 1; page <= 100; page++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) return reply({ error: "Lecture des comptes impossible" }, 500);
      users.push(...(data.users || []));
      if (!data.users || data.users.length < 1000) break;
    }

    const [legacyRows, progressionRows] = await Promise.all([
      admin.from("learner_progress")
        .select("user_id,email,user_name,completed_modules,best_score,is_admin,is_paid,paid_at,created_at,updated_at"),
      // progressions is per module in the production schema; only read fields
      // that exist there and aggregate rows without assuming a global unique user.
      admin.from("progressions")
        .select("user_id,email,user_name,completed_modules,best_score,is_admin,is_paid,paid_at,created_at,updated_at,module_id,statut,pourcentage"),
    ]);
    if (legacyRows.error && progressionRows.error) return reply({ error: "Lecture du suivi impossible" }, 500);

    const byId = new Map<string, any>();
    for (const u of users) {
      byId.set(u.id, {
        user_id: u.id,
        email: u.email || "",
        user_name: u.user_metadata?.name || u.user_metadata?.full_name || "",
        completed_modules: [],
        best_score: 0,
        is_admin: false,
        is_paid: null,
        created_at: u.created_at || null,
        updated_at: u.last_sign_in_at || u.created_at || null,
      });
    }
    for (const row of (legacyRows.data || [])) {
      const prev = byId.get(row.user_id) || { user_id: row.user_id, completed_modules: [], best_score: 0 };
      byId.set(row.user_id, { ...prev, ...row, email: row.email || prev.email || "", user_name: row.user_name || prev.user_name || "" });
    }
    for (const row of (progressionRows.data || [])) {
      const prev = byId.get(row.user_id) || { user_id: row.user_id, completed_modules: [], best_score: 0 };
      const modules = Array.isArray(prev.completed_modules) ? [...prev.completed_modules] : [];
      // Aggregate per-module rows when global completed_modules is absent.
      if (row.module_id && row.statut === "valide" && !modules.includes(row.module_id)) modules.push(row.module_id);
      byId.set(row.user_id, {
        ...prev,
        email: row.email || prev.email || "",
        user_name: row.user_name || prev.user_name || "",
        completed_modules: Array.isArray(row.completed_modules) && row.completed_modules.length
          ? row.completed_modules : modules,
        best_score: Math.max(Number(prev.best_score || 0), Number(row.best_score || 0)),
        is_admin: row.is_admin === true || prev.is_admin === true,
        is_paid: row.is_paid === true ? true : prev.is_paid,
        paid_at: row.paid_at || prev.paid_at || null,
        created_at: row.created_at || prev.created_at || null,
        updated_at: row.updated_at || prev.updated_at || null,
      });
    }
    return reply({ learners: [...byId.values()] });
  } catch (_error) {
    return reply({ error: "Erreur lors du chargement des apprenants" }, 500);
  }
});
