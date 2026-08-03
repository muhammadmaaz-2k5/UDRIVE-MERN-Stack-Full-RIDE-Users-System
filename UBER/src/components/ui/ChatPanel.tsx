import { useEffect, useRef, useState } from "react";
import { X, Send, MessageCircle } from "lucide-react";
import { useChat } from "@/hooks/useChat";

interface ChatPanelProps {
  rideId: string;
  myId: string;
  otherId: string;
  otherName: string;
  isOpen: boolean;
  onClose: () => void;
}

export function ChatPanel({
  rideId,
  myId,
  otherId,
  otherName,
  isOpen,
  onClose,
}: ChatPanelProps) {
  const { messages, sending, sendMessage, markRead, scrollRef } = useChat(
    rideId,
    myId,
    otherId,
  );
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      markRead();
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [isOpen, markRead]);

  const handleSend = async () => {
    if (!text.trim() || sending) return;
    const body = text;
    setText("");
    try {
      await sendMessage(body);
    } catch {
      setText(body);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-end sm:items-center sm:justify-center bg-black/40 backdrop-blur-sm udrive-fade-in">
      <div className="w-full sm:max-w-md bg-white sm:rounded-3xl rounded-t-3xl shadow-2xl flex flex-col h-[80vh] sm:h-[600px] udrive-slide-up">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-100 shrink-0">
          <div className="w-10 h-10 rounded-full bg-udrive-100 text-udrive-700 flex items-center justify-center font-bold">
            {otherName?.charAt(0) ?? "?"}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-slate-900 truncate">{otherName}</div>
            <div className="text-xs text-green-600 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              Online
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-500 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Messages */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-4 py-4 space-y-2.5 bg-slate-50"
        >
          {messages.length === 0 && (
            <div className="text-center py-12">
              <MessageCircle className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-sm text-slate-400">
                No messages yet. Start the conversation!
              </p>
            </div>
          )}
          {messages.map((m) => {
            const mine = m.sender_id === myId;
            return (
              <div
                key={m.id}
                className={`flex ${mine ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[75%] px-3.5 py-2.5 rounded-2xl text-sm ${
                    mine
                      ? "bg-udrive-600 text-white rounded-br-md"
                      : "bg-white text-slate-800 rounded-bl-md shadow-sm border border-slate-100"
                  }`}
                >
                  <p className="break-words whitespace-pre-wrap">{m.body}</p>
                  <div
                    className={`text-[10px] mt-1 ${
                      mine ? "text-udrive-200" : "text-slate-400"
                    }`}
                  >
                    {new Date(m.created_at).toLocaleTimeString("en-PK", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Input */}
        <div className="px-3 py-3 border-t border-slate-100 flex items-center gap-2 shrink-0">
          <input
            ref={inputRef}
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSend();
            }}
            placeholder="Type a message..."
            className="flex-1 px-4 py-2.5 rounded-full bg-slate-100 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-udrive-500"
          />
          <button
            onClick={handleSend}
            disabled={!text.trim() || sending}
            className="w-11 h-11 rounded-full bg-udrive-600 text-white flex items-center justify-center hover:bg-udrive-700 disabled:opacity-40 disabled:cursor-not-allowed transition active:scale-95"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
