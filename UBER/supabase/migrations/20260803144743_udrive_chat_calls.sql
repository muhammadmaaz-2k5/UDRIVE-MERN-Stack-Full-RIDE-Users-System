/*
# UDRIVE — Chat messages and WebRTC call signaling tables

## Overview
Adds two new tables to support real-time in-ride communication:
1. `chat_messages` — text messages between customer and rider for a specific ride
2. `call_signals` — WebRTC signaling data (SDP offers, answers, ICE candidates) for voice/video calls

## New Tables

### chat_messages
- `id` (uuid, primary key)
- `ride_id` (uuid, FK to rides, on delete cascade)
- `sender_id` (uuid, FK to profiles) — who sent the message
- `receiver_id` (uuid, FK to profiles) — who receives the message
- `body` (text, not null) — message content
- `read_at` (timestamptz, nullable) — when receiver read it
- `created_at` (timestamptz, default now())

### call_signals
- `id` (uuid, primary key)
- `ride_id` (uuid, FK to rides, on delete cascade)
- `caller_id` (uuid, FK to profiles) — who initiated the call
- `callee_id` (uuid, FK to profiles) — who receives the call
- `type` (text: offer | answer | ice | end | reject) — signaling message type
- `payload` (jsonb) — SDP or ICE candidate data
- `created_at` (timestamptz, default now())

## Security
- RLS enabled on both tables
- Only sender or receiver can read messages/signals
- Only authenticated users can insert
- Realtime publication enabled on both tables
*/

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

-- ==================== CALL SIGNALS ====================
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

-- ==================== REALTIME ====================
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE call_signals;