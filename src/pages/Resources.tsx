import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { api, type ResourceItem } from "@/lib/api";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  BookHeart,
  Brain,
  HeartHandshake,
  MoonStar,
  Sparkles,
  Wind,
} from "lucide-react";

type ResourceCategory = "depression" | "anxiety" | "stress" | "sleep" | "crisis";

type FeaturedResource = {
  category: ResourceCategory;
  title: string;
  summary: string;
  description: string;
  icon: typeof Brain;
  accent: string;
  features: string[];
  steps: string[];
};

const featuredResources: FeaturedResource[] = [
  {
    category: "depression",
    title: "Understanding Depression",
    summary: "Signs, support options, and recovery steps.",
    description:
      "A gentle overview of how depression can show up emotionally, mentally, and physically, plus what support can look like when daily life starts feeling heavier.",
    icon: Brain,
    accent: "bg-clay/20 text-clay-foreground",
    features: ["Mood and energy changes", "Support options", "Recovery-friendly routines"],
    steps: [
      "Notice patterns such as low energy, withdrawal, hopelessness, or loss of interest.",
      "Reduce pressure by choosing one small daily anchor like showering, stepping outside, or texting someone safe.",
      "Reach out to a health worker, trusted person, or clinician if symptoms keep building or your safety feels shaky.",
    ],
  },
  {
    category: "anxiety",
    title: "Grounding for Anxiety",
    summary: "Fast regulation techniques during panic.",
    description:
      "Short calming tools for moments when your thoughts are racing, your body feels on edge, or panic starts to rise quickly.",
    icon: Wind,
    accent: "bg-sun/40 text-sun-foreground",
    features: ["Panic interruption", "Breathing reset", "Sensory grounding"],
    steps: [
      "Name five things you can see, four you can touch, three you can hear, two you can smell, and one you can taste.",
      "Slow your breathing by exhaling longer than you inhale for one to two minutes.",
      "Shift attention to the present with a simple phrase like: I am safe enough in this moment.",
    ],
  },
  {
    category: "stress",
    title: "Stress Recovery Plan",
    summary: "Practical daily structure to reduce overload.",
    description:
      "A realistic way to lower overwhelm by making your day more predictable, protecting recovery time, and spotting what can wait.",
    icon: HeartHandshake,
    accent: "bg-sage/20 text-sage-foreground",
    features: ["Daily structure", "Overload reduction", "Energy protection"],
    steps: [
      "Choose the top one to three things that truly need your energy today.",
      "Build short recovery moments between tasks: water, stretching, a walk, or quiet breathing.",
      "Review what is draining you and move one non-urgent thing to another day.",
    ],
  },
  {
    category: "sleep",
    title: "Sleep Hygiene",
    summary: "Habits that improve sleep quality.",
    description:
      "Foundational routines that help your body wind down more consistently, especially when stress or racing thoughts are interfering with rest.",
    icon: MoonStar,
    accent: "bg-primary/10 text-foreground",
    features: ["Evening routine", "Restful environment", "Consistent timing"],
    steps: [
      "Keep bedtime and wake-up time as steady as possible, including weekends when you can.",
      "Reduce bright screens, caffeine, and intense activity in the hour before sleep.",
      "If your mind is busy, do a short brain-dump note so your thoughts do not have to stay active in bed.",
    ],
  },
  {
    category: "crisis",
    title: "Crisis Contacts",
    summary: "Immediate actions for suicidal or high-risk distress.",
    description:
      "A fast-response guide for moments when safety is at risk and immediate human support matters more than coping alone.",
    icon: AlertTriangle,
    accent: "bg-destructive/10 text-destructive",
    features: ["Immediate action steps", "Safety-first guidance", "Urgent support escalation"],
    steps: [
      "Move closer to another person or contact a trusted support immediately if you might act on suicidal thoughts.",
      "Use local emergency services or a crisis line right away if you are in immediate danger.",
      "Open Care Chat or contact your health worker now rather than trying to carry the moment alone.",
    ],
  },
];

