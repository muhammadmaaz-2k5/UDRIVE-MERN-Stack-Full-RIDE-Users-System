/* COMBINED UDRIVE SQL SETUP SCRIPT */

/* 1. udrive_tables */
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'customer'
    CHECK (role IN ('customer','rider')),
  phone text UNIQUE,
  full_name text NOT NULL DEFAULT 'Anonymous User',
  avatar_url text,
  vehicle_type text CHECK (vehicle_type IN ('bike','auto','cabEconomy','cabPremium')),
  vehicle_plate text,
  rating numeric(2,1) NOT NULL DEFAULT 4.8,
  total_rides integer NOT NULL DEFAULT 0,
  total_earnings numeric(10,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle text NOT NULL CHECK (vehicle IN ('bike','auto','cabEconomy','cabPremium')),
  status text NOT NULL DEFAULT 'SEARCHING_FOR_RIDER'
    CHECK (status IN ('SEARCHING_FOR_RIDER','START','ARRIVED','COMPLETED','CANCELLED')),
  fare numeric(8,2) NOT NULL,
  distance_km numeric(7,2) NOT NULL,
  duration_min integer NOT NULL,
  pickup_address text NOT NULL,
  drop_address text NOT NULL,
  pickup_geog geography(POINT,4326) NOT NULL,
  drop_geog geography(POINT,4326) NOT NULL,
  customer_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  rider_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  otp text NOT NULL DEFAULT lpad(floor(random()*9000+1000)::text, 4, '0'),
  created_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  started_at timestamptz,
  arrived_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz
);

CREATE TABLE IF NOT EXISTS rider_locations (
  rider_id uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  position geography(POINT,4326) NOT NULL,
  heading numeric(5,2),
  on_duty boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ride_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id uuid NOT NULL REFERENCES rides(id) ON DELETE CASCADE,
  status text NOT NULL,
  actor_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rides_status ON rides(status);
CREATE INDEX IF NOT EXISTS idx_rides_customer ON rides(customer_id);
CREATE INDEX IF NOT EXISTS idx_rides_rider ON rides(rider_id);
CREATE INDEX IF NOT EXISTS idx_rides_pickup_geog ON rides USING GIST (pickup_geog);
CREATE INDEX IF NOT EXISTS idx_rides_drop_geog ON rides USING GIST (drop_geog);
CREATE INDEX IF NOT EXISTS idx_rides_created ON rides(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rider_locations_pos ON rider_locations USING GIST (position);
CREATE INDEX IF NOT EXISTS idx_rider_locations_duty ON rider_locations(on_duty);
CREATE INDEX IF NOT EXISTS idx_ride_events_ride ON ride_events(ride_id, created_at);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS profiles_updated_at ON profiles;
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

/* 2. udrive_rls_realtime */
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE rides ENABLE ROW LEVEL SECURITY;
ALTER TABLE rider_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ride_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_profile" ON profiles;
CREATE POLICY "select_own_profile" ON profiles FOR SELECT
  TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "select_any_profile" ON profiles;
CREATE POLICY "select_any_profile" ON profiles FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_own_profile" ON profiles;
CREATE POLICY "insert_own_profile" ON profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "select_rides_as_party" ON rides;
CREATE POLICY "select_rides_as_party" ON rides FOR SELECT
  TO authenticated USING (auth.uid() = customer_id OR auth.uid() = rider_id OR status = 'SEARCHING_FOR_RIDER');

DROP POLICY IF EXISTS "insert_own_ride" ON rides;
CREATE POLICY "insert_own_ride" ON rides FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = customer_id);

DROP POLICY IF EXISTS "update_rides_as_party" ON rides;
CREATE POLICY "update_rides_as_party" ON rides FOR UPDATE
  TO authenticated
  USING (auth.uid() = customer_id OR auth.uid() = rider_id)
  WITH CHECK (auth.uid() = customer_id OR auth.uid() = rider_id);

DROP POLICY IF EXISTS "delete_own_ride" ON rides;
CREATE POLICY "delete_own_ride" ON rides FOR DELETE
  TO authenticated USING (auth.uid() = customer_id);

DROP POLICY IF EXISTS "select_on_duty_riders" ON rider_locations;
CREATE POLICY "select_on_duty_riders" ON rider_locations FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "upsert_own_location" ON rider_locations;
CREATE POLICY "upsert_own_location" ON rider_locations FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = rider_id);

DROP POLICY IF EXISTS "update_own_location" ON rider_locations;
CREATE POLICY "update_own_location" ON rider_locations FOR UPDATE
  TO authenticated USING (auth.uid() = rider_id) WITH CHECK (auth.uid() = rider_id);

DROP POLICY IF EXISTS "delete_own_location" ON rider_locations;
CREATE POLICY "delete_own_location" ON rider_locations FOR DELETE
  TO authenticated USING (auth.uid() = rider_id);

DROP POLICY IF EXISTS "select_ride_events_as_party" ON ride_events;
CREATE POLICY "select_ride_events_as_party" ON ride_events FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM rides r WHERE r.id = ride_events.ride_id
      AND (r.customer_id = auth.uid() OR r.rider_id = auth.uid()))
  );

