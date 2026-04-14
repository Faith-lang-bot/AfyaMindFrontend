import type { RefObject } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Camera,
  CameraOff,
  Mic,
  MicOff,
  PhoneIncoming,
  PhoneOff,
  PhoneOutgoing,
  Video,
} from "lucide-react";

type CallPhase = "idle" | "incoming" | "calling" | "connecting" | "connected" | "ended" | "declined";

interface CareVideoCallDialogProps {
  open: boolean;
  phase: CallPhase;
  participantName: string;
  participantRoleLabel: string;
  localVideoRef: RefObject<HTMLVideoElement>;
  remoteVideoRef: RefObject<HTMLVideoElement>;
  durationSeconds: number;
  isMicMuted: boolean;
  isCameraOff: boolean;
  onAccept: () => void;
  onDecline: () => void;
  onHangup: () => void;
  onClose: () => void;
  onToggleMic: () => void;
  onToggleCamera: () => void;
}

export default function CareVideoCallDialog({
  open,
  phase,
  participantName,
  participantRoleLabel,
  localVideoRef,
  remoteVideoRef,
  durationSeconds,
  isMicMuted,
  isCameraOff,
  onAccept,
  onDecline,
  onHangup,
  onClose,
  onToggleMic,
  onToggleCamera,
}: CareVideoCallDialogProps) {
  if (!open) return null;

  const statusText =
    phase === "incoming"
      ? "Incoming video call"
      : phase === "calling"
        ? "Calling now..."
        : phase === "connecting"
          ? "Connecting secure video..."
          : phase === "connected"
            ? formatDuration(durationSeconds)
            : phase === "declined"
              ? "Call declined"
              : "Call ended";

  return (
    <div className="fixed inset-0 z-50 bg-background/85 backdrop-blur-sm p-4 sm:p-6">
      <div className="mx-auto flex h-full w-full max-w-6xl flex-col overflow-hidden rounded-[2rem] border border-border/60 bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border/60 px-5 py-4 sm:px-6">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-medium">{participantName}</h2>
              <Badge variant="outline">{participantRoleLabel}</Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{statusText}</p>
          </div>

          {(phase === "ended" || phase === "declined") && (
            <Button variant="outline" className="rounded-full" onClick={onClose}>
              Close
            </Button>
          )}
        </div>

        <div className="relative flex-1 bg-foreground/[0.03]">
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="h-full w-full bg-slate-950 object-cover"
          />

          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            {phase !== "connected" && (
              <div className="rounded-3xl border border-white/10 bg-slate-950/70 px-6 py-5 text-center text-white shadow-xl">
                <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-white/10">
                  {phase === "incoming" ? (
                    <PhoneIncoming className="h-6 w-6" />
                  ) : phase === "connected" ? (
                    <Video className="h-6 w-6" />
                  ) : (
                    <PhoneOutgoing className="h-6 w-6" />
                  )}
                </div>
                <p className="text-base font-medium">{participantName}</p>
                <p className="mt-1 text-sm text-white/70">{statusText}</p>
              </div>
            )}
          </div>

          <div className="absolute right-4 top-4 h-32 w-24 overflow-hidden rounded-2xl border border-white/15 bg-slate-950 shadow-lg sm:h-40 sm:w-32">
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-x-0 bottom-0 bg-slate-950/75 px-3 py-2 text-xs text-white">
              You
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 border-t border-border/60 px-5 py-5 sm:px-6">
          {phase === "incoming" && (
            <>
              <Button
                variant="outline"
                className="rounded-full border-destructive/30 px-5 text-destructive hover:bg-destructive/5"
                onClick={onDecline}
              >
                <PhoneOff className="mr-2 h-4 w-4" />
                Decline
              </Button>
              <Button className="rounded-full bg-green-600 px-5 text-white hover:bg-green-700" onClick={onAccept}>
                <Video className="mr-2 h-4 w-4" />
                Accept Video Call
              </Button>
            </>
          )}

          {(phase === "calling" || phase === "connecting" || phase === "connected") && (
            <>
              <Button
                variant="outline"
                size="icon"
                className="h-12 w-12 rounded-full"
                onClick={onToggleMic}
              >
                {isMicMuted ? <MicOff className="h-5 w-5 text-destructive" /> : <Mic className="h-5 w-5" />}
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-12 w-12 rounded-full"
                onClick={onToggleCamera}
              >
                {isCameraOff ? <CameraOff className="h-5 w-5 text-destructive" /> : <Camera className="h-5 w-5" />}
              </Button>
              <Button
                className="h-12 rounded-full bg-destructive px-6 hover:bg-destructive/90"
                onClick={onHangup}
              >
                <PhoneOff className="mr-2 h-4 w-4" />
                End Call
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}
