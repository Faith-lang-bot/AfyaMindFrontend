export type RiskLevel = "low" | "medium" | "high";

export interface ScreeningResult {
  key: string;
  title: string;
  score: number;
  max_score: number;
  level: string;
  risk: string;
  summary: string;
}

export interface ExerciseRecommendation {
  key: string;
  title: string;
  duration: string;
  description: string;
  focus: string;
}

export interface CarePlan {
  admissionId: number;
  riskLevel: RiskLevel;
  phq9Score: number;
  phq9Severity: string;
  phq9RiskLevel: RiskLevel;
  recommendationType: string;
  recommendationMessage: string;
  suggestedActions: string[];
  screenings: ScreeningResult[];
  primaryFocuses: string[];
  recommendedExercises: ExerciseRecommendation[];
  progressLabel: string;
  createdAt: string;
}

export interface SessionProgress {
  exerciseComplete: boolean;
  chwChatComplete: boolean;
  guidanceComplete: boolean;
  reflection: string;
  updatedAt: string | null;
}

export interface SessionTask {
  key: "exerciseComplete" | "chwChatComplete" | "guidanceComplete";
  title: string;
  description: string;
  href: string;
}

export interface IntakeQuestion {
  id: string;
  prompt: string;
}

export interface IntakeOption<T extends number | boolean = number | boolean> {
  value: T;
  label: string;
  hint?: string;
}

export interface AdmissionSection {
  key: string;
  title: string;
  description: string;
  questions: IntakeQuestion[];
  options: IntakeOption[];
}

export const languageOptions = [
  { value: "en", label: "English" },
  { value: "sw", label: "Kiswahili" },
  { value: "fr", label: "Francais" },
  { value: "es", label: "Espanol" },
  { value: "ar", label: "Arabic" },
];

export const phq9Questions = [
  "Little interest or pleasure in doing things",
  "Feeling down, depressed, or hopeless",
  "Trouble falling or staying asleep, or sleeping too much",
  "Feeling tired or having little energy",
  "Poor appetite or overeating",
  "Feeling bad about yourself or that you are a failure",
  "Trouble concentrating on things like reading or watching TV",
  "Moving or speaking so slowly that others notice, or being unusually restless",
  "Thoughts that you would be better off dead or of hurting yourself",
];

export const gad7Questions = [
  "Feeling nervous, anxious, or on edge",
  "Not being able to stop or control worrying",
  "Worrying too much about different things",
  "Trouble relaxing",
  "Being so restless that it is hard to sit still",
  "Becoming easily annoyed or irritable",
  "Feeling afraid as if something awful might happen",
];

export const pcl5Questions = [
  "Repeated disturbing memories of the stressful experience",
  "Repeated disturbing dreams of the experience",
  "Suddenly feeling or acting like the event were happening again",
  "Feeling very upset when reminded of the event",
  "Strong physical reactions when reminded of the event",
  "Avoiding memories, thoughts, or feelings about the event",
  "Avoiding external reminders of the event",
  "Trouble remembering important parts of the event",
  "Strong negative beliefs about yourself or the world",
  "Blaming yourself or others for the event",
  "Strong negative feelings such as fear, anger, guilt, or shame",
  "Loss of interest in activities you used to enjoy",
  "Feeling distant or cut off from other people",
  "Trouble feeling positive emotions",
  "Irritable behavior or angry outbursts",
  "Taking too many risks or doing reckless things",
  "Being super-alert or watchful",
  "Feeling jumpy or easily startled",
  "Trouble concentrating",
  "Trouble falling or staying asleep",
];

export const kesslerQuestions = [
  "During the past 30 days, how often did you feel tired out for no good reason?",
  "During the past 30 days, how often did you feel nervous?",
  "During the past 30 days, how often did you feel so nervous that nothing could calm you down?",
  "During the past 30 days, how often did you feel hopeless?",
  "During the past 30 days, how often did you feel restless or fidgety?",
  "During the past 30 days, how often did you feel so restless you could not sit still?",
  "During the past 30 days, how often did you feel depressed?",
  "During the past 30 days, how often did you feel that everything was an effort?",
  "During the past 30 days, how often did you feel so sad that nothing could cheer you up?",
  "During the past 30 days, how often did you feel worthless?",
];

export const mdqQuestions = [
  "You felt so good or hyper that other people thought you were not your normal self",
  "You were so irritable that you shouted at people or started fights",
  "You felt much more self-confident than usual",
  "You got much less sleep than usual and still felt energetic",
  "You were more talkative than usual or talked faster",
  "Thoughts raced through your mind or you could not slow them down",
  "You were easily distracted and had trouble staying focused",
  "You had much more energy than usual",
  "You were much more active or did many more things than usual",
  "You were much more social or outgoing than usual",
  "You were much more interested in sex than usual",
  "You did things that were unusual for you or risky",
  "Spending money caused trouble for you or your family",
];

