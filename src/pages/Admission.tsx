import { useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, HeartPulse, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import {
  admissionSections,
  focusLabel,
  kesslerOptions,
  markAdmissionComplete,
  mdqImpairmentOptions,
  recommendationHeadline,
  saveCarePlan,
  severityLabel,
  statusLabelForPlan,
  totalAdmissionQuestions,
  type CarePlan,
} from "@/lib/wellness";

const totalQuestions = totalAdmissionQuestions();

export default function Admission() {
  const { user, isUser } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [step, setStep] = useState(0);
  const [phq9Answers, setPHQ9Answers] = useState<number[]>(Array(9).fill(-1));
  const [gad7Answers, setGAD7Answers] = useState<number[]>(Array(7).fill(-1));
  const [pcl5Answers, setPCL5Answers] = useState<number[]>(Array(20).fill(-1));
  const [kesslerAnswers, setKesslerAnswers] = useState<number[]>(Array(10).fill(0));
  const [mdqAnswers, setMDQAnswers] = useState<Array<boolean | null>>(Array(13).fill(null));
  const [auditAnswers, setAUDITAnswers] = useState<number[]>(Array(10).fill(-1));
  const [cssrsAnswers, setCSSRSAnswers] = useState<Array<boolean | null>>(Array(6).fill(null));
  const [mdqConcurrent, setMDQConcurrent] = useState<boolean | null>(null);
  const [mdqImpairment, setMDQImpairment] = useState<number>(-1);
  const [note, setNote] = useState("");
  const [primaryConcern, setPrimaryConcern] = useState("");
  const [safetyContactNumber, setSafetyContactNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CarePlan | null>(null);

  const steps = useMemo(
    () => [
      {
        key: "phq9",
        title: admissionSections[0].title,
        description: admissionSections[0].description,
        questions: admissionSections[0].questions,
        options: admissionSections[0].options,
        answers: phq9Answers,
        onAnswer: (index: number, value: number | boolean) => setPHQ9Answers((current) => updateNumberArray(current, index, value as number)),
      },
      {
        key: "gad7",
        title: admissionSections[1].title,
        description: admissionSections[1].description,
        questions: admissionSections[1].questions,
        options: admissionSections[1].options,
        answers: gad7Answers,
        onAnswer: (index: number, value: number | boolean) => setGAD7Answers((current) => updateNumberArray(current, index, value as number)),
      },
      {
        key: "pcl5",
        title: admissionSections[2].title,
        description: admissionSections[2].description,
        questions: admissionSections[2].questions,
        options: admissionSections[2].options,
        answers: pcl5Answers,
        onAnswer: (index: number, value: number | boolean) => setPCL5Answers((current) => updateNumberArray(current, index, value as number)),
      },
      {
        key: "kessler",
        title: admissionSections[3].title,
        description: admissionSections[3].description,
        questions: admissionSections[3].questions,
        options: kesslerOptions,
        answers: kesslerAnswers,
        onAnswer: (index: number, value: number | boolean) => setKesslerAnswers((current) => updateNumberArray(current, index, value as number)),
      },
      {
        key: "mdq",
        title: admissionSections[4].title,
        description: admissionSections[4].description,
        questions: admissionSections[4].questions,
        options: admissionSections[4].options,
        answers: mdqAnswers,
        onAnswer: (index: number, value: number | boolean) => setMDQAnswers((current) => updateBooleanArray(current, index, value as boolean)),
      },
      {
        key: "audit",
        title: admissionSections[5].title,
        description: admissionSections[5].description,
        questions: admissionSections[5].questions,
        options: admissionSections[5].options,
        answers: auditAnswers,
        onAnswer: (index: number, value: number | boolean) => setAUDITAnswers((current) => updateNumberArray(current, index, value as number)),
      },
      {
        key: "cssrs",
        title: admissionSections[6].title,
        description: admissionSections[6].description,
        questions: admissionSections[6].questions,
        options: admissionSections[6].options,
        answers: cssrsAnswers,
        onAnswer: (index: number, value: number | boolean) => setCSSRSAnswers((current) => updateBooleanArray(current, index, value as boolean)),
      },
      {
        key: "context",
        title: "Context and safety",
        description: "Add any context that should shape the support plan and share a safety contact if you want fast outreach.",
      },
    ],
    [auditAnswers, cssrsAnswers, gad7Answers, kesslerAnswers, mdqAnswers, pcl5Answers, phq9Answers],
  );

  const answeredCount = useMemo(() => {
    const numericAnswered = [phq9Answers, gad7Answers, pcl5Answers, auditAnswers].reduce(
      (sum, arr) => sum + arr.filter((value) => value >= 0).length,
      0,
    );
    const kesslerCount = kesslerAnswers.filter((value) => value >= 1).length;
    const mdqCount = mdqAnswers.filter((value) => typeof value === "boolean").length;
    const cssrsCount = cssrsAnswers.filter((value) => typeof value === "boolean").length;
    const extraCount = (mdqConcurrent !== null ? 1 : 0) + (mdqImpairment >= 0 ? 1 : 0);
    return numericAnswered + kesslerCount + mdqCount + cssrsCount + extraCount;
  }, [auditAnswers, cssrsAnswers, gad7Answers, kesslerAnswers, mdqAnswers, mdqConcurrent, mdqImpairment, pcl5Answers, phq9Answers]);

  const progressPercent = Math.round((answeredCount / totalQuestions) * 100);

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!isUser) {
    return <Navigate to="/dashboard" replace />;
  }

  const currentStep = steps[step];

  const canContinue = (() => {
    switch (currentStep.key) {
      case "phq9":
        return phq9Answers.every((value) => value >= 0);
      case "gad7":
        return gad7Answers.every((value) => value >= 0);
      case "pcl5":
        return pcl5Answers.every((value) => value >= 0);
      case "kessler":
        return kesslerAnswers.every((value) => value >= 1);
      case "mdq":
        return mdqConcurrent !== null && mdqImpairment >= 0;
      case "audit":
        return auditAnswers.every((value) => value >= 0);
      case "cssrs":
        return cssrsAnswers.every((value) => typeof value === "boolean");
      default:
        return true;
    }
  })();

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const response = await api.startAdmission({
        phq9_answers: phq9Answers,
        gad7_answers: gad7Answers,
        pcl5_answers: pcl5Answers,
        kessler_answers: kesslerAnswers,
        mdq_answers: mdqAnswers.map(Boolean),
        mdq_concurrent: Boolean(mdqConcurrent),
        mdq_impairment: Math.max(mdqImpairment, 0),
        audit_answers: auditAnswers,
        cssrs_answers: cssrsAnswers.map(Boolean),
        note,
        primary_concern: primaryConcern,
        safety_contact_number: safetyContactNumber,
      });

      const plan: CarePlan = {
        admissionId: response.admission_id,
        riskLevel: response.risk_level as CarePlan["riskLevel"],
        phq9Score: response.phq9_score,
        phq9Severity: response.phq9_severity,
        phq9RiskLevel: response.phq9_risk_level as CarePlan["phq9RiskLevel"],
        recommendationType: response.recommendation_type,
        recommendationMessage: response.recommendation_message,
        suggestedActions: response.suggested_actions,
        screenings: response.screenings,
        primaryFocuses: response.primary_focuses,
        recommendedExercises: response.recommended_exercises,
        progressLabel: response.progress_label,
        createdAt: response.created_at,
      };

      saveCarePlan(user.id, plan);
      markAdmissionComplete(user.id);
      setResult(plan);
      toast({
        title: "Mental health screening complete",
        description: `Status: ${statusLabelForPlan(plan)}`,
      });
    } catch (err: any) {
      toast({ title: "Unable to save screening", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (result) {
    return (
      <div className="animate-fade-in flex flex-col gap-8">
        <header className="flex flex-col gap-3">
          <div className="inline-flex w-fit items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary">
            <CheckCircle2 className="h-4 w-4" />
            Full screening complete
          </div>
          <h1 className="text-4xl tracking-tight">{statusLabelForPlan(result)}</h1>
          <p className="max-w-3xl text-muted-foreground">{recommendationHeadline(result)}</p>
        </header>

        <section className="card-elevated grid gap-6 p-8 lg:grid-cols-[1.1fr,0.9fr]">
          <div className="space-y-4">
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              {result.riskLevel === "high" ? <ShieldAlert className="h-4 w-4 text-destructive" /> : <HeartPulse className="h-4 w-4 text-primary" />}
              PHQ-9 score {result.phq9Score} · {severityLabel(result.phq9Severity)}
            </div>
            <p className="text-lg leading-8">{result.recommendationMessage}</p>
            <div className="flex flex-wrap gap-2">
              {result.primaryFocuses.map((focus) => (
                <span key={focus} className="rounded-full bg-secondary px-4 py-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  {focusLabel(focus)}
                </span>
              ))}
            </div>
            <div className="space-y-3">
              {result.screenings.map((screening) => (
                <div key={screening.key} className="rounded-2xl border border-border/60 bg-background/80 px-4 py-3 text-sm">
                  <div className="font-medium">{screening.title}</div>
                  <div className="mt-1 text-muted-foreground">
                    Score {screening.score}/{screening.max_score} · {severityLabel(screening.level)}
                  </div>
                  <div className="mt-2 text-muted-foreground">{screening.summary}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[28px] border border-primary/15 bg-gradient-to-br from-primary/10 via-background to-sage/20 p-6">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-background px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
              Next Step
            </div>
            <p className="text-lg">
              {result.riskLevel === "high"
                ? "Use guided care first, contact a CHW or trusted supporter, and do not stay alone if you feel unsafe."
                : result.riskLevel === "medium"
                  ? "Use one of the matched exercises today and follow up with a CHW or therapist this week."
                  : "Start with the matched exercises below, keep checking in, and reach out early if symptoms worsen."}
            </p>
            <div className="mt-5 space-y-3">
              {result.recommendedExercises.map((exercise) => (
                <div key={exercise.key} className="rounded-2xl border border-border/60 bg-background/75 px-4 py-3">
                  <div className="font-medium">{exercise.title}</div>
                  <div className="text-sm text-muted-foreground mt-1">{exercise.duration} · {focusLabel(exercise.focus)}</div>
                  <div className="text-sm text-muted-foreground mt-2">{exercise.description}</div>
                </div>
              ))}
            </div>
            <Button onClick={() => navigate("/dashboard")} className="mt-6 rounded-2xl h-12 w-full">
              Continue to your care plan
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="animate-fade-in flex flex-col gap-8">
      <header className="space-y-3">
        <div className="inline-flex w-fit items-center gap-2 rounded-full bg-secondary px-4 py-2 text-sm text-muted-foreground">
          <AlertTriangle className="h-4 w-4" />
          One-time onboarding assessment
        </div>
        <h1 className="text-4xl tracking-tight">Initial Mental Health Assessment</h1>
        <p className="max-w-3xl text-muted-foreground">
          Complete this full screening once when your account is created so AfyaMind can build your starting care plan and matched exercises.
        </p>
      </header>

      <section className="card-elevated space-y-8 p-8">
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>{currentStep.title}</span>
            <span>{progressPercent}% complete</span>
          </div>
          <div className="h-3 rounded-full bg-secondary/80 overflow-hidden">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progressPercent}%` }} />
          </div>
          <div className="text-sm text-muted-foreground">
            Step {step + 1}/{steps.length} · {answeredCount}/{totalQuestions} answers captured
          </div>
        </div>

        <div className="rounded-[28px] border border-border/70 bg-background/80 p-6">
          <h2 className="text-2xl tracking-tight">{currentStep.title}</h2>
          <p className="mt-2 text-muted-foreground">{currentStep.description}</p>

          {currentStep.key !== "context" && "questions" in currentStep && currentStep.questions && (
            <div className="mt-6 space-y-6">
              {currentStep.questions.map((question, index) => (
                <div key={question.id} className="rounded-[24px] border border-border/70 bg-background/90 p-5">
                  <p className="mb-4 text-base font-medium">
                    {index + 1}. {question.prompt}
                  </p>
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    {currentStep.options.map((option) => {
                      const selectedValue = currentStep.answers[index];
                      const isSelected = selectedValue === option.value;

                      return (
                        <button
                          key={`${question.id}-${String(option.value)}`}
                          type="button"
                          onClick={() => currentStep.onAnswer(index, option.value)}
                          className={`rounded-2xl border px-4 py-3 text-left text-sm transition-all ${
                            isSelected
                              ? "border-primary bg-primary/10 text-foreground"
                              : "border-border bg-card hover:border-primary/30"
                          }`}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}

              {currentStep.key === "mdq" && (
                <div className="grid gap-6 lg:grid-cols-2">
                  <div className="rounded-[24px] border border-border/70 bg-background/90 p-5">
                    <p className="mb-4 font-medium">Did several of these happen during the same period of time?</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {admissionSections[4].options.map((option) => (
                        <button
                          key={`mdq-concurrent-${String(option.value)}`}
                          type="button"
                          onClick={() => setMDQConcurrent(option.value as boolean)}
                          className={`rounded-2xl border px-4 py-3 text-left text-sm transition-all ${
                            mdqConcurrent === option.value
                              ? "border-primary bg-primary/10 text-foreground"
                              : "border-border bg-card hover:border-primary/30"
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-[24px] border border-border/70 bg-background/90 p-5">
                    <p className="mb-4 font-medium">How much of a problem did these experiences cause?</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {mdqImpairmentOptions.map((option) => (
                        <button
                          key={`mdq-impairment-${option.value}`}
                          type="button"
                          onClick={() => setMDQImpairment(option.value)}
                          className={`rounded-2xl border px-4 py-3 text-left text-sm transition-all ${
                            mdqImpairment === option.value
                              ? "border-primary bg-primary/10 text-foreground"
                              : "border-border bg-card hover:border-primary/30"
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {currentStep.key === "context" && (
            <div className="mt-6 grid gap-5">
              <div className="space-y-2">
                <p className="text-sm font-medium">What feels like the main issue right now?</p>
                <Input
                  value={primaryConcern}
                  onChange={(event) => setPrimaryConcern(event.target.value)}
                  className="h-12 rounded-2xl"
                  placeholder="Examples: panic, trauma reminders, low mood, sleep, alcohol cravings"
                />
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Safety contact number</p>
                <Input
                  value={safetyContactNumber}
                  onChange={(event) => setSafetyContactNumber(event.target.value)}
                  className="h-12 rounded-2xl"
                  placeholder="+2547..."
                />
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Anything else you want your support plan to consider?</p>
                <Textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  className="min-h-[140px] rounded-3xl"
                  placeholder="Optional context about sleep, triggers, substance use, support system, or what feels hardest right now."
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => setStep((current) => Math.max(current - 1, 0))}
            disabled={step === 0 || loading}
            className="rounded-2xl h-12"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>

          {step < steps.length - 1 ? (
            <Button
              type="button"
              onClick={() => setStep((current) => Math.min(current + 1, steps.length - 1))}
              disabled={!canContinue || loading}
              className="rounded-2xl h-12 px-8"
            >
              Next section
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={loading} className="rounded-2xl h-12 px-8">
              {loading ? "Saving your screening..." : "Finish screening"}
            </Button>
          )}
        </div>
      </section>
    </div>
  );
}

function updateNumberArray(current: number[], index: number, value: number) {
  return current.map((item, itemIndex) => (itemIndex === index ? value : item));
}

function updateBooleanArray(current: Array<boolean | null>, index: number, value: boolean) {
  return current.map((item, itemIndex) => (itemIndex === index ? value : item));
}
