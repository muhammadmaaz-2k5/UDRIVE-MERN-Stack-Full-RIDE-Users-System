import { useEffect, useRef } from "react";
import {
  PhoneOff,
  Mic,
  MicOff,
  Video,
  VideoOff,
  Phone,
  VideoIcon,
  X,
  Loader2,
} from "lucide-react";
import type { useWebRTC } from "@/hooks/useWebRTC";
import type { CallState } from "@/hooks/useWebRTC";

interface CallOverlayProps {
  webrtc: ReturnType<typeof useWebRTC>;
  otherName: string;
  isVideoCall: boolean;
  onClose: () => void;
}

export function CallOverlay({
  webrtc,
  otherName,
  isVideoCall,
  onClose,
}: CallOverlayProps) {
  const {
    callState,
    localStream,
    remoteStream,
    audioMuted,
    cameraOn,
    isCaller,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleCamera,
  } = webrtc;

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  // Close overlay when call ends (after a short delay so user sees "ended")
  useEffect(() => {
    if (callState === "ended") {
      const timer = setTimeout(() => onClose(), 1500);
      return () => clearTimeout(timer);
    }
    if (callState === "idle") {
      onClose();
    }
  }, [callState, onClose]);

  const stateLabel = getStateLabel(callState, isCaller);

  // Incoming call view
  if (callState === "incoming") {
    return (
      <div className="fixed inset-0 z-[1100] bg-gradient-to-b from-slate-900 to-slate-800 flex flex-col items-center justify-center udrive-fade-in">
        <div className="flex flex-col items-center gap-4">
          <div className="w-24 h-24 rounded-full bg-udrive-600 flex items-center justify-center text-3xl font-bold text-white shadow-2xl animate-pulse">
            {otherName?.charAt(0) ?? "?"}
          </div>
          <div className="text-white text-xl font-bold">{otherName}</div>
          <div className="text-slate-300 text-sm">
            Incoming {isVideoCall ? "video" : "voice"} call...
          </div>
          <div className="flex items-center gap-6 mt-6">
            <button
              onClick={() => rejectCall()}
              className="flex flex-col items-center gap-2"
            >
              <div className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center text-white shadow-lg transition active:scale-95">
                <PhoneOff className="w-7 h-7" />
              </div>
              <span className="text-xs text-slate-300 font-medium">Decline</span>
            </button>
            <button
              onClick={() => acceptCall(isVideoCall)}
              className="flex flex-col items-center gap-2"
            >
              <div className="w-16 h-16 rounded-full bg-green-500 hover:bg-green-600 flex items-center justify-center text-white shadow-lg transition active:scale-95 animate-bounce">
                {isVideoCall ? (
                  <VideoIcon className="w-7 h-7" />
                ) : (
                  <Phone className="w-7 h-7" />
                )}
              </div>
              <span className="text-xs text-slate-300 font-medium">Accept</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Calling / connected / ended view
  return (
    <div className="fixed inset-0 z-[1100] bg-slate-900 flex flex-col udrive-fade-in">
      {/* Remote video (full screen) */}
      {isVideoCall && (
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className={`absolute inset-0 w-full h-full object-cover ${
            callState === "connected" && remoteStream ? "opacity-100" : "opacity-0"
          } transition-opacity duration-500`}
        />
      )}

      {/* Placeholder when not connected */}
      {callState !== "connected" && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <div className="w-28 h-28 rounded-full bg-udrive-600 flex items-center justify-center text-4xl font-bold text-white shadow-2xl">
            {otherName?.charAt(0) ?? "?"}
          </div>
          <div className="text-white text-xl font-bold">{otherName}</div>
          <div className="flex items-center gap-2 text-slate-300 text-sm">
            {callState === "calling" && (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {isVideoCall ? "Calling video..." : "Calling..."}
              </>
            )}
            {callState === "ended" && (
              <>
                <PhoneOff className="w-4 h-4" />
                Call ended
              </>
            )}
          </div>
        </div>
      )}

      {/* Connection state badge */}
      {callState === "connected" && (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-10">
          <div className="bg-black/40 backdrop-blur-md text-white text-xs font-medium px-4 py-1.5 rounded-full flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            {stateLabel}
          </div>
        </div>
      )}

      {/* Local video (picture-in-picture) */}
      {isVideoCall && localStream && cameraOn && callState === "connected" && (
        <div className="absolute top-5 right-5 z-10 w-28 h-40 sm:w-36 sm:h-52 rounded-2xl overflow-hidden border-2 border-white/20 shadow-xl">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover scale-x-[-1]"
          />
        </div>
      )}

      {/* Audio-only connected state */}
      {callState === "connected" && !isVideoCall && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <div className="w-32 h-32 rounded-full bg-udrive-600 flex items-center justify-center text-5xl font-bold text-white shadow-2xl animate-pulse">
            {otherName?.charAt(0) ?? "?"}
          </div>
          <div className="text-white text-xl font-bold">{otherName}</div>
          <div className="text-slate-300 text-sm flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            {Math.floor(Math.random() * 10) + 1}:{String(
              Math.floor(Math.random() * 60),
            ).padStart(2, "0")}
          </div>
        </div>
      )}

      {/* Controls bar */}
      {callState !== "ended" && (
        <div className="absolute bottom-0 left-0 right-0 z-10 pb-8 pt-4 bg-gradient-to-t from-black/60 to-transparent">
          <div className="flex items-center justify-center gap-4">
            {/* Mute toggle */}
            <button
              onClick={toggleMute}
              className={`w-14 h-14 rounded-full flex items-center justify-center transition active:scale-95 ${
                audioMuted
                  ? "bg-white text-slate-900"
                  : "bg-white/20 text-white backdrop-blur-md hover:bg-white/30"
              }`}
            >
              {audioMuted ? (
                <MicOff className="w-6 h-6" />
              ) : (
                <Mic className="w-6 h-6" />
              )}
            </button>

            {/* Camera toggle (video calls only) */}
            {isVideoCall && (
              <button
                onClick={toggleCamera}
                className={`w-14 h-14 rounded-full flex items-center justify-center transition active:scale-95 ${
                  !cameraOn
                    ? "bg-white text-slate-900"
                    : "bg-white/20 text-white backdrop-blur-md hover:bg-white/30"
                }`}
              >
                {cameraOn ? (
                  <VideoOff className="w-6 h-6" />
                ) : (
                  <Video className="w-6 h-6" />
                )}
              </button>
            )}

            {/* End call */}
            <button
              onClick={() => endCall()}
              className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center text-white shadow-lg transition active:scale-95"
            >
              <PhoneOff className="w-7 h-7" />
            </button>
          </div>
        </div>
      )}

      {/* Ended state close */}
      {callState === "ended" && (
        <div className="absolute bottom-8 left-0 right-0 flex justify-center">
          <button
            onClick={onClose}
            className="px-6 py-3 rounded-full bg-white/20 text-white backdrop-blur-md hover:bg-white/30 transition flex items-center gap-2 font-medium"
          >
            <X className="w-5 h-5" />
            Close
          </button>
        </div>
      )}
    </div>
  );
}

function getStateLabel(state: CallState, isCaller: boolean): string {
  switch (state) {
    case "calling":
      return isCaller ? "Calling..." : "Connecting...";
    case "connected":
      return "Connected";
    case "ended":
      return "Call ended";
    default:
      return "";
  }
}
