/*
# UDRIVE — Seed demo rider accounts

## Overview
Creates 8 demo rider accounts (auth.users + profiles + rider_locations) so the
map shows live on-duty riders immediately when a customer opens the app. All
demo riders use the password "rider123" and are spread around a default city
center (Bangalore: 12.9716, 77.5946) within a ~6km radius.

## Accounts
- rider1@udrive.demo through rider8@udrive.demo, password "rider123"
- 2 bikes, 2 autos, 2 cabEconomy, 2 cabPremium
- All on_duty = true with positions around the city center

## Notes
- Passwords hashed with pgcrypto crypt(..., gen_salt('bf')).
- Idempotent: ON CONFLICT-style guards via NOT EXISTS so re-running is safe.
- confirmed_at is a generated column, not set directly.
*/

INSERT INTO auth.users (
  instance_id, id, aud, role, email,
  encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
SELECT
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  email,
  crypt('rider123', gen_salt('bf')),
  now(),
  '{}'::jsonb, '{}'::jsonb, now(), now()
FROM (VALUES
  ('rider1@udrive.demo'),
  ('rider2@udrive.demo'),
  ('rider3@udrive.demo'),
  ('rider4@udrive.demo'),
  ('rider5@udrive.demo'),
  ('rider6@udrive.demo'),
  ('rider7@udrive.demo'),
  ('rider8@udrive.demo')
) AS t(email)
WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.email = t.email);

INSERT INTO profiles (id, role, phone, full_name, vehicle_type, vehicle_plate, rating, total_rides, total_earnings)
SELECT
  u.id, 'rider',
  CASE u.email
    WHEN 'rider1@udrive.demo' THEN '+919800000001'
    WHEN 'rider2@udrive.demo' THEN '+919800000002'
    WHEN 'rider3@udrive.demo' THEN '+919800000003'
    WHEN 'rider4@udrive.demo' THEN '+919800000004'
    WHEN 'rider5@udrive.demo' THEN '+919800000005'
    WHEN 'rider6@udrive.demo' THEN '+919800000006'
    WHEN 'rider7@udrive.demo' THEN '+919800000007'
    WHEN 'rider8@udrive.demo' THEN '+919800000008'
  END,
  CASE u.email
    WHEN 'rider1@udrive.demo' THEN 'Arjun Reddy'
    WHEN 'rider2@udrive.demo' THEN 'Priya Sharma'
    WHEN 'rider3@udrive.demo' THEN 'Vikram Singh'
    WHEN 'rider4@udrive.demo' THEN 'Sneha Patel'
    WHEN 'rider5@udrive.demo' THEN 'Rahul Verma'
    WHEN 'rider6@udrive.demo' THEN 'Anita Desai'
    WHEN 'rider7@udrive.demo' THEN 'Karan Malhotra'
    WHEN 'rider8@udrive.demo' THEN 'Deepak Nair'
  END,
  CASE u.email
    WHEN 'rider1@udrive.demo' THEN 'bike'
    WHEN 'rider2@udrive.demo' THEN 'bike'
    WHEN 'rider3@udrive.demo' THEN 'auto'
    WHEN 'rider4@udrive.demo' THEN 'auto'
    WHEN 'rider5@udrive.demo' THEN 'cabEconomy'
    WHEN 'rider6@udrive.demo' THEN 'cabEconomy'
    WHEN 'rider7@udrive.demo' THEN 'cabPremium'
    WHEN 'rider8@udrive.demo' THEN 'cabPremium'
  END,
  CASE u.email
    WHEN 'rider1@udrive.demo' THEN 'KA01 AB 1234'
    WHEN 'rider2@udrive.demo' THEN 'KA02 CD 5678'
    WHEN 'rider3@udrive.demo' THEN 'KA03 EF 9012'
    WHEN 'rider4@udrive.demo' THEN 'KA04 GH 3456'
    WHEN 'rider5@udrive.demo' THEN 'KA05 IJ 7890'
    WHEN 'rider6@udrive.demo' THEN 'KA06 KL 1234'
    WHEN 'rider7@udrive.demo' THEN 'KA07 MN 5678'
    WHEN 'rider8@udrive.demo' THEN 'KA08 OP 9012'
  END,
  4.8 + (random() * 0.2),
  floor(random() * 500 + 50)::int,
  floor(random() * 50000 + 5000)::numeric
FROM auth.users u
WHERE u.email IN (
  'rider1@udrive.demo','rider2@udrive.demo','rider3@udrive.demo',
  'rider4@udrive.demo','rider5@udrive.demo','rider6@udrive.demo',
  'rider7@udrive.demo','rider8@udrive.demo'
)
AND NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = u.id);

INSERT INTO rider_locations (rider_id, position, heading, on_duty, updated_at)
SELECT
  p.id,
  ST_SetSRID(ST_MakePoint(
    77.5946 + (random() - 0.5) * 0.12,
    12.9716 + (random() - 0.5) * 0.11
  ), 4326)::geography,
  floor(random() * 360)::numeric,
  true,
  now()
FROM profiles p
WHERE p.role = 'rider'
  AND p.vehicle_type IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM rider_locations rl WHERE rl.rider_id = p.id);