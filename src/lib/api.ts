export const DEFAULT_API_BASE = import.meta.env.DEV ? "http://localhost:8080" : "https://afyamentbackend.onrender.com";
const API_BASE = import.meta.env.VITE_API_BASE || DEFAULT_API_BASE;

interface AuthUser {
  id: number;
  name: string;
  email: string;
  phone: string;
  language: string;
  role: string;
}

interface AuthResponse {
  token: string;
  user: AuthUser;
}

interface DashboardSummary {
  user: AuthUser;
  points: number;
  chw_linked: boolean;
  total_checkins: number;
  total_risk_events: number;
  total_appointments: number;
  total_community_messages: number;
  last_risk_level: string;
}

interface CheckinResponse {
  id: number;
  risk_level: string;
  created_at: string;
  reward_points: number;
  recommendation_type: string;
  recommendation_message: string;
  suggested_actions: string[];
  phq9_score: number | null;
  phq9_severity: string;
  phq9_risk_level: string;
}

interface JournalEntry {
  id: number;
  entry: string;
  created_at: string;
}

interface Reminder {
  id: number;
  title: string;
  schedule_time: string;
  is_active: boolean;
  created_at: string;
}

interface Appointment {
  id: number;
  therapist: string;
  session_mode: string;
  appointment_time: string;
  status: string;
  created_at: string;
}

interface AppointmentCreationResponse {
  id: number;
  reward_points: number;
  message: string;
  sms_status?: string;
  sms_warning?: string;
  contact_sms_status?: string;
  contact_sms_warning?: string;
}

interface ReminderCreationResponse {
  id: number;
  message: string;
  sms_status?: string;
  sms_warning?: string;
}

interface SmsProviderResponse {
  provider_status: string;
  provider_id: string;
  provider_raw: Record<string, unknown>;
}

interface MotivationResponse {
  message: string;
  language: string;
  provider?: SmsProviderResponse;
}

interface VoiceHelplineResponse {
  language: string;
  script: string;
}

interface CommunityMessage {
  id: number;
  room: string;
  message: string;
  created_at: string;
  user_id?: number;
  user_name?: string;
  name?: string;
}

interface CareMessage {
  id: number;
  room_id: string;
  sender_id: number;
  sender_name: string;
  sender_role: string;
  message: string;
  created_at: string;
}

interface RewardsBalance {
  points: number;
}

interface RewardRedemption {
  message: string;
  amount_points: number;
  remaining_points: number;
  mpesa_reference: string;
  points?: number;
}

interface ResourceItem {
  category: string;
  title: string;
  summary: string;
}

interface CHWLinkStatus {
  linked: boolean;
  id?: number;
  chw_name?: string;
  phone?: string;
  region?: string;
  chw_user_id?: number | null;
  created_at?: string;
}

interface CHWDirectoryEntry {
  id: number | null;
  name: string;
  email: string;
  phone: string;
  region: string;
  caseload_count: number;
  is_registered: boolean;
}

interface CHWCaseloadPatient {
  patient_id: number;
  patient_name: string;
  patient_email: string;
  patient_phone: string;
  language: string;
  region: string;
  chw_name: string;
  linked_at: string;
  last_risk_level: string;
  last_checkin_at: string | null;
  total_checkins: number;
}

interface CHWCaseload {
  chw: AuthUser;
  total_patients: number;
  patients: CHWCaseloadPatient[];
}

interface ScreeningResult {
  key: string;
  title: string;
  score: number;
  max_score: number;
  level: string;
  risk: string;
  summary: string;
}

interface ExerciseRecommendation {
  key: string;
  title: string;
  duration: string;
  description: string;
  focus: string;
}

interface AdmissionResponse {
  admission_id: number;
  risk_level: string;
  created_at: string;
  phq9_score: number;
  phq9_severity: string;
  phq9_risk_level: string;
  reward_points: number;
  recommendation_type: string;
  recommendation_message: string;
  suggested_actions: string[];
  screenings: ScreeningResult[];
  primary_focuses: string[];
  recommended_exercises: ExerciseRecommendation[];
  progress_label: string;
  admission_flow_complete: boolean;
}

interface AIAssistantResponse {
  model: string;
  reply: string;
  suggested_actions: string[];
  risk_level: string;
  sms_status?: string;
  sms_warning?: string;
}

interface CertificateResponse {
  certificate_id: number;
  status: string;
  summary: string;
  avg_mood: number;
  created_at: string;
}

class ApiClient {
  private token: string | null = null;

  constructor() {
    this.token = localStorage.getItem("auth_token");
  }

  setToken(token: string | null) {
    this.token = token;
    if (token) localStorage.setItem("auth_token", token);
    else localStorage.removeItem("auth_token");
  }

