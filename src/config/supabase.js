const { createClient } = require('@supabase/supabase-js');

let client;

function getSupabaseClient() {
  if (client) {
    return client;
  }

  const url = (process.env.SUPABASE_URL || '').trim();
  const serviceRoleKey = (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    ''
  ).trim();

  if (!url || !serviceRoleKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  }

  client = createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return client;
}

module.exports = {
  getSupabaseClient,
};
