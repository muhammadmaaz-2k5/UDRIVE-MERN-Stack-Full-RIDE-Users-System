-- 1. Drop constraints
ALTER TABLE rides DROP CONSTRAINT IF EXISTS rides_customer_id_fkey;
ALTER TABLE rides DROP CONSTRAINT IF EXISTS rides_rider_id_fkey;
ALTER TABLE rider_locations DROP CONSTRAINT IF EXISTS rider_locations_rider_id_fkey;
ALTER TABLE ride_events DROP CONSTRAINT IF EXISTS ride_events_actor_id_fkey;
ALTER TABLE chat_messages DROP CONSTRAINT IF EXISTS chat_messages_sender_id_fkey;
ALTER TABLE chat_messages DROP CONSTRAINT IF EXISTS chat_messages_receiver_id_fkey;
ALTER TABLE call_signals DROP CONSTRAINT IF EXISTS call_signals_caller_id_fkey;
ALTER TABLE call_signals DROP CONSTRAINT IF EXISTS call_signals_callee_id_fkey;
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;

-- 2. Alter column types to TEXT for Clerk IDs
ALTER TABLE profiles ALTER COLUMN id TYPE text USING id::text;
ALTER TABLE rides ALTER COLUMN customer_id TYPE text USING customer_id::text;
ALTER TABLE rides ALTER COLUMN rider_id TYPE text USING rider_id::text;
ALTER TABLE rider_locations ALTER COLUMN rider_id TYPE text USING rider_id::text;
ALTER TABLE ride_events ALTER COLUMN actor_id TYPE text USING actor_id::text;
ALTER TABLE chat_messages ALTER COLUMN sender_id TYPE text USING sender_id::text;
ALTER TABLE chat_messages ALTER COLUMN receiver_id TYPE text USING receiver_id::text;
ALTER TABLE call_signals ALTER COLUMN caller_id TYPE text USING caller_id::text;
ALTER TABLE call_signals ALTER COLUMN callee_id TYPE text USING callee_id::text;

