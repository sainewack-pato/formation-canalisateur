// Configuration Supabase – GIE I2DS
const SUPABASE_URL = "https://npqgvwylhqvdkyjnisas.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wcWd2d3lsaHF2ZGt5am5pc2FzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE4Mjk2NzUsImV4cCI6MjEwNzQwNTY3NX0.CU_AtkkdK4BuHHLi-xvYp1_nwLdWYaOfJetjlQIgGm0";

// IMPORTANT : ne pas nommer la variable "supabase" (conflit avec le SDK CDN)
var sbClient = null;

function initSupabase() {
  try {
    var lib = window.supabase;
    if (!lib || typeof lib.createClient !== "function") {
      console.error("SDK Supabase non disponible", lib);
      return false;
    }
    sbClient = lib.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    return !!sbClient;
  } catch (e) {
    console.error("initSupabase", e);
    return false;
  }
}