export const auditQuestions = [
  "How often do you have a drink containing alcohol or another substance you misuse?",
  "How many drinks or substance-use episodes do you have on a typical day when using?",
  "How often do you have six or more drinks or a heavy-use episode on one occasion?",
  "How often during the last year have you found it hard to stop once you started?",
  "How often during the last year have you failed to do what was expected because of use?",
  "How often during the last year have you needed a first drink or use in the morning?",
  "How often during the last year have you felt guilt or remorse after use?",
  "How often during the last year have you been unable to remember what happened during use?",
  "Have you or someone else been injured because of your use?",
  "Has a relative, friend, or clinician been concerned about your use?",
];

export const cssrsQuestions = [
  "Have you wished you were dead or wished you could go to sleep and not wake up?",
  "Have you actually had thoughts of killing yourself?",
  "Have you been thinking about how you might do this?",
  "Have you had these thoughts and had some intention of acting on them?",
  "Have you started to work out details of a suicide plan or intend to carry it out?",
  "Have you ever done anything, started to do anything, or prepared to do anything to end your life?",
];

export const phq9Options: IntakeOption<number>[] = [
  { value: 0, label: "Not at all" },
  { value: 1, label: "Several days" },
  { value: 2, label: "More than half the days" },
  { value: 3, label: "Nearly every day" },
];

export const pcl5Options: IntakeOption<number>[] = [
  { value: 0, label: "Not at all" },
  { value: 1, label: "A little bit" },
  { value: 2, label: "Moderately" },
  { value: 3, label: "Quite a bit" },
  { value: 4, label: "Extremely" },
];

export const kesslerOptions: IntakeOption<number>[] = [
  { value: 1, label: "None of the time" },
  { value: 2, label: "A little of the time" },
  { value: 3, label: "Some of the time" },
  { value: 4, label: "Most of the time" },
  { value: 5, label: "All of the time" },
];

export const auditOptions: IntakeOption<number>[] = [
  { value: 0, label: "Never" },
  { value: 1, label: "Rarely" },
  { value: 2, label: "Sometimes" },
  { value: 3, label: "Often" },
  { value: 4, label: "Very often" },
];

export const yesNoOptions: IntakeOption<boolean>[] = [
  { value: false, label: "No" },
  { value: true, label: "Yes" },
];

export const mdqImpairmentOptions: IntakeOption<number>[] = [
  { value: 0, label: "No problem" },
  { value: 1, label: "Minor problem" },
  { value: 2, label: "Moderate problem" },
  { value: 3, label: "Serious problem" },
];

export const admissionSections: AdmissionSection[] = [
  {
    key: "phq9",
    title: "Depression screen",
    description: "PHQ-9 helps us understand how strongly depression symptoms are showing up.",
    questions: phq9Questions.map((prompt, index) => ({ id: `phq9_${index}`, prompt })),
    options: phq9Options,
  },
  {
    key: "gad7",
    title: "Anxiety screen",
    description: "GAD-7 checks the intensity of anxiety and worry symptoms.",
    questions: gad7Questions.map((prompt, index) => ({ id: `gad7_${index}`, prompt })),
    options: phq9Options,
  },
  {
    key: "pcl5",
    title: "PTSD screen",
    description: "PCL-5 looks for trauma and post-traumatic stress symptoms.",
    questions: pcl5Questions.map((prompt, index) => ({ id: `pcl5_${index}`, prompt })),
    options: pcl5Options,
  },
  {
    key: "kessler",
    title: "Psychological distress",
    description: "Kessler helps show your overall level of distress in the past month.",
    questions: kesslerQuestions.map((prompt, index) => ({ id: `k10_${index}`, prompt })),
    options: kesslerOptions,
  },
  {
    key: "mdq",
    title: "Mood swings and bipolar risk",
    description: "MDQ screens for periods of unusually high energy, mood, and impulsive behavior.",
    questions: mdqQuestions.map((prompt, index) => ({ id: `mdq_${index}`, prompt })),
    options: yesNoOptions,
  },
  {
    key: "audit",
    title: "Substance use risk",
    description: "AUDIT helps identify hazardous or harmful alcohol and substance-use patterns.",
    questions: auditQuestions.map((prompt, index) => ({ id: `audit_${index}`, prompt })),
    options: auditOptions,
  },
  {
    key: "cssrs",
    title: "Suicide risk screen",
    description: "C-SSRS checks for suicidal thoughts, plans, and recent actions so support can happen fast.",
    questions: cssrsQuestions.map((prompt, index) => ({ id: `cssrs_${index}`, prompt })),
    options: yesNoOptions,
  },
];

