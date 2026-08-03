import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { ChatMessage } from "@/types";

export function useChat(
  rideId: string | null,
  myId: string | null,
  otherId: string | null,
) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [unread, setUnread] = useState(0);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Load existing messages + subscribe to new ones
  useEffect(() => {
    if (!rideId || !myId) {
      setMessages([]);
      setUnread(0);
      return;
    }

    let cancelled = false;

    async function load() {
      if (!rideId || cancelled) return;
      const { data } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("ride_id", rideId)
        .order("created_at", { ascending: true });

      if (cancelled || !data) return;
      setMessages(data as ChatMessage[]);

      // Mark unread messages from the other person as read
      const unreadRows = (data as ChatMessage[]).filter(
        (m) => m.receiver_id === myId && !m.read_at,
      );
      if (unreadRows.length > 0) {
        await supabase
          .from("chat_messages")
          .update({ read_at: new Date().toISOString() })
          .in(
            "id",
            unreadRows.map((m) => m.id),
          );
      }
      setUnread(0);
    }

    load();

    const channel = supabase
      .channel(`chat:${rideId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `ride_id=eq.${rideId}`,
        },
        (payload) => {
          const msg = payload.new as ChatMessage;
          setMessages((prev) => {
            if (prev.some((m) => m.id === msg.id)) return prev;
            return [...prev, msg];
          });

          if (msg.sender_id !== myId && !msg.read_at) {
            // Incoming message — mark as read immediately
            supabase
              .from("chat_messages")
              .update({ read_at: new Date().toISOString() })
              .eq("id", msg.id)
              .then();
            setUnread((u) => u + 1);
          }
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [rideId, myId]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Reset unread when panel is opened
  const markRead = useCallback(() => {
    setUnread(0);
  }, []);

  const sendMessage = useCallback(
    async (body: string) => {
      if (!rideId || !myId || !otherId || !body.trim()) return;
      setSending(true);
      const { error } = await supabase.from("chat_messages").insert({
        ride_id: rideId,
        sender_id: myId,
        receiver_id: otherId,
        body: body.trim(),
      });
      setSending(false);
      if (error) throw error;
    },
    [rideId, myId, otherId],
  );

  return { messages, unread, sending, sendMessage, markRead, scrollRef };
}
