import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import CareVideoCallDialog from "@/components/CareVideoCallDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { api, type CHWLinkStatus, type CareMessage } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  Loader2,
  MapPin,
  MessageSquare,
  Send,
  ShieldCheck,
  User,
  Video,
} from "lucide-react";

type CareRole = "mental_health_user" | "community_health_worker";
type CallPhase = "idle" | "incoming" | "calling" | "connecting" | "connected" | "ended" | "declined";

type ConversationTarget = {
  id: number;
  name: string;
  role: CareRole;
  roomId: string;
  subtitle: string;
  detail?: string;
  riskLevel?: string;
};

type PresenceParticipant = {
  user_id: number;
  name: string;
  role: CareRole;
};

type CareSocketEnvelope = {
  type: string;
  payload?: unknown;
};

type IncomingCall = {
  roomId: string;
  callerName: string;
  callerRole: CareRole;
  from: number;
};

type OfferPayload = {
  from: number;
  caller_name: string;
  caller_role: CareRole;
  sdp: RTCSessionDescriptionInit;
};

type AnswerPayload = {
  from: number;
  sdp: RTCSessionDescriptionInit;
};

type IcePayload = {
  from: number;
  candidate: RTCIceCandidateInit;
};

const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

export default function CareChat() {
  const { user, isUser, isCHW } = useAuth();
  const { toast } = useToast();

  const [targets, setTargets] = useState<ConversationTarget[]>([]);
  const [selectedTargetId, setSelectedTargetId] = useState<number | null>(null);
  const [linkedCHW, setLinkedCHW] = useState<CHWLinkStatus | null>(null);
  const [availabilityMessage, setAvailabilityMessage] = useState<string | null>(null);
  const [loadingTargets, setLoadingTargets] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [messagesByRoom, setMessagesByRoom] = useState<Record<string, CareMessage[]>>({});
  const [draft, setDraft] = useState("");
  const [onlineByTargetId, setOnlineByTargetId] = useState<Record<number, boolean>>({});
  const [connectedRooms, setConnectedRooms] = useState<Record<string, boolean>>({});
  const [unreadByRoom, setUnreadByRoom] = useState<Record<string, number>>({});
  const [callPhase, setCallPhase] = useState<CallPhase>("idle");
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const [localMedia, setLocalMedia] = useState<MediaStream | null>(null);
  const [remoteMedia, setRemoteMedia] = useState<MediaStream | null>(null);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [callDuration, setCallDuration] = useState(0);

  const socketsRef = useRef<Map<string, WebSocket>>(new Map());
  const selectedRoomRef = useRef<string | null>(null);
  const activeCallRoomRef = useRef<string | null>(null);
  const incomingOfferRef = useRef<RTCSessionDescriptionInit | null>(null);
  const pendingIceCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const callTimerRef = useRef<number | null>(null);
  const callPhaseRef = useRef<CallPhase>("idle");
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const messageEndRef = useRef<HTMLDivElement | null>(null);

  const selectedTarget = targets.find((target) => target.id === selectedTargetId) ?? null;
  const selectedRoomId = selectedTarget?.roomId ?? null;
  const messages = selectedRoomId ? messagesByRoom[selectedRoomId] ?? [] : [];
  const callIsActive =
    callPhase === "incoming" ||
    callPhase === "calling" ||
    callPhase === "connecting" ||
    callPhase === "connected";
  const isSelectedTargetOnline = selectedTarget ? onlineByTargetId[selectedTarget.id] : false;
  const isRoomConnected = selectedRoomId ? connectedRooms[selectedRoomId] : false;
  const canSendRealtime = Boolean(selectedTarget && isSelectedTargetOnline && isRoomConnected);

  useEffect(() => {
    callPhaseRef.current = callPhase;
  }, [callPhase]);

  useEffect(() => {
    selectedRoomRef.current = selectedRoomId;
    if (selectedRoomId) {
      setUnreadByRoom((current) => ({ ...current, [selectedRoomId]: 0 }));
    }
  }, [selectedRoomId]);

  useEffect(() => {
    if (!localVideoRef.current) return;
    localVideoRef.current.srcObject = localMedia;
  }, [localMedia]);

  useEffect(() => {
    if (!remoteVideoRef.current) return;
    remoteVideoRef.current.srcObject = remoteMedia;
  }, [remoteMedia]);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    let isCancelled = false;

    const loadTargets = async () => {
      if (!user) return;

      setLoadingTargets(true);
      setAvailabilityMessage(null);

      try {
        if (isUser) {
          const link = await api.getCHWLink();
          if (isCancelled) return;

          setLinkedCHW(link);

          if (!link.linked) {
            setTargets([]);
            setSelectedTargetId(null);
            setAvailabilityMessage("Link a registered health worker in CHW Support to unlock realtime chat and video.");
            return;
          }

          if (!link.chw_user_id) {
            setTargets([]);
            setSelectedTargetId(null);
            setAvailabilityMessage("Your linked health worker does not have a registered AfyaMind account yet, so live chat and video are unavailable for this link.");
            return;
          }

          const target: ConversationTarget = {
            id: link.chw_user_id,
            name: link.chw_name || "Health Worker",
            role: "community_health_worker",
            roomId: buildRoomId(user.id, link.chw_user_id),
            subtitle: link.region ? `${link.region} support` : "Community health support",
            detail: link.phone || undefined,
          };

          setTargets([target]);
          setSelectedTargetId(target.id);
          return;
        }

        if (isCHW) {
          const caseload = await api.getCHWCaseload();
          if (isCancelled) return;

          const mappedTargets = caseload.patients.map((patient) => ({
            id: patient.patient_id,
            name: patient.patient_name,
            role: "mental_health_user" as const,
            roomId: buildRoomId(user.id, patient.patient_id),
            subtitle: `${patient.region} · ${patient.total_checkins} check-ins`,
            detail: patient.last_checkin_at ? `Last check-in ${formatDateTime(patient.last_checkin_at)}` : "No recent check-in",
            riskLevel: patient.last_risk_level,
          }));

          setTargets(mappedTargets);
          setSelectedTargetId((current) => {
            if (current && mappedTargets.some((target) => target.id === current)) return current;
            return mappedTargets[0]?.id ?? null;
          });
          setAvailabilityMessage(mappedTargets.length === 0 ? "Patients will appear here once they are linked to your caseload." : null);
          return;
        }

        setTargets([]);
        setSelectedTargetId(null);
        setAvailabilityMessage("This account role cannot open the care chat workspace.");
      } catch (error) {
        if (isCancelled) return;

        const message = error instanceof Error ? error.message : "Unable to load the care chat workspace.";
        setTargets([]);
        setSelectedTargetId(null);
        setAvailabilityMessage(message);
        toast({ title: "Unable to load care chat", description: message, variant: "destructive" });
      } finally {
        if (!isCancelled) setLoadingTargets(false);
      }
    };

    void loadTargets();

    return () => {
      isCancelled = true;
    };
  }, [isCHW, isUser, toast, user]);

  const loadRoomMessages = useCallback(
    async (roomId: string) => {
      setLoadingMessages(true);
      try {
        const roomMessages = await api.getCareMessages(roomId);
        setMessagesByRoom((current) => ({ ...current, [roomId]: roomMessages }));
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to load message history.";
        toast({ title: "Unable to load messages", description: message, variant: "destructive" });
      } finally {
        setLoadingMessages(false);
      }
    },
    [toast],
  );

  useEffect(() => {
    if (!selectedRoomId) return;
    void loadRoomMessages(selectedRoomId);
  }, [loadRoomMessages, selectedRoomId]);

  const stopCallTimer = useCallback(() => {
    if (callTimerRef.current !== null) {
      window.clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }
  }, []);

  const startCallTimer = useCallback(() => {
    stopCallTimer();
    setCallDuration(0);
    callTimerRef.current = window.setInterval(() => {
      setCallDuration((current) => current + 1);
    }, 1000);
  }, [stopCallTimer]);

  const cleanupCallSession = useCallback(
    (nextPhase: CallPhase = "idle") => {
      stopCallTimer();
      peerConnectionRef.current?.close();
      peerConnectionRef.current = null;
      pendingIceCandidatesRef.current = [];
      incomingOfferRef.current = null;
      activeCallRoomRef.current = null;
      localStreamRef.current?.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
      remoteStreamRef.current = null;
      setLocalMedia(null);
      setRemoteMedia(null);
      setIsMicMuted(false);
      setIsCameraOff(false);
      setIncomingCall(null);
      setCallDuration(0);
      setCallPhase(nextPhase);
    },
    [stopCallTimer],
  );

  useEffect(() => {
    return () => {
      cleanupCallSession();
      socketsRef.current.forEach((socket) => socket.close());
      socketsRef.current.clear();
    };
  }, [cleanupCallSession]);

  const updateRoomMessages = useCallback((roomId: string, updater: (current: CareMessage[]) => CareMessage[]) => {
    setMessagesByRoom((current) => ({
      ...current,
      [roomId]: updater(current[roomId] ?? []),
    }));
  }, []);

  const appendIncomingMessage = useCallback(
    (roomId: string, message: CareMessage) => {
      updateRoomMessages(roomId, (current) => {
        if (current.some((item) => item.id === message.id)) return current;
        return [...current, message];
      });

      if (selectedRoomRef.current === roomId) return;

      setUnreadByRoom((current) => ({
        ...current,
        [roomId]: (current[roomId] ?? 0) + 1,
      }));

      toast({
        title: `New message from ${message.sender_name}`,
        description: message.message.length > 84 ? `${message.message.slice(0, 84)}...` : message.message,
      });
    },
    [toast, updateRoomMessages],
  );

  const sendToRoom = useCallback((roomId: string, envelope: CareSocketEnvelope) => {
    const socket = socketsRef.current.get(roomId);
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      throw new Error("Realtime room is not connected yet.");
    }

    socket.send(JSON.stringify(envelope));
  }, []);

  const flushPendingIceCandidates = useCallback(async (peerConnection: RTCPeerConnection) => {
    const queuedCandidates = [...pendingIceCandidatesRef.current];
    pendingIceCandidatesRef.current = [];

    for (const candidate of queuedCandidates) {
      try {
        await peerConnection.addIceCandidate(candidate);
      } catch (error) {
        console.error("Unable to add queued ICE candidate", error);
      }
    }
  }, []);

  const createPeerConnection = useCallback(
    (roomId: string) => {
      const peerConnection = new RTCPeerConnection({ iceServers: ICE_SERVERS });

      peerConnection.onicecandidate = (event) => {
        if (!event.candidate) return;

        try {
          sendToRoom(roomId, {
            type: "ice_candidate",
            payload: { candidate: event.candidate.toJSON() },
          });
        } catch (error) {
          console.error("Unable to send ICE candidate", error);
        }
      };

      peerConnection.ontrack = (event) => {
        const [incomingStream] = event.streams;
        if (incomingStream) {
          remoteStreamRef.current = incomingStream;
          setRemoteMedia(incomingStream);
          return;
        }

        if (!remoteStreamRef.current) {
          remoteStreamRef.current = new MediaStream();
        }

        remoteStreamRef.current.addTrack(event.track);
        setRemoteMedia(new MediaStream(remoteStreamRef.current.getTracks()));
      };

      peerConnection.onconnectionstatechange = () => {
        if (peerConnection.connectionState === "connected") {
          setCallPhase("connected");
          startCallTimer();
          return;
        }

        if (
          peerConnection.connectionState === "failed" ||
          peerConnection.connectionState === "disconnected" ||
          peerConnection.connectionState === "closed"
        ) {
          if (callPhaseRef.current === "idle") return;
          cleanupCallSession("ended");
        }
      };

      peerConnectionRef.current = peerConnection;
      return peerConnection;
    },
    [cleanupCallSession, sendToRoom, startCallTimer],
  );

  const ensureLocalMedia = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("This browser does not support camera and microphone access.");
    }

    if (localStreamRef.current) return localStreamRef.current;

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
    localStreamRef.current = stream;
    setLocalMedia(stream);
    setIsMicMuted(false);
    setIsCameraOff(false);
    return stream;
  }, []);

  const handleIncomingOffer = useCallback(
    async (roomId: string, payload: OfferPayload, target: ConversationTarget) => {
      if (!user || payload.from === user.id) return;

      if (
        callPhaseRef.current === "incoming" ||
        callPhaseRef.current === "calling" ||
        callPhaseRef.current === "connecting" ||
        callPhaseRef.current === "connected"
      ) {
        try {
          sendToRoom(roomId, {
            type: "call_declined",
            payload: { reason: "busy" },
          });
        } catch (error) {
          console.error("Unable to decline busy call", error);
        }
        return;
      }

      pendingIceCandidatesRef.current = [];
      incomingOfferRef.current = payload.sdp;
      activeCallRoomRef.current = roomId;
      setSelectedTargetId(target.id);
      setIncomingCall({
        roomId,
        callerName: payload.caller_name,
        callerRole: payload.caller_role,
        from: payload.from,
      });
      setCallPhase("incoming");
    },
    [sendToRoom, user],
  );

  const handleIncomingAnswer = useCallback(
    async (payload: AnswerPayload) => {
      if (!user || payload.from === user.id || !peerConnectionRef.current) return;

      try {
        await peerConnectionRef.current.setRemoteDescription(payload.sdp);
        await flushPendingIceCandidates(peerConnectionRef.current);
      } catch (error) {
        console.error("Unable to set remote answer", error);
        cleanupCallSession("ended");
      }
    },
    [cleanupCallSession, flushPendingIceCandidates, user],
  );

  const handleIncomingIceCandidate = useCallback(async (payload: IcePayload) => {
    if (!payload.candidate) return;

    if (!peerConnectionRef.current || !peerConnectionRef.current.remoteDescription) {
      pendingIceCandidatesRef.current.push(payload.candidate);
      return;
    }

    try {
      await peerConnectionRef.current.addIceCandidate(payload.candidate);
    } catch (error) {
      console.error("Unable to add ICE candidate", error);
    }
  }, []);

  useEffect(() => {
    socketsRef.current.forEach((socket) => socket.close());
    socketsRef.current.clear();
    setConnectedRooms({});
    setOnlineByTargetId({});

    if (!user || targets.length === 0) return;

    const token = api.getToken();
    if (!token) return;

    const roomMap = new Map<string, WebSocket>();

    targets.forEach((target) => {
      const socket = new WebSocket(buildCareSocketUrl(target.roomId, token));

      socket.onopen = () => {
        setConnectedRooms((current) => ({ ...current, [target.roomId]: true }));
      };

      socket.onclose = () => {
        setConnectedRooms((current) => ({ ...current, [target.roomId]: false }));
        setOnlineByTargetId((current) => ({ ...current, [target.id]: false }));
      };

      socket.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data) as CareSocketEnvelope;

          if (parsed.type === "presence_sync") {
            const participants = ((parsed.payload as { participants?: PresenceParticipant[] })?.participants ?? []).filter(
              Boolean,
            );
            setOnlineByTargetId((current) => ({
              ...current,
              [target.id]: participants.some((participant) => participant.user_id === target.id),
            }));
            return;
          }

          if (parsed.type === "chat_message") {
            appendIncomingMessage(target.roomId, parsed.payload as CareMessage);
            return;
          }

          if (parsed.type === "video_offer") {
            void handleIncomingOffer(target.roomId, parsed.payload as OfferPayload, target);
            return;
          }

          if (parsed.type === "video_answer") {
            void handleIncomingAnswer(parsed.payload as AnswerPayload);
            return;
          }

          if (parsed.type === "ice_candidate") {
            void handleIncomingIceCandidate(parsed.payload as IcePayload);
            return;
          }

          if (parsed.type === "call_hangup") {
            cleanupCallSession("ended");
            return;
          }

          if (parsed.type === "call_declined") {
            cleanupCallSession("declined");
          }
        } catch (error) {
          console.error("Unable to parse care socket event", error);
        }
      };

      roomMap.set(target.roomId, socket);
    });

    socketsRef.current = roomMap;

    return () => {
      roomMap.forEach((socket) => socket.close());
      socketsRef.current = new Map();
    };
  }, [
    appendIncomingMessage,
    cleanupCallSession,
    handleIncomingAnswer,
    handleIncomingIceCandidate,
    handleIncomingOffer,
    targets,
    user,
  ]);

  const handleSendMessage = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!selectedTarget || !selectedRoomId) return;

    const body = draft.trim();
    if (!body) return;

    if (!canSendRealtime) {
      toast({
        title: "Realtime chat is offline",
        description: `${selectedTarget.name} needs to be active in Care Chat to receive live messages.`,
        variant: "destructive",
      });
      return;
    }

    try {
      sendToRoom(selectedRoomId, {
        type: "chat_message",
        payload: { message: body },
      });
      setDraft("");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to send the message.";
      toast({ title: "Send failed", description: message, variant: "destructive" });
    }
  };

  const handleDraftKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    void handleSendMessage();
  };

  const startVideoCall = useCallback(async () => {
    if (!selectedTarget || !selectedRoomId) return;

    if (!canSendRealtime) {
      toast({
        title: "Video call unavailable",
        description: `${selectedTarget.name} needs to be online in Care Chat before a live call can start.`,
        variant: "destructive",
      });
      return;
    }

    try {
      setCallPhase("connecting");
      activeCallRoomRef.current = selectedRoomId;
      pendingIceCandidatesRef.current = [];

      const stream = await ensureLocalMedia();
      const peerConnection = createPeerConnection(selectedRoomId);
      stream.getTracks().forEach((track) => peerConnection.addTrack(track, stream));

      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      setCallPhase("calling");

      sendToRoom(selectedRoomId, {
        type: "video_offer",
        payload: { sdp: offer },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to start the video call.";
      cleanupCallSession();
      toast({ title: "Video call failed", description: message, variant: "destructive" });
    }
  }, [
    canSendRealtime,
    cleanupCallSession,
    createPeerConnection,
    ensureLocalMedia,
    selectedRoomId,
    selectedTarget,
    sendToRoom,
    toast,
  ]);

  const acceptIncomingCall = useCallback(async () => {
    if (!incomingCall || !incomingOfferRef.current) return;

    try {
      setCallPhase("connecting");
      const stream = await ensureLocalMedia();
      const peerConnection = createPeerConnection(incomingCall.roomId);
      activeCallRoomRef.current = incomingCall.roomId;
      stream.getTracks().forEach((track) => peerConnection.addTrack(track, stream));

      await peerConnection.setRemoteDescription(incomingOfferRef.current);
      await flushPendingIceCandidates(peerConnection);

      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      setIncomingCall(null);

      sendToRoom(incomingCall.roomId, {
        type: "video_answer",
        payload: { sdp: answer },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to accept the incoming call.";
      cleanupCallSession();
      toast({ title: "Unable to join call", description: message, variant: "destructive" });
    }
  }, [cleanupCallSession, createPeerConnection, ensureLocalMedia, flushPendingIceCandidates, incomingCall, sendToRoom, toast]);

  const declineIncomingCall = useCallback(() => {
    if (!incomingCall) {
      cleanupCallSession();
      return;
    }

    try {
      sendToRoom(incomingCall.roomId, {
        type: "call_declined",
        payload: { reason: "declined" },
      });
    } catch (error) {
      console.error("Unable to send decline event", error);
    }
    cleanupCallSession();
  }, [cleanupCallSession, incomingCall, sendToRoom]);

  const hangupCall = useCallback(() => {
    const roomId = activeCallRoomRef.current ?? selectedRoomRef.current;
    if (roomId) {
      try {
        sendToRoom(roomId, { type: "call_hangup" });
      } catch (error) {
        console.error("Unable to send hangup event", error);
      }
    }

    cleanupCallSession("ended");
  }, [cleanupCallSession, sendToRoom]);

  const closeCallDialog = useCallback(() => {
    cleanupCallSession();
  }, [cleanupCallSession]);

  const toggleMicrophone = () => {
    if (!localStreamRef.current) return;

    const shouldMute = !isMicMuted;
    localStreamRef.current.getAudioTracks().forEach((track) => {
      track.enabled = !shouldMute;
    });
    setIsMicMuted(shouldMute);
  };

  const toggleCamera = () => {
    if (!localStreamRef.current) return;

    const shouldDisable = !isCameraOff;
    localStreamRef.current.getVideoTracks().forEach((track) => {
      track.enabled = !shouldDisable;
    });
    setIsCameraOff(shouldDisable);
  };

  const statsLabel = useMemo(
    () => (loadingMessages ? "Loading conversation..." : `${messages.length} messages available`),
    [loadingMessages, messages.length],
  );

  return (
    <>
      <div className="animate-fade-in flex flex-col gap-8">
        <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-4xl tracking-tight">Care Chat</h1>
            <p className="mt-2 text-muted-foreground">
              Realtime care coordination between patients and health workers, with live video when both sides are ready.
            </p>
          </div>

          <div className="rounded-2xl border border-border/70 bg-card px-4 py-3 text-sm text-muted-foreground">
            Live sync works directly through your AfyaMind Render service, with stored message history and same-domain calls.
          </div>
        </header>

        <div className="grid gap-6 xl:grid-cols-[320px,minmax(0,1fr)]">
          <aside className="card-elevated flex flex-col gap-4 p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10">
                <MessageSquare className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-medium">{isUser ? "Linked Health Worker" : "Patient Threads"}</h2>
                <p className="text-sm text-muted-foreground">
                  {isUser ? "Open your direct care channel." : "Stay reachable for live patient support."}
                </p>
              </div>
            </div>

            {loadingTargets && (
              <div className="flex items-center gap-3 rounded-2xl border border-border/70 px-4 py-5 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Connecting your care rooms...
              </div>
            )}

            {!loadingTargets && targets.length === 0 && (
              <div className="rounded-2xl border border-dashed border-border/70 px-4 py-5 text-sm text-muted-foreground">
                {availabilityMessage || "No care threads are available yet."}
              </div>
            )}

            {!loadingTargets && targets.length > 0 && (
              <div className="flex flex-col gap-3">
                {targets.map((target) => {
                  const isSelected = target.id === selectedTargetId;
                  const unreadCount = unreadByRoom[target.roomId] ?? 0;
                  const isOnline = onlineByTargetId[target.id];
                  const disableSwitch = callIsActive && !isSelected;

                  return (
                    <button
                      key={target.roomId}
                      type="button"
                      disabled={disableSwitch}
                      onClick={() => setSelectedTargetId(target.id)}
                      className={cn(
                        "rounded-3xl border px-4 py-4 text-left transition-all",
                        isSelected
                          ? "border-primary/40 bg-primary/5 shadow-sm"
                          : "border-border/70 bg-background hover:border-primary/20",
                        disableSwitch && "cursor-not-allowed opacity-60",
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="truncate font-medium">{target.name}</span>
                            <Badge variant={target.role === "community_health_worker" ? "default" : "secondary"}>
                              {roleLabel(target.role)}
                            </Badge>
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground">{target.subtitle}</p>
                          {target.detail && <p className="mt-1 text-xs text-muted-foreground">{target.detail}</p>}
                          {target.riskLevel && (
                            <div className="mt-3">
                              <Badge className={riskBadgeClasses(target.riskLevel)}>{target.riskLevel} risk</Badge>
                            </div>
                          )}
                        </div>

                        <div className="flex flex-col items-end gap-2">
                          <span className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span
                              className={cn(
                                "h-2.5 w-2.5 rounded-full",
                                isOnline ? "bg-green-500" : "bg-muted-foreground/30",
                              )}
                            />
                            {isOnline ? "online" : "offline"}
                          </span>
                          {unreadCount > 0 && (
                            <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
                              {unreadCount}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {isUser && linkedCHW?.linked && !linkedCHW.chw_user_id && (
              <div className="rounded-2xl border border-dashed border-amber-500/40 bg-amber-500/5 px-4 py-4 text-sm text-muted-foreground">
                Your current CHW link is not tied to a registered AfyaMind account yet. Re-link to a registered health worker to enable live chat and video.
              </div>
            )}
          </aside>

          <section className="card-elevated flex min-h-[680px] flex-col overflow-hidden p-0">
            {selectedTarget ? (
              <>
                <div className="flex flex-col gap-4 border-b border-border/60 px-6 py-5 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-2xl font-medium">{selectedTarget.name}</h2>
                      <Badge variant={selectedTarget.role === "community_health_worker" ? "default" : "secondary"}>
                        {roleLabel(selectedTarget.role)}
                      </Badge>
                      <span className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span
                          className={cn(
                            "h-2.5 w-2.5 rounded-full",
                            isSelectedTargetOnline ? "bg-green-500" : "bg-muted-foreground/30",
                          )}
                        />
                        {isSelectedTargetOnline ? "Active in Care Chat" : "Not currently active"}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                      {selectedTarget.detail && (
                        <span className="flex items-center gap-2">
                          <MapPin className="h-4 w-4" />
                          {selectedTarget.detail}
                        </span>
                      )}
                      <span>{selectedTarget.subtitle}</span>
                      <span>{statsLabel}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <Button
                      variant="outline"
                      className="rounded-full gap-2"
                      disabled={!canSendRealtime || callIsActive}
                      onClick={() => void startVideoCall()}
                    >
                      <Video className="h-4 w-4" />
                      Start Video Call
                    </Button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-5">
                  {loadingMessages ? (
                    <div className="flex h-full items-center justify-center text-muted-foreground">
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Loading conversation...
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="flex h-full flex-col items-center justify-center rounded-3xl border border-dashed border-border/70 px-6 py-10 text-center text-muted-foreground">
                      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                        {selectedTarget.role === "community_health_worker" ? (
                          <ShieldCheck className="h-7 w-7 text-primary" />
                        ) : (
                          <User className="h-7 w-7 text-primary" />
                        )}
                      </div>
                      <h3 className="text-lg font-medium text-foreground">Ready for live care support</h3>
                      <p className="mt-2 max-w-xl">
                        Messages here are stored by AfyaMind and labeled by role so it is always clear when the health worker is replying.
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-4">
                      {messages.map((message) => {
                        const isOwn = user?.id === message.sender_id;

                        return (
                          <div key={message.id} className={cn("flex flex-col gap-2", isOwn ? "items-end" : "items-start")}>
                            <div
                              className={cn(
                                "max-w-[85%] rounded-3xl px-4 py-3 shadow-sm",
                                isOwn ? "bg-primary text-primary-foreground" : "border border-border/70 bg-background",
                              )}
                            >
                              <div
                                className={cn(
                                  "mb-2 flex flex-wrap items-center gap-2 text-xs",
                                  isOwn ? "text-primary-foreground/85" : "text-muted-foreground",
                                )}
                              >
                                <Badge
                                  variant={message.sender_role === "community_health_worker" ? "default" : "secondary"}
                                  className="shadow-none"
                                >
                                  {roleLabel(message.sender_role as CareRole)}
                                </Badge>
                                <span className="font-medium">{message.sender_name}</span>
                                <span>{formatMessageTime(message.created_at)}</span>
                              </div>
                              <p className="whitespace-pre-wrap text-sm leading-6">{message.message}</p>
                            </div>
                          </div>
                        );
                      })}
                      <div ref={messageEndRef} />
                    </div>
                  )}
                </div>

                <div className="border-t border-border/60 px-6 py-5">
                  {!canSendRealtime && (
                    <div className="mb-3 flex items-start gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/5 px-4 py-3 text-sm text-muted-foreground">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                      <span>{selectedTarget.name} needs to be active in Care Chat for live messaging and video to work.</span>
                    </div>
                  )}

                  <form className="flex flex-col gap-3" onSubmit={(event) => void handleSendMessage(event)}>
                    <Textarea
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      onKeyDown={handleDraftKeyDown}
                      disabled={!selectedTarget}
                      placeholder={
                        canSendRealtime
                          ? `Message ${selectedTarget.name}...`
                          : "Waiting for the other person to come online in Care Chat..."
                      }
                      className="min-h-[120px] rounded-3xl border-border/80 px-4 py-3"
                    />

                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-sm text-muted-foreground">
                        {isRoomConnected ? "Realtime room connected." : "Connecting to the realtime room..."}
                      </p>

                      <Button
                        type="submit"
                        className="rounded-full gap-2 px-5"
                        disabled={!draft.trim() || !canSendRealtime}
                      >
                        <Send className="h-4 w-4" />
                        Send Live Message
                      </Button>
                    </div>
                  </form>
                </div>
              </>
            ) : (
              <div className="flex h-full flex-col items-center justify-center px-6 py-10 text-center text-muted-foreground">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                  <MessageSquare className="h-7 w-7 text-primary" />
                </div>
                <h2 className="text-2xl font-medium text-foreground">No active care thread yet</h2>
                <p className="mt-2 max-w-2xl">
                  {availabilityMessage || "Select a linked health worker or patient to open the direct realtime care workspace."}
                </p>
              </div>
            )}
          </section>
        </div>
      </div>

      <CareVideoCallDialog
        open={callPhase !== "idle"}
        phase={callPhase}
        participantName={incomingCall?.callerName || selectedTarget?.name || "Care contact"}
        participantRoleLabel={roleLabel(incomingCall?.callerRole || selectedTarget?.role || "community_health_worker")}
        localVideoRef={localVideoRef}
        remoteVideoRef={remoteVideoRef}
        durationSeconds={callDuration}
        isMicMuted={isMicMuted}
        isCameraOff={isCameraOff}
        onAccept={() => void acceptIncomingCall()}
        onDecline={declineIncomingCall}
        onHangup={hangupCall}
        onClose={closeCallDialog}
        onToggleMic={toggleMicrophone}
        onToggleCamera={toggleCamera}
      />
    </>
  );
}

function buildRoomId(firstUserId: number, secondUserId: number) {
  const [smallestId, largestId] = [firstUserId, secondUserId].sort((left, right) => left - right);
  return `care-room-${smallestId}-${largestId}`;
}

function buildCareSocketUrl(roomId: string, token: string) {
  const explicitBase = import.meta.env.VITE_WS_BASE || import.meta.env.VITE_API_BASE || window.location.origin;
  const base = new URL(explicitBase, window.location.origin);
  const protocol = base.protocol === "https:" ? "wss:" : "ws:";
  const wsUrl = new URL(`${protocol}//${base.host}/ws/care`);
  wsUrl.searchParams.set("room_id", roomId);
  wsUrl.searchParams.set("token", token);
  return wsUrl.toString();
}

function roleLabel(role: CareRole) {
  return role === "community_health_worker" ? "Health Worker" : "Patient";
}

function formatMessageTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function riskBadgeClasses(level: string) {
  switch (level) {
    case "high":
      return "bg-destructive/10 text-destructive border-destructive/20";
    case "medium":
      return "bg-amber-500/10 text-amber-700 border-amber-500/20";
    default:
      return "bg-sage/20 text-foreground border-border";
  }
}