DROP POLICY IF EXISTS "insert_ride_events_as_party" ON ride_events;
CREATE POLICY "insert_ride_events_as_party" ON ride_events FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM rides r WHERE r.id = ride_events.ride_id
      AND (r.customer_id = auth.uid() OR r.rider_id = auth.uid()))
  );

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    RETURN;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'rides'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE rides;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'rider_locations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE rider_locations;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'ride_events'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE ride_events;
  END IF;
END $$;

/* 3. chat_calls */
CREATE TABLE IF NOT EXISTS chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id uuid NOT NULL REFERENCES rides(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  receiver_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body text NOT NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_chat_messages" ON chat_messages;
CREATE POLICY "select_chat_messages"
  ON chat_messages FOR SELECT
  TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

DROP POLICY IF EXISTS "insert_chat_messages" ON chat_messages;
CREATE POLICY "insert_chat_messages"
  ON chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = sender_id);

DROP POLICY IF EXISTS "update_chat_messages" ON chat_messages;
CREATE POLICY "update_chat_messages"
  ON chat_messages FOR UPDATE
  TO authenticated
  USING (auth.uid() = receiver_id)
  WITH CHECK (auth.uid() = receiver_id);

DROP POLICY IF EXISTS "delete_chat_messages" ON chat_messages;
CREATE POLICY "delete_chat_messages"
  ON chat_messages FOR DELETE
  TO authenticated
  USING (auth.uid() = sender_id);

CREATE INDEX IF NOT EXISTS idx_chat_messages_ride_id ON chat_messages(ride_id, created_at);

CREATE TABLE IF NOT EXISTS call_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id uuid NOT NULL REFERENCES rides(id) ON DELETE CASCADE,
  caller_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  callee_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('offer', 'answer', 'ice', 'end', 'reject')),
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE call_signals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_call_signals" ON call_signals;
CREATE POLICY "select_call_signals"
  ON call_signals FOR SELECT
  TO authenticated
  USING (auth.uid() = caller_id OR auth.uid() = callee_id);

DROP POLICY IF EXISTS "insert_call_signals" ON call_signals;
CREATE POLICY "insert_call_signals"
  ON call_signals FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = caller_id OR auth.uid() = callee_id);

DROP POLICY IF EXISTS "delete_call_signals" ON call_signals;
CREATE POLICY "delete_call_signals"
  ON call_signals FOR DELETE
  TO authenticated
  USING (auth.uid() = caller_id OR auth.uid() = callee_id);

CREATE INDEX IF NOT EXISTS idx_call_signals_ride_id ON call_signals(ride_id, created_at);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    RETURN;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'chat_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'call_signals'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE call_signals;
  END IF;
END $$;

/* 4. udrive_seed_riders & pakistani_riders (Combined) */
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
    WHEN 'rider1@udrive.demo' THEN '+923001234561'
    WHEN 'rider2@udrive.demo' THEN '+923001234562'
    WHEN 'rider3@udrive.demo' THEN '+923001234563'
    WHEN 'rider4@udrive.demo' THEN '+923001234564'
    WHEN 'rider5@udrive.demo' THEN '+923001234565'
    WHEN 'rider6@udrive.demo' THEN '+923001234566'
    WHEN 'rider7@udrive.demo' THEN '+923001234567'
    WHEN 'rider8@udrive.demo' THEN '+923001234568'
  END,
  CASE u.email
    WHEN 'rider1@udrive.demo' THEN 'Ahmed Khan'
    WHEN 'rider2@udrive.demo' THEN 'Fatima Bibi'
    WHEN 'rider3@udrive.demo' THEN 'Bilal Ahmed'
    WHEN 'rider4@udrive.demo' THEN 'Ayesha Siddiqui'
    WHEN 'rider5@udrive.demo' THEN 'Usman Tariq'
    WHEN 'rider6@udrive.demo' THEN 'Zainab Malik'
    WHEN 'rider7@udrive.demo' THEN 'Hassan Raza'
    WHEN 'rider8@udrive.demo' THEN 'Maryam Iqbal'
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
    WHEN 'rider1@udrive.demo' THEN 'LEK-1234'
    WHEN 'rider2@udrive.demo' THEN 'LEK-5678'
    WHEN 'rider3@udrive.demo' THEN 'LEX-9012'
    WHEN 'rider4@udrive.demo' THEN 'LEX-3456'
    WHEN 'rider5@udrive.demo' THEN 'LER-7890'
    WHEN 'rider6@udrive.demo' THEN 'LER-1234'
    WHEN 'rider7@udrive.demo' THEN 'LEP-5678'
    WHEN 'rider8@udrive.demo' THEN 'LEP-9012'
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
    67.0011 + (random() - 0.5) * 0.12,
    24.8607 + (random() - 0.5) * 0.11
  ), 4326)::geography,
  floor(random() * 360)::numeric,
  true,
  now()
FROM profiles p
WHERE p.role = 'rider'
  AND p.vehicle_type IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM rider_locations rl WHERE rl.rider_id = p.id);
