import { useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Phone, PhoneOff, Mic, MicOff, Volume2 } from "lucide-react";

interface VoiceCallProps {
  appointmentId: number;
  therapistName: string;
  onClose: () => void;
}

type CallState = "idle" | "calling" | "ringing" | "connected" | "ended";

export default function VoiceCall({ appointmentId, therapistName, onClose }: VoiceCallProps) {
  const { user } = useAuth();
  const [callState, setCallState] = useState<CallState>("idle");
  const [isMuted, setIsMuted] = useState(false);
  const [duration, setDuration] = useState(0);
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const localStream = useRef<MediaStream | null>(null);
  const remoteAudio = useRef<HTMLAudioElement | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const roomId = `call-${appointmentId}`;

  const cleanup = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    localStream.current?.getTracks().forEach((t) => t.stop());
    peerConnection.current?.close();
    peerConnection.current = null;
    localStream.current = null;
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  const setupPeerConnection = useCallback(() => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
      ],
    });

    pc.onicecandidate = (event) => {
      if (event.candidate && channelRef.current) {
        channelRef.current.send({
          type: "broadcast",
          event: "ice-candidate",
          payload: { candidate: event.candidate.toJSON(), from: user?.id },
        });
      }
    };

    pc.ontrack = (event) => {
      if (remoteAudio.current) {
        remoteAudio.current.srcObject = event.streams[0];
        remoteAudio.current.play().catch(console.error);
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") {
        setCallState("connected");
        timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
      }
      if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
        endCall();
      }
    };

    peerConnection.current = pc;
    return pc;
  }, [user?.id]);

  const startCall = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStream.current = stream;

      const pc = setupPeerConnection();
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      // Join signaling channel
      const channel = supabase.channel(roomId);
      channelRef.current = channel;

      channel
        .on("broadcast", { event: "answer" }, async ({ payload }) => {
          if (payload.from !== user?.id && peerConnection.current) {
            await peerConnection.current.setRemoteDescription(
              new RTCSessionDescription(payload.sdp)
            );
          }
        })
        .on("broadcast", { event: "ice-candidate" }, async ({ payload }) => {
          if (payload.from !== user?.id && peerConnection.current) {
            try {
              await peerConnection.current.addIceCandidate(new RTCIceCandidate(payload.candidate));
            } catch (e) {
              console.error("ICE candidate error:", e);
            }
          }
        })
        .on("broadcast", { event: "offer" }, async ({ payload }) => {
          // Handle incoming call (answering side)
          if (payload.from !== user?.id && peerConnection.current) {
            await peerConnection.current.setRemoteDescription(
              new RTCSessionDescription(payload.sdp)
            );
            const answer = await peerConnection.current.createAnswer();
            await peerConnection.current.setLocalDescription(answer);
            channel.send({
              type: "broadcast",
              event: "answer",
              payload: { sdp: answer, from: user?.id },
            });
          }
        })
        .on("broadcast", { event: "end-call" }, () => {
          endCall();
        })
        .subscribe(async (status) => {
          if (status === "SUBSCRIBED") {
            // Create and send offer
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            channel.send({
              type: "broadcast",
              event: "offer",
              payload: { sdp: offer, from: user?.id },
            });
            setCallState("calling");
          }
        });
    } catch (err) {
      console.error("Failed to start call:", err);
      setCallState("ended");
    }
  };

  const endCall = () => {
    if (channelRef.current) {
      channelRef.current.send({
        type: "broadcast",
        event: "end-call",
        payload: { from: user?.id },
      });
    }
    cleanup();
    setCallState("ended");
  };

  const toggleMute = () => {
    if (localStream.current) {
      localStream.current.getAudioTracks().forEach((t) => {
        t.enabled = !t.enabled;
      });
      setIsMuted((m) => !m);
    }
  };

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-card border border-border rounded-3xl p-8 w-full max-w-sm flex flex-col items-center gap-6 shadow-xl">
        {/* Avatar */}
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
          <span className="text-3xl font-serif text-primary">
            {therapistName.charAt(0).toUpperCase()}
          </span>
        </div>

        {/* Info */}
        <div className="text-center">
          <h3 className="text-lg font-medium">{therapistName}</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {callState === "idle" && "Ready to call"}
            {callState === "calling" && "Calling…"}
            {callState === "ringing" && "Ringing…"}
            {callState === "connected" && formatDuration(duration)}
            {callState === "ended" && "Call ended"}
          </p>
        </div>

        {/* Pulse animation when calling */}
        {(callState === "calling" || callState === "ringing") && (
          <div className="relative w-16 h-16">
            <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
            <div className="absolute inset-2 rounded-full bg-primary/30 animate-ping [animation-delay:150ms]" />
            <div className="absolute inset-4 rounded-full bg-primary/10 flex items-center justify-center">
              <Phone className="h-5 w-5 text-primary" />
            </div>
          </div>
        )}

        {/* Audio level indicator when connected */}
        {callState === "connected" && (
          <div className="flex items-center gap-1.5">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="w-1 bg-primary rounded-full animate-pulse"
                style={{
                  height: `${12 + Math.random() * 16}px`,
                  animationDelay: `${i * 100}ms`,
                }}
              />
            ))}
            <Volume2 className="h-4 w-4 text-primary ml-2" />
          </div>
        )}

        {/* Controls */}
        <div className="flex items-center gap-4">
          {callState === "idle" && (
            <>
              <Button
                variant="outline"
                size="lg"
                className="rounded-full"
                onClick={onClose}
              >
                Cancel
              </Button>
              <Button
                size="lg"
                className="rounded-full bg-green-600 hover:bg-green-700 text-white gap-2 px-6"
                onClick={startCall}
              >
                <Phone className="h-4 w-4" />
                Call Now
              </Button>
            </>
          )}

          {(callState === "calling" || callState === "ringing" || callState === "connected") && (
            <>
              <Button
                variant="outline"
                size="icon"
                className={`rounded-full h-12 w-12 ${isMuted ? "bg-destructive/10 border-destructive/30" : ""}`}
                onClick={toggleMute}
              >
                {isMuted ? <MicOff className="h-5 w-5 text-destructive" /> : <Mic className="h-5 w-5" />}
              </Button>
              <Button
                size="icon"
                className="rounded-full h-14 w-14 bg-destructive hover:bg-destructive/90"
                onClick={endCall}
              >
                <PhoneOff className="h-5 w-5" />
              </Button>
            </>
          )}

          {callState === "ended" && (
            <Button
              variant="outline"
              size="lg"
              className="rounded-full"
              onClick={onClose}
            >
              Close
            </Button>
          )}
        </div>

        <audio ref={remoteAudio} autoPlay />
      </div>
    </div>
  );
}
