/*
# UDRIVE — Tables, extensions, and indexes

## Overview
Creates the four core tables for the UDRIVE ride-booking platform and enables
PostGIS for geospatial radius queries. RLS policies are added in a follow-up
migration so this one stays focused on structure.

## Tables
- profiles — user accounts keyed to auth.users, role customer|rider
- rides — ride bookings with pickup/drop geography points
- rider_locations — live rider position (PostGIS geography)
- ride_events — append-only status audit log

## Notes
- All geography columns use SRID 4326 (WGS84, GPS coordinates).
- GiST indexes on geography columns power nearby-rider radius queries.
*/

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