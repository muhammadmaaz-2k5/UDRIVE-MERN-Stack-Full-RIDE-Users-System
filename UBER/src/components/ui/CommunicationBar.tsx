import { useState, useCallback } from "react";
import { MessageCircle, Video, Phone, X } from "lucide-react";
import { useWebRTC } from "@/hooks/useWebRTC";
import { ChatPanel } from "@/components/ui/ChatPanel";
import { CallOverlay } from "@/components/ui/CallOverlay";

interface CommunicationBarProps {
  rideId: string;
  myId: string;
  otherId: string;
  otherName: string;
  /** When true, the chat/call controls are shown inline. */
  active: boolean;
}

export function CommunicationBar({
  rideId,
  myId,
  otherId,
  otherName,
}: CommunicationBarProps) {
  const [chatOpen, setChatOpen] = useState(false);
  const [callOpen, setCallOpen] = useState(false);
  const [isVideoCall, setIsVideoCall] = useState(false);

  const webrtc = useWebRTC({
    rideId,
    myId,
    otherId,
    videoEnabled: isVideoCall,
  });

  const handleStartCall = useCallback(
    (video: boolean) => {
      setIsVideoCall(video);
      setCallOpen(true);
      webrtc.startCall(video);
    },
    [webrtc],
  );

  const handleCloseCall = useCallback(() => {
    setCallOpen(false);
  }, []);

  return (
    <>
      {/* Chat + Call action buttons */}
      <div className="flex gap-2.5 mb-3">
        <button
          onClick={() => setChatOpen(true)}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-udrive-50 text-udrive-700 font-semibold text-sm hover:bg-udrive-100 transition active:scale-[0.98]"
        >
          <MessageCircle className="w-4.5 h-4.5" />
          Chat
        </button>
        <button
          onClick={() => handleStartCall(false)}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-green-50 text-green-700 font-semibold text-sm hover:bg-green-100 transition active:scale-[0.98]"
        >
          <Phone className="w-4.5 h-4.5" />
          Call
        </button>
        <button
          onClick={() => handleStartCall(true)}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-blue-50 text-blue-700 font-semibold text-sm hover:bg-blue-100 transition active:scale-[0.98]"
        >
          <Video className="w-4.5 h-4.5" />
          Video
        </button>
      </div>

      {/* Chat panel modal */}
      <ChatPanel
        rideId={rideId}
        myId={myId}
        otherId={otherId}
        otherName={otherName}
        isOpen={chatOpen}
        onClose={() => setChatOpen(false)}
      />

      {/* Call overlay */}
      {callOpen && (
        <CallOverlay
          webrtc={webrtc}
          otherName={otherName}
          isVideoCall={isVideoCall}
          onClose={handleCloseCall}
        />
      )}

      {/* Hidden incoming-call overlay (when call arrives but no outgoing call active) */}
      {!callOpen && webrtc.callState === "incoming" && (
        <CallOverlay
          webrtc={webrtc}
          otherName={otherName}
          isVideoCall={isVideoCall}
          onClose={handleCloseCall}
        />
      )}
    </>
  );
}
