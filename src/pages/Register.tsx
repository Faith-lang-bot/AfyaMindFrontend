import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Phone } from "lucide-react";
import { hasCompletedAdmission, languageOptions } from "@/lib/wellness";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("mental_health_user");
  const [language, setLanguage] = useState("en");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (role === "mental_health_user" && !phone.trim()) {
      setError("Phone number is required for patient SMS reminders and motivation.");
      return;
    }
    setLoading(true);
    try {
      const authUser = await register(name, email, phone.trim(), password, language, role);
      const nextPath =
        authUser.role === "mental_health_user" && !hasCompletedAdmission(authUser.id)
          ? "/admission"
          : "/dashboard";
      navigate(nextPath);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md animate-fade-in">
        <div className="text-center mb-10">
          <h1 className="text-4xl tracking-tight text-foreground">Join AfyaMind</h1>
          <p className="text-muted-foreground mt-2">Begin your wellness journey today.</p>
        </div>

        <div className="card-elevated p-10">
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" required className="rounded-2xl h-12" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required className="rounded-2xl h-12" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <div className="relative">
                <Phone className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+254712345678"
                  required={role === "mental_health_user"}
                  className="rounded-2xl h-12 pl-11"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" required className="rounded-2xl h-12" />
            </div>

            <div className="space-y-3">
              <Label>Preferred language</Label>
              <div className="grid grid-cols-2 gap-3">
                {languageOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setLanguage(option.value)}
                    className={`rounded-2xl border px-4 py-3 text-left text-sm transition-all ${
                      language === option.value
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/30"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Role Selection */}
            <div className="space-y-3">
              <Label>I am a...</Label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setRole("mental_health_user")}
                  className={`p-4 rounded-2xl border-2 text-left transition-all ${
                    role === "mental_health_user"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/30"
                  }`}
                >
                  <div className="text-2xl mb-2">🧘</div>
                  <div className="font-medium text-sm">Person seeking care</div>
                  <div className="text-xs text-muted-foreground mt-1">Track mood, journal, and get support</div>
                </button>
                <button
                  type="button"
                  onClick={() => setRole("community_health_worker")}
                  className={`p-4 rounded-2xl border-2 text-left transition-all ${
                    role === "community_health_worker"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/30"
                  }`}
                >
                  <div className="text-2xl mb-2">💚</div>
                  <div className="font-medium text-sm">Community Health Worker</div>
                  <div className="text-xs text-muted-foreground mt-1">Monitor and support patients</div>
                </button>
              </div>
            </div>

            {error && (
              <p className="text-sm text-destructive bg-destructive/10 px-4 py-2 rounded-xl">{error}</p>
            )}

            <Button type="submit" disabled={loading} className="rounded-2xl h-12 text-base">
              {loading ? "Creating account..." : "Create Account"}
            </Button>
          </form>
        </div>

        <p className="text-center text-sm text-muted-foreground mt-6">
          Already have an account?{" "}
          <Link to="/login" className="text-primary font-medium hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
