const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env.local') });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function run() {
  console.log("Supabase URL:", process.env.SUPABASE_URL);
  
  console.log("\n1. Testing query from 'organizations' table:");
  const { data: orgs, error: orgsError } = await supabase.from('organizations').select('*').limit(1);
  console.log("Orgs query result:", { orgs, orgsError });

  console.log("\n2. Testing query from 'users' table:");
  const { data: users, error: usersError } = await supabase.from('users').select('*').limit(1);
  console.log("Users query result:", { users, usersError });

  console.log("\n3. Attempting test insertion into 'organizations' to see if triggers/constraints fire:");
  const slug = 'test-diagnose-' + Math.floor(Math.random() * 10000);
  const { data: insertData, error: insertError } = await supabase.from('organizations').insert([{
    organization_name: 'Test Org Diagnostics',
    slug,
    organization_code: 'TESTDIAG123',
    billing_status: 'trial',
    payment_status: 'pending',
    portal_access: { admin: true }
  }]).select('*');
  console.log("Insert result:", { insertData, insertError });
}

run().catch(console.error);