export const quickExercises: ExerciseRecommendation[] = [
  {
    key: "box_breathing",
    title: "Box Breathing",
    duration: "2 min",
    description: "Breathe in for 4, hold for 4, breathe out for 4, and hold for 4.",
    focus: "general_wellness",
  },
  {
    key: "grounding_54321",
    title: "5-4-3-2-1 Grounding",
    duration: "3 min",
    description: "Name 5 things you see, 4 you feel, 3 you hear, 2 you smell, and 1 you taste.",
    focus: "anxiety",
  },
  {
    key: "reset_walk",
    title: "Gentle Reset Walk",
    duration: "5 min",
    description: "Step outside or pace slowly while noticing your breath and posture.",
    focus: "psychological_distress",
  },
];

export function admissionKey(userId: number | string) {
  return `afyamind_admission_complete_${userId}`;
}

export function carePlanKey(userId: number | string) {
  return `afyamind_care_plan_${userId}`;
}

export function sessionProgressKey(userId: number | string) {
  return `afyamind_session_progress_${userId}`;
}

export function hasCompletedAdmission(userId?: number) {
  if (!userId) return false;
  return localStorage.getItem(admissionKey(userId)) === "true";
}

export function markAdmissionComplete(userId: number) {
  localStorage.setItem(admissionKey(userId), "true");
}

export function saveCarePlan(userId: number, plan: CarePlan) {
  localStorage.setItem(carePlanKey(userId), JSON.stringify(plan));
}

export function getCarePlan(userId?: number) {
  if (!userId) return null;
  const raw = localStorage.getItem(carePlanKey(userId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CarePlan;
  } catch {
    return null;
  }
}

export function getSessionProgress(userId?: number): SessionProgress {
  const fallback: SessionProgress = {
    exerciseComplete: false,
    chwChatComplete: false,
    guidanceComplete: false,
    reflection: "",
    updatedAt: null,
  };
  if (!userId) return fallback;
  const raw = localStorage.getItem(sessionProgressKey(userId));
  if (!raw) return fallback;
  try {
    return { ...fallback, ...(JSON.parse(raw) as Partial<SessionProgress>) };
  } catch {
    return fallback;
  }
}

export function saveSessionProgress(userId: number, progress: SessionProgress) {
  localStorage.setItem(sessionProgressKey(userId), JSON.stringify(progress));
}

export function severityLabel(value?: string) {
  return (value || "not_assessed").replaceAll("_", " ");
}

export function focusLabel(value: string) {
  return value.replaceAll("_", " ");
}

export function statusLabelForPlan(plan: CarePlan | null) {
  if (!plan) return "Awaiting full mental health screening";
  if (plan.riskLevel === "high") return "Immediate support recommended";
  if (plan.riskLevel === "medium") return "Follow-up support recommended";
  return "Self-guided wellness is appropriate";
}

export function recommendationHeadline(plan: CarePlan | null) {
  if (!plan) return "Start your full screening to unlock the right support path.";
  if (plan.riskLevel === "high") return "Guidance and CHW follow-up should happen as soon as possible.";
  if (plan.riskLevel === "medium") return "Blend the recommended exercises with a CHW or therapist follow-up this week.";
  return "Continue with the exercises matched to your current focus areas.";
}

export function sessionTasks(plan: CarePlan | null) {
  const tasks: SessionTask[] = [];
  if (!plan) {
    return tasks;
  }

  tasks.push({
    key: "exerciseComplete",
    title: "Complete a matched exercise",
    description: "Use one of the exercises recommended from your screening results.",
    href: "/ai-chat",
  });

  if (plan.riskLevel === "high" || plan.riskLevel === "medium") {
    tasks.push({
      key: "chwChatComplete",
      title: "Talk to a CHW or support contact",
      description: "Use realtime chat when online or SMS fallback when connectivity is poor.",
      href: "/care-chat",
    });
  }

  tasks.push({
    key: "guidanceComplete",
    title: plan.riskLevel === "high" ? "Seek guided care today" : "Review your support guidance",
    description:
      plan.riskLevel === "high"
        ? "Use guided care resources or book a support session immediately."
        : "Review the support guidance and choose your next step.",
    href: "/resources",
  });

  return tasks;
}

export function isSessionComplete(plan: CarePlan | null, progress: SessionProgress) {
  const tasks = sessionTasks(plan);
  if (tasks.length === 0) return false;
  const checklistDone = tasks.every((task) => progress[task.key as keyof SessionProgress] === true);
  return checklistDone && progress.reflection.trim().length >= 12;
}

export function totalAdmissionQuestions() {
  return admissionSections.reduce((sum, section) => sum + section.questions.length, 0) + 2;
}
