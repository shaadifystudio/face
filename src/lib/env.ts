// Production note: install @supabase/ssr and @supabase/supabase-js in the deployment environment.
// Keep service-role credentials server-only. Never expose SUPABASE_SERVICE_ROLE_KEY to the browser.
export const env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  workerUrl: process.env.AI_WORKER_URL,
  workerSecret: process.env.AI_WORKER_SECRET,
};