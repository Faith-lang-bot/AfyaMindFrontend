# Mental Health Tracking System Blueprint (SQLite)

## 1) Core Architecture
- Frontend: React + React Router
- Backend: Go + Gin
- Database: SQLite
- Realtime: WebSockets (`/ws/chat`)
- AI: LLaMA API (primary), OpenAI (fallback)
- Auth: JWT access token + refresh token
- Messaging: Twilio or Africa's Talking

## 2) SQLite Database Schema

```sql
PRAGMA foreign_keys = ON;

CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  role TEXT NOT NULL CHECK (role IN ('mental_health_user', 'community_health_worker')),
  full_name TEXT,
  email TEXT UNIQUE,
  phone TEXT UNIQUE,
  language TEXT NOT NULL DEFAULT 'en',
  is_anonymous INTEGER NOT NULL DEFAULT 0 CHECK (is_anonymous IN (0,1)),
  anonymous_alias TEXT,
  password_hash TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE refresh_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at DATETIME NOT NULL,
  revoked INTEGER NOT NULL DEFAULT 0 CHECK (revoked IN (0,1)),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE chw_assignments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  chw_id INTEGER NOT NULL,
  assigned_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (chw_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE phq9_assessments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  q1 INTEGER NOT NULL CHECK (q1 BETWEEN 0 AND 3),
  q2 INTEGER NOT NULL CHECK (q2 BETWEEN 0 AND 3),
  q3 INTEGER NOT NULL CHECK (q3 BETWEEN 0 AND 3),
  q4 INTEGER NOT NULL CHECK (q4 BETWEEN 0 AND 3),
  q5 INTEGER NOT NULL CHECK (q5 BETWEEN 0 AND 3),
  q6 INTEGER NOT NULL CHECK (q6 BETWEEN 0 AND 3),
  q7 INTEGER NOT NULL CHECK (q7 BETWEEN 0 AND 3),
  q8 INTEGER NOT NULL CHECK (q8 BETWEEN 0 AND 3),
  q9 INTEGER NOT NULL CHECK (q9 BETWEEN 0 AND 3),
  score INTEGER NOT NULL CHECK (score BETWEEN 0 AND 27),
  severity TEXT NOT NULL CHECK (severity IN ('mild', 'moderate', 'severe')),
  is_monthly_retake INTEGER NOT NULL DEFAULT 0 CHECK (is_monthly_retake IN (0,1)),
  taken_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE care_plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  current_stage TEXT NOT NULL CHECK (current_stage IN ('mild_content', 'moderate_ai_monitoring', 'severe_escalation')),
  recommendation TEXT NOT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE mood_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  mood_score INTEGER NOT NULL CHECK (mood_score BETWEEN 1 AND 10),
  stress_score INTEGER NOT NULL CHECK (stress_score BETWEEN 0 AND 10),
  anxiety_score INTEGER NOT NULL CHECK (anxiety_score BETWEEN 0 AND 10),
  notes TEXT,
  ai_summary TEXT,
  recommendation TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE risk_alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  chw_id INTEGER,
  source TEXT NOT NULL,
  risk_level TEXT NOT NULL CHECK (risk_level IN ('medium', 'high')),
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'resolved')),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (chw_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE chat_rooms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_type TEXT NOT NULL CHECK (room_type IN ('professional', 'community')),
  user_id INTEGER,
  chw_id INTEGER,
  community_topic TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE chat_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id INTEGER NOT NULL,
  sender_user_id INTEGER,
  sender_role TEXT,
  is_anonymous INTEGER NOT NULL DEFAULT 0 CHECK (is_anonymous IN (0,1)),
  message TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (room_id) REFERENCES chat_rooms(id) ON DELETE CASCADE,
  FOREIGN KEY (sender_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE community_posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  topic TEXT NOT NULL,
  alias TEXT,
  user_id INTEGER,
  content TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE appointments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  therapist_name TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('voice', 'video', 'in_person')),
  appointment_time DATETIME NOT NULL,
  status TEXT NOT NULL DEFAULT 'booked' CHECK (status IN ('booked', 'completed', 'cancelled')),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE rewards_wallet (
  user_id INTEGER PRIMARY KEY,
  points INTEGER NOT NULL DEFAULT 0,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE mpesa_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  amount REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'KES',
  provider_ref TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'success', 'failed')),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE reminders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('sms', 'push')),
  schedule_time TEXT NOT NULL,
  message TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE sms_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  phone TEXT NOT NULL,
  provider TEXT NOT NULL,
  provider_message_id TEXT,
  status TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE monthly_progress (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  baseline_assessment_id INTEGER NOT NULL,
  current_assessment_id INTEGER NOT NULL,
  score_delta INTEGER NOT NULL,
  improved INTEGER NOT NULL CHECK (improved IN (0,1)),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (baseline_assessment_id) REFERENCES phq9_assessments(id) ON DELETE CASCADE,
  FOREIGN KEY (current_assessment_id) REFERENCES phq9_assessments(id) ON DELETE CASCADE
);

CREATE TABLE certificates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  monthly_progress_id INTEGER NOT NULL,
  pdf_path TEXT NOT NULL,
  certificate_code TEXT NOT NULL UNIQUE,
  issued_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (monthly_progress_id) REFERENCES monthly_progress(id) ON DELETE CASCADE
);
```

## 3) API Endpoints

### Auth
- `POST /api/auth/register` (role, email/phone/password or anonymous)
- `POST /api/auth/login/email`
- `POST /api/auth/login/phone`
- `POST /api/auth/anonymous`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `GET /api/me`

