/*
# UDRIVE — Row Level Security policies and realtime

## Overview
Enables RLS on all four tables and adds owner-scoped access policies. Also
adds the tables to the supabase_realtime publication so the frontend can
subscribe to ride status changes and live rider positions.

## RLS design
- profiles: owner can read/insert/update own row; any authenticated user can
  read any profile (customers need to see rider info and vice versa).
- rides: customer and assigned rider can read/update; only customer can insert
  and delete.
- rider_locations: any authenticated user can read on-duty riders (nearby-rider
  map); each rider can insert/update/delete only their own location row.
- ride_events: customer and assigned rider of the parent ride can read/insert.

## Realtime
- rides, rider_locations, ride_events added to supabase_realtime publication.
*/

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE rides ENABLE ROW LEVEL SECURITY;
ALTER TABLE rider_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ride_events ENABLE ROW LEVEL SECURITY;

-- profiles
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

-- rides
DROP POLICY IF EXISTS "select_rides_as_party" ON rides;
CREATE POLICY "select_rides_as_party" ON rides FOR SELECT
  TO authenticated USING (auth.uid() = customer_id OR auth.uid() = rider_id);

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

-- rider_locations
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

-- ride_events
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

-- Realtime publication
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