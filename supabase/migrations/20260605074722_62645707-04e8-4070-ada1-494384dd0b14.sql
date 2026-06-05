-- Reset admin password to a known value and ensure email is confirmed
UPDATE auth.users
SET 
  encrypted_password = crypt('FasoInvestPay@2026!', gen_salt('bf')),
  email_confirmed_at = COALESCE(email_confirmed_at, now()),
  updated_at = now()
WHERE email = 'ilboudoibonydo@gmail.com';

-- Remove any orphan auth.users created by failed signup attempts that have no profile
DELETE FROM auth.users
WHERE email = 'ilboudoibonydo@gmail.com'
  AND id NOT IN (SELECT id FROM public.profiles);