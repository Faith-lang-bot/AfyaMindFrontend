import { useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

const moodLabels = ["", "Very Low", "Low", "Below Avg", "Slightly Low", "Neutral", "Okay", "Good", "Great", "Very Good", "Excellent"];

export default function Checkin() {
  const { toast } = useToast();
  const [mood, setMood] = useState(5);
  const [stress, setStress] = useState(4);
  const [anxiety, setAnxiety] = useState(4);
  const [sleep, setSleep] = useState(7);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const res = await api.createCheckin({ mood, stress, anxiety, sleep_hours: sleep, note });
      setResult(res);
      toast({ title: "Check-in recorded!", description: `Risk level: ${res.risk_level}` });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (result) {
    return (
      <div className="animate-fade-in flex flex-col gap-8">
        <h1 className="text-4xl tracking-tight">Check-in Complete</h1>
        <div className="card-elevated p-10 flex flex-col gap-6">
          <div className="flex items-center gap-4">
            <div className={`w-4 h-4 rounded-full ${
              result.risk_level === "low" ? "bg-sage" : result.risk_level === "medium" ? "bg-sun" : "bg-destructive"
            }`} />
            <span className="text-lg font-medium capitalize">{result.risk_level} Risk</span>
          </div>
          {result.reward_points !== undefined && (
            <p className="text-muted-foreground">You earned points! Total: {result.reward_points}</p>
          )}
          <Button onClick={() => setResult(null)} variant="outline" className="rounded-2xl w-fit">
            New Check-in
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in flex flex-col gap-8">
      <header>
        <h1 className="text-4xl tracking-tight">Daily Check-in</h1>
        <p className="text-muted-foreground mt-2">Take a moment to notice how you're feeling right now.</p>
      </header>

      <div className="card-elevated p-10 flex flex-col gap-8">
        <SliderField label={`Mood: ${moodLabels[mood]}`} value={mood} onChange={setMood} min={1} max={10} />
        <SliderField label={`Stress Level: ${stress}/10`} value={stress} onChange={setStress} min={0} max={10} />
        <SliderField label={`Anxiety Level: ${anxiety}/10`} value={anxiety} onChange={setAnxiety} min={0} max={10} />
        <SliderField label={`Sleep: ${sleep} hours`} value={sleep} onChange={setSleep} min={0} max={12} step={0.5} />

        <div className="space-y-2">
          <Label>Notes (optional)</Label>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="How are you feeling today? Any thoughts you'd like to share..."
            className="rounded-2xl min-h-[120px] resize-none"
          />
        </div>

        <Button onClick={handleSubmit} disabled={loading} className="rounded-2xl h-12 text-base w-full md:w-auto md:self-end md:px-12">
          {loading ? "Recording..." : "Record Check-in"}
        </Button>
      </div>
    </div>
  );
}

function SliderField({ label, value, onChange, min, max, step = 1 }: {
  label: string; value: number; onChange: (v: number) => void; min: number; max: number; step?: number;
}) {
  return (
    <div className="space-y-3">
      <Label className="text-base">{label}</Label>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-primary h-2 rounded-full appearance-none bg-secondary cursor-pointer
          [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 
          [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:cursor-pointer
          [&::-webkit-slider-thumb]:shadow-[0_2px_6px_rgba(0,0,0,0.15)]"
      />
    </div>
  );
}
