-- Fix: Set admin user_type so RLS policies work
-- The security lockdown migration (14A) checks user_type = 'admin' 
-- but never seeded the admin user
UPDATE profiles
SET user_type = 'admin'
WHERE id IN (
  SELECT id FROM auth.users WHERE email = 'saileshbhupalam@gmail.com'
);