-- 3. Recreate Foreign Keys
ALTER TABLE rides ADD CONSTRAINT rides_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE rides ADD CONSTRAINT rides_rider_id_fkey FOREIGN KEY (rider_id) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE rider_locations ADD CONSTRAINT rider_locations_rider_id_fkey FOREIGN KEY (rider_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE ride_events ADD CONSTRAINT ride_events_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE chat_messages ADD CONSTRAINT chat_messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE chat_messages ADD CONSTRAINT chat_messages_receiver_id_fkey FOREIGN KEY (receiver_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE call_signals ADD CONSTRAINT call_signals_caller_id_fkey FOREIGN KEY (caller_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE call_signals ADD CONSTRAINT call_signals_callee_id_fkey FOREIGN KEY (callee_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- 4. Create custom Clerk auth.uid() equivalent
CREATE OR REPLACE FUNCTION clerk_user_id()
RETURNS text
LANGUAGE sql STABLE
AS $$
  SELECT (auth.jwt() ->> 'sub')::text;
$$;

-- 5. Rewrite RLS Policies
-- Profiles
DROP POLICY IF EXISTS "select_own_profile" ON profiles;
CREATE POLICY "select_own_profile" ON profiles FOR SELECT TO authenticated USING (clerk_user_id() = id);

DROP POLICY IF EXISTS "select_any_profile" ON profiles;
CREATE POLICY "select_any_profile" ON profiles FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_own_profile" ON profiles;
CREATE POLICY "insert_own_profile" ON profiles FOR INSERT TO authenticated WITH CHECK (clerk_user_id() = id);

DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile" ON profiles FOR UPDATE TO authenticated USING (clerk_user_id() = id) WITH CHECK (clerk_user_id() = id);

-- Rides
DROP POLICY IF EXISTS "select_rides_as_party" ON rides;
CREATE POLICY "select_rides_as_party" ON rides FOR SELECT TO authenticated USING (clerk_user_id() = customer_id OR clerk_user_id() = rider_id OR status = 'SEARCHING_FOR_RIDER');

DROP POLICY IF EXISTS "insert_own_ride" ON rides;
CREATE POLICY "insert_own_ride" ON rides FOR INSERT TO authenticated WITH CHECK (clerk_user_id() = customer_id);

DROP POLICY IF EXISTS "update_rides_as_party" ON rides;
CREATE POLICY "update_rides_as_party" ON rides FOR UPDATE TO authenticated USING (clerk_user_id() = customer_id OR clerk_user_id() = rider_id) WITH CHECK (clerk_user_id() = customer_id OR clerk_user_id() = rider_id);

DROP POLICY IF EXISTS "delete_own_ride" ON rides;
CREATE POLICY "delete_own_ride" ON rides FOR DELETE TO authenticated USING (clerk_user_id() = customer_id);

-- Rider Locations
DROP POLICY IF EXISTS "select_on_duty_riders" ON rider_locations;
CREATE POLICY "select_on_duty_riders" ON rider_locations FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "upsert_own_location" ON rider_locations;
CREATE POLICY "upsert_own_location" ON rider_locations FOR INSERT TO authenticated WITH CHECK (clerk_user_id() = rider_id);

DROP POLICY IF EXISTS "update_own_location" ON rider_locations;
CREATE POLICY "update_own_location" ON rider_locations FOR UPDATE TO authenticated USING (clerk_user_id() = rider_id) WITH CHECK (clerk_user_id() = rider_id);

DROP POLICY IF EXISTS "delete_own_location" ON rider_locations;
CREATE POLICY "delete_own_location" ON rider_locations FOR DELETE TO authenticated USING (clerk_user_id() = rider_id);

-- Ride Events
DROP POLICY IF EXISTS "select_ride_events_as_party" ON ride_events;
CREATE POLICY "select_ride_events_as_party" ON ride_events FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM rides r WHERE r.id = ride_events.ride_id AND (r.customer_id = clerk_user_id() OR r.rider_id = clerk_user_id()))
);

DROP POLICY IF EXISTS "insert_ride_events_as_party" ON ride_events;
CREATE POLICY "insert_ride_events_as_party" ON ride_events FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM rides r WHERE r.id = ride_events.ride_id AND (r.customer_id = clerk_user_id() OR r.rider_id = clerk_user_id()))
);

-- Chat Messages
DROP POLICY IF EXISTS "select_chat_messages" ON chat_messages;
CREATE POLICY "select_chat_messages" ON chat_messages FOR SELECT TO authenticated USING (clerk_user_id() = sender_id OR clerk_user_id() = receiver_id);

DROP POLICY IF EXISTS "insert_chat_messages" ON chat_messages;
CREATE POLICY "insert_chat_messages" ON chat_messages FOR INSERT TO authenticated WITH CHECK (clerk_user_id() = sender_id);

DROP POLICY IF EXISTS "update_chat_messages" ON chat_messages;
CREATE POLICY "update_chat_messages" ON chat_messages FOR UPDATE TO authenticated USING (clerk_user_id() = receiver_id) WITH CHECK (clerk_user_id() = receiver_id);

DROP POLICY IF EXISTS "delete_chat_messages" ON chat_messages;
CREATE POLICY "delete_chat_messages" ON chat_messages FOR DELETE TO authenticated USING (clerk_user_id() = sender_id);

-- Call Signals
DROP POLICY IF EXISTS "select_call_signals" ON call_signals;
CREATE POLICY "select_call_signals" ON call_signals FOR SELECT TO authenticated USING (clerk_user_id() = caller_id OR clerk_user_id() = callee_id);

DROP POLICY IF EXISTS "insert_call_signals" ON call_signals;
CREATE POLICY "insert_call_signals" ON call_signals FOR INSERT TO authenticated WITH CHECK (clerk_user_id() = caller_id OR clerk_user_id() = callee_id);

DROP POLICY IF EXISTS "delete_call_signals" ON call_signals;
CREATE POLICY "delete_call_signals" ON call_signals FOR DELETE TO authenticated USING (clerk_user_id() = caller_id OR clerk_user_id() = callee_id);