### PHQ-9 + Care Flow
- `POST /api/phq9/submit`
- `GET /api/phq9/latest`
- `GET /api/phq9/history`
- `GET /api/care/plan`

PHQ-9 categorization rule (as requested):
- `0-4 = mild`
- `5-14 = moderate`
- `15-27 = severe`

### Daily Monitoring
- `POST /api/monitoring/mood`
- `GET /api/monitoring/mood?days=30`
- `POST /api/monitoring/ai-analyze`
- `POST /api/reminders`
- `GET /api/reminders`

### Alerts + CHW
- `GET /api/chw/dashboard`
- `GET /api/chw/assigned-users`
- `GET /api/chw/alerts`
- `POST /api/chw/alerts/:id/ack`
- `POST /api/chw/assign`

### Chat + Community
- `GET /ws/chat?roomId=...` (WebSocket)
- `GET /api/chat/rooms`
- `POST /api/chat/rooms`
- `GET /api/chat/messages?room_id=...`
- `POST /api/community/posts`
- `GET /api/community/posts?topic=...`

### Motivation + Content
- `GET /api/content/motivational` (videos/articles by severity/language)
- `POST /api/ai/chat`

### Monthly Cycle + Certificate
- `POST /api/monthly/retake-check`
- `POST /api/monthly/compare`
- `POST /api/certificates/generate`
- `GET /api/certificates/:id`

### Rewards + Appointments
- `GET /api/rewards`
- `POST /api/rewards/redeem/mpesa`
- `POST /api/appointments`
- `GET /api/appointments`

## 4) Care Flow Logic

1. User logs in.
2. Backend checks if PHQ-9 exists in current cycle.
3. If not, frontend redirects to `/phq9`.
4. On submit:
   - Mild: show motivational page (videos/articles).
   - Moderate: enable AI chatbot and daily mood tracker.
   - Severe: create high-risk alert, notify CHW, open professional realtime chat.
5. Daily monitoring updates care recommendations.
6. At 30 days, force retake PHQ-9 and compare with baseline.
7. If score improves (`score_delta < 0`), generate PDF certificate.

## 5) Backend Structure (Go + Gin)

```text
backend/
  cmd/api/main.go
  internal/
    config/
    database/
      sqlite.go
      migrations/
    auth/
      jwt.go
      password.go
      handlers.go
    users/
      model.go
      repository.go
      service.go
      handlers.go
    phq9/
      scorer.go
      repository.go
      service.go
      handlers.go
    careflow/
      engine.go
      service.go
    monitoring/
      handlers.go
      service.go
    alerts/
      handlers.go
      service.go
    chat/
      ws_hub.go
      ws_handler.go
      handlers.go
    notifications/
      sms_twilio.go
      sms_africastalking.go
      scheduler.go
    ai/
      llama_client.go
      openai_fallback.go
    certificates/
      pdf_generator.go
      handlers.go
    rewards/
      mpesa_client.go
      handlers.go
    middleware/
      auth.go
      roles.go
      privacy.go
  pkg/
    logger/
    utils/
```

## 6) Frontend Structure (React)

```text
frontend/src/
  app/
    router.jsx
    authStore.js
  pages/
    Auth/
      RegisterPage.jsx
      LoginEmailPage.jsx
      LoginPhonePage.jsx
      AnonymousEntryPage.jsx
    Assessment/
      PHQ9Page.jsx
      PHQ9ResultPage.jsx
    Care/
      MildContentPage.jsx
      ModerateSupportPage.jsx
      SevereEscalationPage.jsx
    Monitoring/
      DailyMoodPage.jsx
      ProgressPage.jsx
    Chat/
      RealtimeProfessionalChatPage.jsx
      CommunityChatPage.jsx
    CHW/
      DashboardPage.jsx
      AssignedUsersPage.jsx
      AlertsPage.jsx
    Rewards/
      RewardsPage.jsx
      MpesaRedeemPage.jsx
    Appointments/
      AppointmentBookingPage.jsx
    Certificates/
      CertificatePage.jsx
  components/
    ProtectedRoute.jsx
    RoleGuard.jsx
    LanguageSwitcher.jsx
    MoodChart.jsx
    VideoCard.jsx
    ReminderForm.jsx
```

## 7) Basic UI Flow

1. Register/Login (`email`, `phone`, or `anonymous`) -> JWT issued.
2. Redirect to PHQ-9.
3. PHQ-9 determines care path:
   - Mild -> Motivation videos/articles.
   - Moderate -> AI chatbot + daily monitoring.
   - Severe -> CHW alert + realtime professional chat.
4. Daily mood check-in + AI recommendations + SMS reminders.
5. At day 30, retake PHQ-9 and compare scores.
6. If improved, issue downloadable certificate PDF.
7. CHW dashboard tracks assigned users, alerts, chat, and trends.

## 8) Security + Privacy Controls
- Passwords hashed with bcrypt.
- JWT short-lived access token + refresh token rotation.
- Store only minimum PII; support anonymous alias.
- Encrypt sensitive fields before DB write (phone, notes) using app-level AES.
- Role-based access checks on all CHW routes.
- Audit logs for sensitive actions (alerts, certificate generation, chat access).
- Rate-limit auth and chatbot endpoints.

## 9) Suggested Build Order
1. Auth + Roles + SQLite schema
2. PHQ-9 + care-flow routing
3. Daily monitoring + reminders
4. CHW dashboard + alerts
5. WebSocket realtime chat
6. Monthly comparison + certificate PDF
7. M-Pesa rewards + appointment integration
