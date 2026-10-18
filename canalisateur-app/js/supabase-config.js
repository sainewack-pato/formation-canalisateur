// Configuration Supabase – GIE I2DS
const SUPABASE_URL = "https://npqgvwylhqvdkyjnisas.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wcWd2d3lsaHF2ZGt5am5pc2FzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE4Mjk2NzUsImV4cCI6MjEwNzQwNTY3NX0.CU_AtkkdK4BuHHLi-xvYp1_nwLdWYaOfJetjlQIgGm0";

let supabase = null;

function initSupabase() {
  try {
    const lib = window.supabase;
    if (!lib) {
      console.error("window.supabase absent");
      return false;
    }
    // UMD build: supabase.createClient
    if (typeof lib.createClient === "function") {
      supabase = lib.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      return true;
    }
    // Some builds expose { createClient }
    if (lib.default && typeof lib.default.createClient === "function") {
      supabase = lib.default.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      return true;
    }
    console.error("createClient introuvable", lib);
    return false;
  } catch (e) {
    console.error("initSupabase error", e);
    return false;
  }
}