export default function Resources() {
  const { isUser } = useAuth();
  const [apiResources, setApiResources] = useState<ResourceItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ignore = false;

    api
      .getResources()
      .then((items) => {
        if (!ignore) setApiResources(items);
      })
      .catch(() => {
        if (!ignore) setApiResources([]);
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, []);

  const categorizedExtras = useMemo(() => {
    const extras = new Map<ResourceCategory, ResourceItem[]>();

    for (const resource of apiResources) {
      const key = resource.category?.toLowerCase() as ResourceCategory;
      if (!featuredResources.some((item) => item.category === key)) continue;

      const existing = extras.get(key) ?? [];
      existing.push(resource);
      extras.set(key, existing);
    }

    return extras;
  }, [apiResources]);

  return (
    <div className="animate-fade-in flex flex-col gap-8">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-4xl tracking-tight">Resources</h1>
          <p className="text-muted-foreground mt-2">Helpful articles and guides for your wellness journey.</p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <ResourceStat value="5" label="Featured guides" />
          <ResourceStat value="Fast" label="Practical tools" />
          <ResourceStat value={loading ? "..." : String(apiResources.length)} label="Extra tips" />
        </div>
      </header>

      <div className="card-elevated overflow-hidden border-primary/10 bg-gradient-to-br from-primary/5 via-card to-sun/20">
        <div className="grid gap-6 px-6 py-7 lg:grid-cols-[1.15fr,0.85fr] lg:px-8">
          <div>
            <Badge className="mb-4 bg-background text-foreground shadow-sm">Wellness Library</Badge>
            <h2 className="text-2xl tracking-tight">Support that meets the moment you are in</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
              Explore focused guides on depression, anxiety, stress, sleep, and crisis support. Each one is designed
              to give you a quick understanding, a few concrete steps, and a clear next move when things feel heavy.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <SupportTile
              icon={Sparkles}
              title="Quick Techniques"
              description="Grounding, structure, and small next steps you can use right away."
            />
            <SupportTile
              icon={BookHeart}
              title="Guided Reading"
              description="Short explanations that make mental health topics easier to understand."
            />
            <SupportTile
              icon={HeartHandshake}
              title="Care Support"
              description="Move from self-help to human support when you need a real person involved."
            />
            <SupportTile
              icon={AlertTriangle}
              title="Crisis Escalation"
              description="Immediate actions when safety is the top priority."
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        {featuredResources.map((resource) => {
          const Icon = resource.icon;
          const extras = categorizedExtras.get(resource.category) ?? [];

          return (
            <article key={resource.category} className="card-elevated flex flex-col gap-5 p-6">
              <div className="flex items-start gap-4">
                <div className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl", resource.accent)}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="capitalize">
                      {resource.category}
                    </Badge>
                    {resource.category === "crisis" && (
                      <Badge variant="destructive">Urgent Support</Badge>
                    )}
                  </div>
                  <h2 className="mt-3 text-xl">{resource.title}</h2>
                  <p className="mt-2 text-sm text-muted-foreground">{resource.summary}</p>
                </div>
              </div>

              <p className="text-sm leading-6 text-muted-foreground">{resource.description}</p>

              <div className="flex flex-wrap gap-2">
                {resource.features.map((feature) => (
                  <span
                    key={feature}
                    className="rounded-full border border-border/70 bg-background px-3 py-1 text-xs text-muted-foreground"
                  >
                    {feature}
                  </span>
                ))}
              </div>

              <Accordion type="single" collapsible className="rounded-3xl border border-border/70 px-4">
                <AccordionItem value={resource.category} className="border-none">
                  <AccordionTrigger className="py-4 text-left hover:no-underline">
                    View guide steps
                  </AccordionTrigger>
                  <AccordionContent className="pb-4">
                    <div className="flex flex-col gap-3">
                      {resource.steps.map((step, index) => (
                        <div key={step} className="flex items-start gap-3">
                          <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-foreground">
                            {index + 1}
                          </div>
                          <p className="text-sm leading-6 text-muted-foreground">{step}</p>
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>

              {extras.length > 0 && (
                <div className="rounded-3xl border border-border/70 bg-background px-4 py-4">
                  <div className="text-sm font-medium">Extra resource notes</div>
                  <div className="mt-3 flex flex-col gap-3">
                    {extras.map((item, index) => (
                      <div key={`${item.title}-${index}`} className="rounded-2xl border border-border/60 px-3 py-3">
                        <div className="text-sm font-medium">{item.title}</div>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.summary}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr,1fr]">
        <div className="card-elevated p-6">
          <h2 className="text-xl">Next Support Step</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Resources help with understanding and coping, but sometimes the best next step is talking to a person who
            can support you directly.
          </p>

          <div className="mt-5 flex flex-wrap gap-3">
            <Button asChild className="rounded-full px-5">
              <Link to={isUser ? "/care-chat" : "/caseload"}>
                {isUser ? "Open Care Chat" : "View Caseload"}
              </Link>
            </Button>
            <Button asChild variant="outline" className="rounded-full px-5">
              <Link to={isUser ? "/checkin" : "/directory"}>
                {isUser ? "Start Check-in" : "Open Directory"}
              </Link>
            </Button>
          </div>
        </div>

        <div className="card-elevated border-destructive/20 bg-destructive/5 p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl">When It Feels Urgent</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                If there is immediate danger or suicidal intent, move to emergency help now.
              </p>
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-3 text-sm leading-6 text-muted-foreground">
            <p>Go to the nearest emergency service or call your local emergency number immediately.</p>
            <p>Reach a trusted person now and stay near human support instead of being alone.</p>
            <p>Use Care Chat to contact your health worker as an additional support step, not a replacement for emergency help.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ResourceStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-background/90 px-4 py-3">
      <div className="text-2xl font-serif tracking-tight">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function SupportTile({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Brain;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-3xl border border-border/70 bg-background/85 px-4 py-4">
      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-foreground">
        <Icon className="h-5 w-5" />
      </div>
      <div className="mt-4 text-sm font-medium">{title}</div>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
    </div>
  );
}
