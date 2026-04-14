import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Gift, Star } from "lucide-react";

export default function Rewards() {
  const { toast } = useToast();
  const [rewards, setRewards] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.getRewards().then(setRewards).catch(console.error);
  }, []);

  const handleRedeem = async (points: number) => {
    setLoading(true);
    try {
      const res = await api.redeemRewards(points);
      setRewards(res);
      toast({ title: "Points redeemed!", description: `Remaining: ${res.points}` });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-fade-in flex flex-col gap-8">
      <header>
        <h1 className="text-4xl tracking-tight">Rewards</h1>
        <p className="text-muted-foreground mt-2">Earn points by taking care of yourself.</p>
      </header>

      <div className="card-elevated p-10 bg-gradient-to-b from-sun/30 to-card flex items-center gap-6">
        <div className="w-16 h-16 rounded-3xl bg-sun/50 flex items-center justify-center">
          <Star className="h-8 w-8 text-foreground" />
        </div>
        <div>
          <div className="text-5xl font-serif tracking-tight">{rewards?.points ?? "—"}</div>
          <div className="text-muted-foreground">Total Points</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { name: "Wellness Badge", cost: 50, icon: "🏅" },
          { name: "Extra Session", cost: 100, icon: "📅" },
          { name: "Gift Card", cost: 200, icon: "🎁" },
        ].map((item) => (
          <div key={item.name} className="card-elevated p-6 flex flex-col items-center text-center gap-3">
            <span className="text-3xl">{item.icon}</span>
            <h3 className="font-medium">{item.name}</h3>
            <p className="text-sm text-muted-foreground">{item.cost} points</p>
            <Button
              onClick={() => handleRedeem(item.cost)}
              disabled={loading || (rewards?.points ?? 0) < item.cost}
              variant="outline"
              className="rounded-2xl mt-2"
            >
              Redeem
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
