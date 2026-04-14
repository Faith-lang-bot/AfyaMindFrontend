import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

export default function Journal() {
  const { toast } = useToast();
  const [entry, setEntry] = useState("");
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.getJournal().then(setEntries).catch(console.error);
  }, []);

  const handleSubmit = async () => {
    if (!entry.trim()) return;
    setLoading(true);
    try {
      await api.createJournal({ entry });
      toast({ title: "Journal entry saved" });
      setEntry("");
      const updated = await api.getJournal();
      setEntries(updated);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-fade-in flex flex-col gap-8">
      <header>
        <h1 className="text-4xl tracking-tight">Journal</h1>
        <p className="text-muted-foreground mt-2">A safe space to write your thoughts.</p>
      </header>

      <div className="card-elevated p-8 flex flex-col gap-4">
        <Textarea
          value={entry}
          onChange={(e) => setEntry(e.target.value)}
          placeholder="What's on your mind today..."
          className="rounded-2xl min-h-[160px] resize-none"
        />
        <Button onClick={handleSubmit} disabled={loading || !entry.trim()} className="rounded-2xl h-11 self-end px-8">
          {loading ? "Saving..." : "Save Entry"}
        </Button>
      </div>

      <div className="flex flex-col gap-4">
        {entries.map((e: any) => (
          <div key={e.id} className="card-elevated p-6">
            <p className="text-xs text-muted-foreground mb-2 font-medium">
              {new Date(e.created_at).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
            </p>
            <p className="text-foreground whitespace-pre-wrap">{e.entry}</p>
          </div>
        ))}
        {entries.length === 0 && (
          <p className="text-muted-foreground text-center py-8">No journal entries yet. Start writing above!</p>
        )}
      </div>
    </div>
  );
}
