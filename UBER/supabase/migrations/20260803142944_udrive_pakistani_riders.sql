/*
# UDRIVE — Update demo riders to Pakistani system

## Overview
Updates the 8 demo rider accounts to use Pakistani names, phone numbers (+92),
license plates (Karachi format: LER-XXXX, LEX-XXXX, LEK-XXXX), and positions
around Karachi (24.8607, 67.0011) instead of Bangalore.

## Changes
- full_name → Pakistani names
- phone → +92 format
- vehicle_plate → Karachi registration format
- rider_locations.position → spread around Karachi center

## Notes
- No new accounts created — updates existing demo riders only.
- Idempotent: safe to re-run.
*/

-- Update profiles with Pakistani names, phones, and plates
UPDATE profiles SET
  full_name = CASE email
    WHEN 'rider1@udrive.demo' THEN 'Ahmed Khan'
    WHEN 'rider2@udrive.demo' THEN 'Fatima Bibi'
    WHEN 'rider3@udrive.demo' THEN 'Bilal Ahmed'
    WHEN 'rider4@udrive.demo' THEN 'Ayesha Siddiqui'
    WHEN 'rider5@udrive.demo' THEN 'Usman Tariq'
    WHEN 'rider6@udrive.demo' THEN 'Zainab Malik'
    WHEN 'rider7@udrive.demo' THEN 'Hassan Raza'
    WHEN 'rider8@udrive.demo' THEN 'Maryam Iqbal'
  END,
  phone = CASE email
    WHEN 'rider1@udrive.demo' THEN '+923001234561'
    WHEN 'rider2@udrive.demo' THEN '+923001234562'
    WHEN 'rider3@udrive.demo' THEN '+923001234563'
    WHEN 'rider4@udrive.demo' THEN '+923001234564'
    WHEN 'rider5@udrive.demo' THEN '+923001234565'
    WHEN 'rider6@udrive.demo' THEN '+923001234566'
    WHEN 'rider7@udrive.demo' THEN '+923001234567'
    WHEN 'rider8@udrive.demo' THEN '+923001234568'
  END,
  vehicle_plate = CASE email
    WHEN 'rider1@udrive.demo' THEN 'LEK-1234'
    WHEN 'rider2@udrive.demo' THEN 'LEK-5678'
    WHEN 'rider3@udrive.demo' THEN 'LEX-9012'
    WHEN 'rider4@udrive.demo' THEN 'LEX-3456'
    WHEN 'rider5@udrive.demo' THEN 'LER-7890'
    WHEN 'rider6@udrive.demo' THEN 'LER-1234'
    WHEN 'rider7@udrive.demo' THEN 'LEP-5678'
    WHEN 'rider8@udrive.demo' THEN 'LEP-9012'
  END
FROM auth.users u
WHERE profiles.id = u.id
  AND u.email IN (
    'rider1@udrive.demo','rider2@udrive.demo','rider3@udrive.demo',
    'rider4@udrive.demo','rider5@udrive.demo','rider6@udrive.demo',
    'rider7@udrive.demo','rider8@udrive.demo'
  );

-- Update rider locations to be around Karachi (24.8607, 67.0011)
UPDATE rider_locations
SET
  position = ST_SetSRID(ST_MakePoint(
    67.0011 + (random() - 0.5) * 0.12,
    24.8607 + (random() - 0.5) * 0.11
  ), 4326)::geography,
  updated_at = now()
FROM profiles p
WHERE rider_locations.rider_id = p.id
  AND p.role = 'rider'
  AND p.vehicle_type IS NOT NULL;