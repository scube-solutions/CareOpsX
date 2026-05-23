const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env.local') });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function run() {
  console.log("\nAttempting test insertion into 'users' table:");
  const testEmail = 'test-user-' + Math.floor(Math.random() * 10000) + '@example.com';
  
  // First, let's create a temp organization or use an existing one (e.g. id 8 we just created)
  const { data: user, error: userError } = await supabase.from('users').insert([{
    first_name: 'Test',
    last_name: 'Admin',
    email: testEmail,
    password_hash: '$2b$10$q.XZlzajAqxc2TKcVRFA/.vqX/HvzftMglHgBEnH8zbAV5VmbmRxy',
    role_id: 1,
    roles: [1],
    organization_id: 8, // the test org we created
    is_active: true,
  }]).select('*');
  
  console.log("User Insert result:", { user, userError });

  // Cleanup
  console.log("\nCleaning up test user and test organizations...");
  const cleanUser = await supabase.from('users').delete().eq('email', testEmail);
  const cleanOrg = await supabase.from('organizations').delete().eq('organization_name', 'Test Org Diagnostics');
  console.log("Cleanup status:", { cleanUser: cleanUser.status, cleanOrg: cleanOrg.status });
}

run().catch(console.error);
