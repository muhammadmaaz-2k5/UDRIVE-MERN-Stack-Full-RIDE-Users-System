import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { CallSignal } from "@/types";

export type CallState =
  | "idle"
  | "calling" // outgoing call, waiting for answer
  | "incoming" // incoming call, waiting to accept
  | "connected"
  | "ended";

interface UseWebRTCOptions {
  rideId: string | null;
  myId: string | null;
  otherId: string | null;
  videoEnabled: boolean;
}

const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
];

export function useWebRTC({
  rideId,
  myId,
  otherId,
  videoEnabled,
}: UseWebRTCOptions) {
  const [callState, setCallState] = useState<CallState>("idle");
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [audioMuted, setAudioMuted] = useState(false);
  const [cameraOn, setCameraOn] = useState(videoEnabled);
  const [isCaller, setIsCaller] = useState(false);
  const [incomingOffer, setIncomingOffer] = useState<RTCSessionDescriptionInit | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const iceCandidatesRef = useRef<RTCIceCandidate[]>([]);
  const pendingRemoteDescRef = useRef(false);

  // Create peer connection
  const createPeer = useCallback(() => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    pc.onicecandidate = (e) => {
      if (e.candidate && rideId && myId && otherId) {
        supabase.from("call_signals").insert({
          ride_id: rideId,
          caller_id: myId,
          callee_id: otherId,
          type: "ice",
          payload: { candidate: e.candidate.toJSON() },
        }).then();
      }
    };

    pc.ontrack = (e) => {
      setRemoteStream(e.streams[0]);
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") {
        setCallState("connected");
      } else if (
        pc.connectionState === "disconnected" ||
        pc.connectionState === "failed"
      ) {
        setCallState("ended");
      }
    };

    pcRef.current = pc;
    return pc;
  }, [rideId, myId, otherId]);

  // Get local media stream
  const getLocalStream = useCallback(
    async (withVideo: boolean): Promise<MediaStream> => {
      const constraints: MediaStreamConstraints = {
        audio: true,
        video: withVideo
          ? { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } }
          : false,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;
      setLocalStream(stream);
      setCameraOn(withVideo);
      return stream;
    },
    [],
  );

  // Start an outgoing call
  const startCall = useCallback(
    async (withVideo: boolean) => {
      if (!rideId || !myId || !otherId) return;
      setIsCaller(true);
      setCallState("calling");

      try {
        const stream = await getLocalStream(withVideo);
        const pc = createPeer();
        stream.getTracks().forEach((t) => pc.addTrack(t, stream));

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        await supabase.from("call_signals").insert({
          ride_id: rideId,
          caller_id: myId,
          callee_id: otherId,
          type: "offer",
          payload: { sdp: offer, video: withVideo },
        });
      } catch (err) {
        console.error("startCall error:", err);
        setCallState("idle");
        cleanup();
      }
    },
    [rideId, myId, otherId, createPeer, getLocalStream],
  );

  // Accept an incoming call
  const acceptCall = useCallback(
    async (withVideo: boolean) => {
      if (!rideId || !myId || !otherId || !incomingOffer) return;
      setCallState("connected");

      try {
        const stream = await getLocalStream(withVideo);
        const pc = createPeer();
        stream.getTracks().forEach((t) => pc.addTrack(t, stream));

        await pc.setRemoteDescription(incomingOffer);
        pendingRemoteDescRef.current = true;

        // Flush buffered ICE candidates
        for (const candidate of iceCandidatesRef.current) {
          await pc.addIceCandidate(candidate);
        }
        iceCandidatesRef.current = [];

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        await supabase.from("call_signals").insert({
          ride_id: rideId,
          caller_id: myId,
          callee_id: otherId,
          type: "answer",
          payload: { sdp: answer },
        });

        setIncomingOffer(null);
      } catch (err) {
        console.error("acceptCall error:", err);
        setCallState("idle");
        cleanup();
      }
    },
    [rideId, myId, otherId, incomingOffer, createPeer, getLocalStream],
  );

  // Reject an incoming call
  const rejectCall = useCallback(async () => {
    if (!rideId || !myId || !otherId) return;
    await supabase.from("call_signals").insert({
      ride_id: rideId,
      caller_id: myId,
      callee_id: otherId,
      type: "reject",
      payload: {},
    });
    setIncomingOffer(null);
    setCallState("idle");
  }, [rideId, myId, otherId]);

  // End an active call
  const endCall = useCallback(async () => {
    if (!rideId || !myId || !otherId) return;
    await supabase.from("call_signals").insert({
      ride_id: rideId,
      caller_id: myId,
      callee_id: otherId,
      type: "end",
      payload: {},
    });
    cleanup();
    setCallState("ended");
  }, [rideId, myId, otherId]);

  // Cleanup local resources
  const cleanup = useCallback(() => {
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    setLocalStream(null);
    setRemoteStream(null);
    iceCandidatesRef.current = [];
    setIncomingOffer(null);
  }, []);

  // Toggle audio mute
  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setAudioMuted(!audioTrack.enabled);
      }
    }
  }, []);

  // Toggle camera on/off
  const toggleCamera = useCallback(() => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setCameraOn(videoTrack.enabled);
      }
    }
  }, []);

  // Subscribe to signaling messages from the other party
  useEffect(() => {
    if (!rideId || !myId || !otherId) {
      cleanup();
      setCallState("idle");
      return;
    }

    const channel = supabase
      .channel(`webrtc:${rideId}:${myId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "call_signals",
          filter: `ride_id=eq.${rideId}`,
        },
        async (payload) => {
          const sig = payload.new as CallSignal;
          // Only process signals FROM the other person
          if (sig.caller_id !== otherId) return;

          if (sig.type === "offer") {
            const offerPayload = sig.payload as unknown as {
              sdp: RTCSessionDescriptionInit;
              video: boolean;
            };
            setIncomingOffer(offerPayload.sdp);
            setCallState("incoming");
          } else if (sig.type === "answer") {
            const answerPayload = sig.payload as unknown as {
              sdp: RTCSessionDescriptionInit;
            };
            const pc = pcRef.current;
            if (pc && pc.signalingState === "have-local-offer") {
              await pc.setRemoteDescription(answerPayload.sdp);
              for (const candidate of iceCandidatesRef.current) {
                await pc.addIceCandidate(candidate);
              }
              iceCandidatesRef.current = [];
            }
          } else if (sig.type === "ice") {
            const icePayload = sig.payload as unknown as {
              candidate: RTCIceCandidateInit;
            };
            const pc = pcRef.current;
            if (pc && pc.remoteDescription) {
              await pc.addIceCandidate(icePayload.candidate);
            } else {
              iceCandidatesRef.current.push(
                new RTCIceCandidate(icePayload.candidate),
              );
            }
          } else if (sig.type === "end" || sig.type === "reject") {
            cleanup();
            setCallState(sig.type === "reject" ? "idle" : "ended");
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [rideId, myId, otherId, cleanup]);

  // Cleanup on unmount
  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  return {
    callState,
    localStream,
    remoteStream,
    audioMuted,
    cameraOn,
    isCaller,
    incomingOffer,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleCamera,
  };
}