  getToken() {
    return this.token;
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (this.token) headers["Authorization"] = `Bearer ${this.token}`;

    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || err.message || "Request failed");
    }

    return res.json();
  }

  // Auth
  register(data: { name: string; email: string; phone: string; password: string; language: string; role: string }) {
    return this.request<AuthResponse>("POST", "/api/auth/register", data);
  }

  login(data: { email: string; password: string }) {
    return this.request<AuthResponse>("POST", "/api/auth/login", data);
  }

  getMe() {
    return this.request<AuthUser>("GET", "/api/me");
  }

  // Dashboard
  getDashboardSummary() {
    return this.request<DashboardSummary>("GET", "/api/dashboard/summary");
  }

  // Checkins
  createCheckin(data: { mood: number; stress: number; anxiety: number; sleep_hours: number; note: string; phq9_answers?: number[] }) {
    return this.request<CheckinResponse>("POST", "/api/checkins", data);
  }

  getCheckins() {
    return this.request<CheckinResponse[]>("GET", "/api/checkins");
  }

  // Journal
  createJournal(data: { entry: string }) {
    return this.request<JournalEntry>("POST", "/api/journal", data);
  }

  getJournal() {
    return this.request<JournalEntry[]>("GET", "/api/journal");
  }

  // Reminders
  createReminder(data: { title: string; schedule_time: string }) {
    return this.request<ReminderCreationResponse>("POST", "/api/reminders", data);
  }

  getReminders() {
    return this.request<Reminder[]>("GET", "/api/reminders");
  }

  // Appointments
  createAppointment(data: { therapist: string; session_mode: string; appointment_time: string; notification_phone?: string }) {
    return this.request<AppointmentCreationResponse>("POST", "/api/appointments", data);
  }

  getAppointments() {
    return this.request<Appointment[]>("GET", "/api/appointments");
  }

  // Community
  createCommunityMessage(data: { room: string; message: string }) {
    return this.request<{ id: number; message: string }>("POST", "/api/community/messages", data);
  }

  getCommunityMessages(room?: string) {
    const q = room ? `?room=${encodeURIComponent(room)}` : "";
    return this.request<CommunityMessage[]>("GET", `/api/community/messages${q}`);
  }

  getCareMessages(room_id: string) {
    const q = `?room_id=${encodeURIComponent(room_id)}`;
    return this.request<CareMessage[]>("GET", `/api/care/messages${q}`);
  }

  // Rewards
  getRewards() {
    return this.request<RewardsBalance>("GET", "/api/rewards");
  }

  async redeemRewards(amount_points: number) {
    const result = await this.request<RewardRedemption>("POST", "/api/rewards/redeem", { amount_points });
    return { ...result, points: result.points ?? result.remaining_points };
  }

  // Resources
  getResources() {
    return this.request<ResourceItem[]>("GET", "/api/resources");
  }

  // AI Assistant
  askAI(data: { prompt: string; language: string; send_sms?: boolean; sms_to?: string }) {
    return this.request<AIAssistantResponse>("POST", "/api/ai/assistant", data);
  }

  // CHW
  getCHWLink() {
    return this.request<CHWLinkStatus>("GET", "/api/chw/link");
  }

  linkCHW(data: { chw_name: string; phone: string; region: string; chw_user_id?: number }) {
    return this.request<{ message: string }>("POST", "/api/chw/link", data);
  }

  getCHWDirectory() {
    return this.request<CHWDirectoryEntry[]>("GET", "/api/chw/directory");
  }

  getCHWCaseload() {
    return this.request<CHWCaseload>("GET", "/api/chw/caseload");
  }

  sendMotivation(data: { to: string; language?: string }) {
    return this.request<MotivationResponse>("POST", "/api/motivation/send", data);
  }

  sendSMS(data: { to: string; message: string }) {
    return this.request<SmsProviderResponse>("POST", "/api/sms/send", data);
  }

  getVoiceHelpline(data?: { language?: string }) {
    return this.request<VoiceHelplineResponse>("POST", "/api/voice/helpline", data ?? {});
  }

  // Admission
  startAdmission(data: {
    phq9_answers: number[];
    gad7_answers: number[];
    pcl5_answers: number[];
    kessler_answers: number[];
    mdq_answers: boolean[];
    mdq_concurrent: boolean;
    mdq_impairment: number;
    audit_answers: number[];
    cssrs_answers: boolean[];
    mood?: number;
    stress?: number;
    anxiety?: number;
    sleep_hours?: number;
    note?: string;
    primary_concern?: string;
    safety_contact_number?: string;
  }) {
    return this.request<AdmissionResponse>("POST", "/api/admissions/start", data);
  }

  generateCertification() {
    return this.request<CertificateResponse>("POST", "/api/certification/generate");
  }
}

export const api = new ApiClient();
export type {
  AdmissionResponse,
  Appointment,
  AppointmentCreationResponse,
  AuthResponse,
  AuthUser,
  CHWCaseload,
  CHWCaseloadPatient,
  CHWDirectoryEntry,
  CHWLinkStatus,
  CheckinResponse,
  CommunityMessage,
  CareMessage,
  CertificateResponse,
  DashboardSummary,
  JournalEntry,
  MotivationResponse,
  ExerciseRecommendation,
  Reminder,
  ReminderCreationResponse,
  ResourceItem,
  RewardRedemption,
  RewardsBalance,
  ScreeningResult,
  SmsProviderResponse,
  VoiceHelplineResponse,
};
