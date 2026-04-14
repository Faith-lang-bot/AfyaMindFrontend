import { useEffect, useMemo, useState } from "react";
import { api, type CommunityMessage } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

const rooms = ["general", "anxiety", "depression", "wellness", "caregivers"];

export default function Community() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [room, setRoom] = useState("general");
  const [messages, setMessages] = useState<CommunityMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.getCommunityMessages(room).then(setMessages).catch(console.error);
  }, [room]);

  const orderedMessages = useMemo(
    () =>
      [...messages].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      ),
    [messages],
  );

  const handleSend = async () => {
    if (!newMessage.trim()) return;
    setLoading(true);
    try {
      await api.createCommunityMessage({ room, message: newMessage });
      setNewMessage("");
      const updated = await api.getCommunityMessages(room);
      setMessages(updated);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-fade-in flex flex-col gap-6 h-[calc(100vh-7rem)]">
      <header>
        <h1 className="text-4xl tracking-tight">Community</h1>
        <p className="text-muted-foreground mt-2">Connect with others on similar journeys.</p>
      </header>

      {/* Room tabs */}
      <div className="flex gap-2 flex-wrap">
        {rooms.map((r) => (
          <button
            key={r}
            onClick={() => setRoom(r)}
            className={`px-4 py-2 rounded-2xl text-sm font-medium transition-all capitalize ${
              room === r ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:bg-secondary/80"
            }`}
          >
            {r}
          </button>
        ))}
      </div>

      {/* Messages */}
      <div className="card-elevated flex-1 overflow-y-auto p-6 flex flex-col gap-3">
        {orderedMessages.length === 0 && (
          <p className="text-center text-muted-foreground py-8">No messages yet. Start the conversation!</p>
        )}
        {orderedMessages.map((message) => {
          const isCurrentUser =
            message.user_id === user?.id ||
            (!message.user_id &&
              message.name?.trim().toLowerCase() === user?.name?.trim().toLowerCase());

          return (
          <div key={message.id} className={`flex flex-col gap-1 ${isCurrentUser ? "items-end" : "items-start"}`}>
            <div className={`px-4 py-3 rounded-2xl max-w-[80%] ${
              isCurrentUser ? "bg-primary/10 text-foreground" : "bg-secondary text-foreground"
            }`}>
              <p className="text-xs font-medium text-muted-foreground mb-1">
                {message.user_name || message.name || "User"}
              </p>
              <p className="text-sm">{message.message}</p>
              <p className="text-[11px] text-muted-foreground mt-2">
                {formatTime(message.created_at)}
              </p>
            </div>
          </div>
          );
        })}
      </div>

      {/* Input */}
      <div className="flex gap-3">
        <Input
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type a message..."
          className="rounded-2xl h-12 flex-1"
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
        />
        <Button onClick={handleSend} disabled={loading || !newMessage.trim()} className="rounded-2xl h-12 px-6">
          Send
        </Button>
      </div>
    </div>
  );
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}
