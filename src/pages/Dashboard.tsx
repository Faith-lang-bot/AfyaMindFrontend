import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  Brain,
  Calendar,
  FileDown,
  Gift,
  Heart,
  MessageCircle,
  ShieldAlert,
  Sparkles,
  Users,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { api, type DashboardSummary, type CertificateResponse } from "@/lib/api";
import { downloadCertificatePdf } from "@/lib/certificate";
import {
  getCarePlan,
  getSessionProgress,
  quickExercises,
  recommendationHeadline,
  saveSessionProgress,
  sessionTasks,
  severityLabel,
  statusLabelForPlan,
  isSessionComplete,
  type CarePlan,
  type SessionProgress,
} from "@/lib/wellness";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export default function Dashboard() {
  const { user, isUser } = useAuth();
  const { toast } = useToast();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [carePlan, setCarePlan] = useState<CarePlan | null>(null);
  const [progress, setProgress] = useState<SessionProgress>(getSessionProgress(user?.id));
  const [certificateName, setCertificateName] = useState(user?.name || "");
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    api.getDashboardSummary().then(setSummary).catch(console.error);
  }, []);

  useEffect(() => {
    setCertificateName(user?.name || "");
    setCarePlan(getCarePlan(user?.id));
    setProgress(getSessionProgress(user?.id));
  }, [user?.id, user?.name]);

  const statCards = summary ? (
    isUser
      ? [
          {
            icon: <Heart className="h-5 w-5" />,
            label: "Check-ins",
            value: summary.total_checkins || 0,
            color: "bg-clay/20 text-clay-foreground",
          },
          {
            icon: <Calendar className="h-5 w-5" />,
            label: "Appointments",
            value: summary.total_appointments || 0,
            color: "bg-sage/20 text-sage-foreground",
          },
          {
            icon: <MessageCircle className="h-5 w-5" />,
            label: "Community",
            value: summary.total_community_messages || 0,
            color: "bg-sun/40 text-sun-foreground",
          },
          {
            icon: <Gift className="h-5 w-5" />,
            label: "Points",
            value: summary.points || 0,
            color: "bg-primary/10 text-foreground",
          },
        ]
      : [
          {
            icon: <Users className="h-5 w-5" />,
            label: "Patients",
            value: summary.total_checkins || 0,
            color: "bg-clay/20 text-clay-foreground",
          },
          {
            icon: <AlertTriangle className="h-5 w-5" />,
            label: "High Risk",
            value: summary.total_risk_events || 0,
            color: "bg-destructive/10 text-destructive",
          },
          {
            icon: <Calendar className="h-5 w-5" />,
            label: "Appointments",
            value: summary.total_appointments || 0,
            color: "bg-sage/20 text-sage-foreground",
          },
          {
            icon: <MessageCircle className="h-5 w-5" />,
            label: "Community",
            value: summary.total_community_messages || 0,
            color: "bg-sun/40 text-sun-foreground",
          },
        ]
  ) : [];

  const tasks = useMemo(() => sessionTasks(carePlan), [carePlan]);
  const sessionComplete = isSessionComplete(carePlan, progress);

  const updateProgress = (changes: Partial<SessionProgress>) => {
    if (!user?.id) return;
    const nextProgress = {
      ...progress,
      ...changes,
      updatedAt: new Date().toISOString(),
    };
    setProgress(nextProgress);
    saveSessionProgress(user.id, nextProgress);
  };

  const handleGenerateCertificate = async () => {
    if (!sessionComplete) return;
    setGenerating(true);
    try {
      const certificate: CertificateResponse = await api.generateCertification();
      downloadCertificatePdf({
        recipientName: certificateName,
        status: certificate.status,
        summary: certificate.summary,
        sessionDate: certificate.created_at,
      });
      toast({
        title: "Certificate ready",
        description: "Your wellness session certificate was downloaded as a PDF.",
      });
    } catch (err: any) {
      toast({ title: "Certificate failed", description: err.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="flex flex-col gap-10 animate-fade-in">
      <header>
        <span className="text-sm font-medium text-muted-foreground tracking-wide uppercase">{today}</span>
        <h1 className="text-4xl lg:text-5xl tracking-tight mt-3">
          Good {getTimeOfDay()}, {user?.name?.split(" ")[0]}.
          <br />
          <span className="text-muted-foreground">
            {isUser ? "Your wellness plan is ready for today." : "Your patients need you."}
          </span>
        </h1>
      </header>

      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((card) => (
            <StatCard key={card.label} icon={card.icon} label={card.label} value={card.value} color={card.color} />
          ))}
        </div>
      )}

      {isUser && (
        <section className="grid gap-6 lg:grid-cols-[1.15fr,0.85fr]">
          <div className="card-elevated overflow-hidden">
            <div className="bg-gradient-to-r from-clay/20 via-primary/10 to-sage/15 p-8">
              <div className="inline-flex items-center gap-2 rounded-full bg-background/80 px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                {carePlan?.riskLevel === "high" ? <ShieldAlert className="h-4 w-4 text-destructive" /> : <Brain className="h-4 w-4 text-primary" />}
                Current status
              </div>
              <h2 className="mt-4 text-3xl tracking-tight">{statusLabelForPlan(carePlan)}</h2>
              <p className="mt-3 max-w-2xl text-muted-foreground">{recommendationHeadline(carePlan)}</p>
              {carePlan && (
                <div className="mt-5 flex flex-wrap gap-3 text-sm text-muted-foreground">
                  <span className="rounded-full bg-background/80 px-4 py-2">PHQ-9 score: {carePlan.phq9Score}</span>
                  <span className="rounded-full bg-background/80 px-4 py-2">Severity: {severityLabel(carePlan.phq9Severity)}</span>
                </div>
              )}
            </div>

            <div className="grid gap-4 p-8">
              <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Recommended path</p>
              {(carePlan?.suggestedActions || [
                "Complete your PHQ-9 intake to unlock the right support path.",
                "Use the AI companion for guided exercises.",
                "Reach out early if symptoms worsen.",
              ]).map((action) => (
                <div key={action} className="rounded-2xl border border-border/70 bg-background/70 px-4 py-4 text-sm">
                  {action}
                </div>
              ))}
            </div>
          </div>

          <div className="card-elevated p-8">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="text-2xl tracking-tight">Recommended next move</h2>
                <p className="text-sm text-muted-foreground">
                  {carePlan?.riskLevel === "high"
                    ? "Go for guidance first, then talk to a CHW or trusted supporter."
                    : carePlan?.riskLevel === "medium"
                      ? "Chat with a CHW and add one short exercise today."
                      : "Take a short exercise and stay consistent with check-ins."}
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-3">
              <QuickLinkCard
                href={carePlan?.riskLevel === "high" ? "/resources" : "/ai-chat"}
                title={carePlan?.riskLevel === "high" ? "Open guided care" : "Open AI companion"}
                description={carePlan?.riskLevel === "high" ? "Start the most supportive path immediately." : "Use a guided conversation in your chosen language."}
              />
              <QuickLinkCard
                href="/community"
                title="Chat with support"
                description="Join community support or follow up with a CHW conversation."
              />
              <QuickLinkCard
                href="/directory"
                title="Find CHW support"
                description="Browse community health workers and connect the right person."
              />
            </div>
          </div>
        </section>
      )}

      {isUser && (
        <section className="grid gap-6 lg:grid-cols-[1fr,1fr]">
          <div className="card-elevated p-8">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-2xl tracking-tight">Session tracker</h2>
                <p className="text-sm text-muted-foreground">
                  Mark each part of your support session as you complete it.
                </p>
              </div>
              <span className="rounded-full bg-secondary px-4 py-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                {tasks.filter((task) => progress[task.key as keyof SessionProgress] === true).length}/{tasks.length || 0} complete
              </span>
            </div>

            <div className="mt-6 space-y-4">
              {tasks.map((task) => (
                <div key={task.key} className="rounded-[28px] border border-border/70 bg-background/70 p-5">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="font-medium">{task.title}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{task.description}</p>
                    </div>
                    <div className="flex gap-3">
                      <Link
                        to={task.href}
                        className="inline-flex h-11 items-center justify-center rounded-2xl border border-border px-4 text-sm font-medium transition-colors hover:border-primary/30"
                      >
                        Open
                      </Link>
                      <Button
                        type="button"
                        variant={progress[task.key as keyof SessionProgress] === true ? "secondary" : "default"}
                        className="h-11 rounded-2xl"
                        onClick={() => updateProgress({ [task.key]: !progress[task.key as keyof SessionProgress] } as Partial<SessionProgress>)}
                      >
                        {progress[task.key as keyof SessionProgress] === true ? "Completed" : "Mark done"}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6">
              <p className="mb-2 text-sm font-medium">Session reflection</p>
              <Textarea
                value={progress.reflection}
                onChange={(event) => updateProgress({ reflection: event.target.value })}
                className="min-h-[140px] rounded-3xl"
                placeholder="Write a short note about what helped, what still feels heavy, and your next step."
              />
            </div>
          </div>

          <div className="flex flex-col gap-6">
            <div className="card-elevated p-8">
              <h2 className="text-2xl tracking-tight">Short exercises</h2>
              <p className="mt-2 text-sm text-muted-foreground">Use one quick reset and then track it in your session.</p>
              <div className="mt-5 space-y-3">
                {quickExercises.map((exercise) => (
                  <div key={exercise.title} className="rounded-2xl border border-border/70 bg-background/70 px-4 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium">{exercise.title}</p>
                      <span className="rounded-full bg-secondary px-3 py-1 text-xs text-muted-foreground">{exercise.duration}</span>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">{exercise.description}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="card-elevated overflow-hidden">
              <div className="bg-gradient-to-br from-sun/35 via-background to-primary/10 p-8">
                <div className="inline-flex items-center gap-2 rounded-full bg-background/80 px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                  <FileDown className="h-4 w-4" />
                  Session certificate
                </div>
                <h2 className="mt-4 text-2xl tracking-tight">Generate your PDF certificate</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  After a full session, you can edit the name on the certificate and download a short PDF.
                </p>
              </div>

              <div className="p-8">
                <label className="mb-2 block text-sm font-medium">Certificate name</label>
                <Input
                  value={certificateName}
                  onChange={(event) => setCertificateName(event.target.value)}
                  className="h-12 rounded-2xl"
                  placeholder="Enter the name to show on the certificate"
                />
                <p className="mt-3 text-sm text-muted-foreground">
                  {sessionComplete
                    ? "Your session is complete. You can generate the certificate now."
                    : "Complete all tracked steps and write a reflection before generating the certificate."}
                </p>
                <Button
                  onClick={handleGenerateCertificate}
                  disabled={!sessionComplete || generating || !certificateName.trim()}
                  className="mt-5 h-12 rounded-2xl"
                >
                  {generating ? "Generating PDF..." : "Generate certificate PDF"}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </section>
      )}

      {summary?.last_risk_level && summary.last_risk_level !== "low" && isUser && (
        <div
          className={`card-elevated p-6 flex items-center gap-4 ${
            summary.last_risk_level === "high" ? "border-destructive/30 bg-destructive/5" : "border-accent bg-accent/30"
          }`}
        >
          <Brain className="h-6 w-6 text-foreground" />
          <div>
            <p className="font-medium">
              Your last risk level: <span className="capitalize">{summary.last_risk_level}</span>
            </p>
            <p className="text-sm text-muted-foreground">
              {summary.last_risk_level === "high"
                ? "Please use guided support right away and do not stay alone if you feel unsafe."
                : "Keep monitoring your wellness and continue your support plan."}
            </p>
          </div>
        </div>
      )}

      {isUser && summary && !summary.chw_linked && (
        <div className="card-elevated p-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-primary/20 bg-primary/5">
          <div>
            <p className="font-medium">You have not linked a Community Health Worker yet.</p>
            <p className="text-sm text-muted-foreground mt-1">
              Browse available CHWs and add one to your care team for follow-up support.
            </p>
          </div>
          <Link
            to="/directory"
            className="inline-flex h-11 items-center justify-center rounded-2xl bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Find CHW Support
          </Link>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <div className="card-elevated p-6 flex flex-col gap-3">
      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${color}`}>{icon}</div>
      <div>
        <div className="text-3xl font-serif tracking-tight">{value}</div>
        <div className="text-sm text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}

function QuickLinkCard({ href, title, description }: { href: string; title: string; description: string }) {
  return (
    <Link
      to={href}
      className="rounded-[28px] border border-border/70 bg-background/80 p-5 transition-all hover:border-primary/30 hover:shadow-[0_16px_30px_rgba(60,53,43,0.08)]"
    >
      <p className="font-medium">{title}</p>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
    </Link>
  );
}

function getTimeOfDay() {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}
