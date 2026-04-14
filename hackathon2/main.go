package main

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	_ "github.com/mattn/go-sqlite3"
	"golang.org/x/crypto/bcrypt"
)

type Server struct {
	db            *sql.DB
	httpClient    *http.Client
	smsURL        string
	smsAPIKey     string
	frontendDist  string
	aiProvider    string
	llamaModel    string
	llamaChatURL  string
	openAIAPIKey  string
	openAIModel   string
	openAIChatURL string
	careRooms     map[string]map[*careClient]struct{}
	careMu        sync.RWMutex
	wsUpgrader    websocket.Upgrader
}

type careClient struct {
	conn   *websocket.Conn
	roomID string
	user   AuthUser
	server *Server
	writeMu sync.Mutex
}

type AuthUser struct {
	ID       int64  `json:"id"`
	Name     string `json:"name"`
	Email    string `json:"email"`
	Language string `json:"language"`
	Role     string `json:"role"`
}

const (
	roleMentalHealthUser      = "mental_health_user"
	roleCommunityHealthWorker = "community_health_worker"
)

type registerRequest struct {
	Name     string `json:"name"`
	Email    string `json:"email"`
	Password string `json:"password"`
	Language string `json:"language"`
	Role     string `json:"role"`
}

type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type authResponse struct {
	Token string   `json:"token"`
	User  AuthUser `json:"user"`
}

type checkinRequest struct {
	Mood        int     `json:"mood"`
	Stress      int     `json:"stress"`
	Anxiety     int     `json:"anxiety"`
	SleepHours  float64 `json:"sleep_hours"`
	Note        string  `json:"note"`
	PHQ9Answers []int   `json:"phq9_answers"`
}

type admissionRequest struct {
	PHQ9Answers []int    `json:"phq9_answers"`
	Mood        *int     `json:"mood"`
	Stress      *int     `json:"stress"`
	Anxiety     *int     `json:"anxiety"`
	SleepHours  *float64 `json:"sleep_hours"`
	Note        string   `json:"note"`
}

type reminderRequest struct {
	Title        string `json:"title"`
	ScheduleTime string `json:"schedule_time"`
}

type appointmentRequest struct {
	Therapist       string `json:"therapist"`
	SessionMode     string `json:"session_mode"`
	AppointmentTime string `json:"appointment_time"`
}

type communityMessageRequest struct {
	Room    string `json:"room"`
	Message string `json:"message"`
}

type chwLinkRequest struct {
	CHWName   string `json:"chw_name"`
	Phone     string `json:"phone"`
	Region    string `json:"region"`
	CHWUserID int64  `json:"chw_user_id"`
}

type smsRequest struct {
	To      string `json:"to"`
	Message string `json:"message"`
}

type motivationRequest struct {
	To       string `json:"to"`
	Language string `json:"language"`
}

type ussdRequest struct {
	Code string `json:"code"`
}

type aiRequest struct {
	Prompt   string `json:"prompt"`
	Language string `json:"language"`
}

type languageRequest struct {
	Language string `json:"language"`
}

type redeemRequest struct {
	AmountPoints int `json:"amount_points"`
}

type moodRecord struct {
	ID         int64     `json:"id"`
	Mood       int       `json:"mood"`
	Stress     int       `json:"stress"`
	Anxiety    int       `json:"anxiety"`
	SleepHours float64   `json:"sleep_hours"`
	Note       string    `json:"note"`
	RiskLevel  string    `json:"risk_level"`
	CreatedAt  time.Time `json:"created_at"`
}

type summaryResponse struct {
	User              AuthUser `json:"user"`
	Points            int      `json:"points"`
	CHWLinked         bool     `json:"chw_linked"`
	TotalCheckins     int      `json:"total_checkins"`
	TotalRiskEvents   int      `json:"total_risk_events"`
	TotalAppointments int      `json:"total_appointments"`
	TotalCommunity    int      `json:"total_community_messages"`
	LastRiskLevel     string   `json:"last_risk_level"`
}

type smsProviderResponse struct {
	ProviderStatus string         `json:"provider_status"`
	ProviderID     string         `json:"provider_id"`
	ProviderRaw    map[string]any `json:"provider_raw"`
}

type resourceItem struct {
	Category string `json:"category"`
	Title    string `json:"title"`
	Summary  string `json:"summary"`
}

type careMessageRecord struct {
	ID         int64  `json:"id"`
	RoomID     string `json:"room_id"`
	SenderID   int64  `json:"sender_id"`
	SenderName string `json:"sender_name"`
	SenderRole string `json:"sender_role"`
	Message    string `json:"message"`
	CreatedAt  string `json:"created_at"`
}

type phq9Assessment struct {
	Provided  bool
	Score     int
	Severity  string
	RiskLevel string
	Item9     int
}

type careRecommendation struct {
	Type    string
	Message string
	Actions []string
}

func main() {
	dbPath := envOrDefault("DB_PATH", "./mental_health.db")
	port := envOrDefault("PORT", "8080")

	db, err := openDB(dbPath)
	if err != nil {
		log.Fatalf("failed to open db: %v", err)
	}
	defer db.Close()

	s := &Server{
		db:            db,
		httpClient:    &http.Client{Timeout: 15 * time.Second},
		smsURL:        envOrDefault("DEVTEXT_SMS_URL", "https://devtext.site/v1/sms/send"),
		smsAPIKey:     strings.TrimSpace(os.Getenv("DEVTEXT_API_KEY")),
		frontendDist:  envOrDefault("FRONTEND_DIST", "../dist"),
		aiProvider:    normalizeAIProvider(envOrDefault("AI_PROVIDER", "llama")),
		llamaModel:    envOrDefault("LLAMA_MODEL", "llama3.2:3b"),
		llamaChatURL:  envOrDefault("LLAMA_CHAT_URL", "http://127.0.0.1:11434/api/chat"),
		openAIAPIKey:  strings.TrimSpace(os.Getenv("OPENAI_API_KEY")),
		openAIModel:   envOrDefault("OPENAI_MODEL", "gpt-4.1-mini"),
		openAIChatURL: envOrDefault("OPENAI_CHAT_URL", "https://api.openai.com/v1/chat/completions"),
		careRooms:     make(map[string]map[*careClient]struct{}),
		wsUpgrader: websocket.Upgrader{
			CheckOrigin: func(r *http.Request) bool { return true },
		},
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/api/health", s.handleHealth)
	mux.HandleFunc("/api/auth/register", s.handleRegister)
	mux.HandleFunc("/api/auth/login", s.handleLogin)
	mux.HandleFunc("/api/me", s.withAuth(s.handleMe))
	mux.HandleFunc("/api/me/language", s.withAuth(s.handleUpdateLanguage))
	mux.HandleFunc("/api/chw/link", s.withAuth(s.handleLinkCHW))
	mux.HandleFunc("/api/chw/directory", s.withAuth(s.handleListCHWDirectory))
	mux.HandleFunc("/api/chw/caseload", s.withAuth(s.handleCHWCaseload))
	mux.HandleFunc("/api/admissions/start", s.withAuth(s.handleStartAdmission))
	mux.HandleFunc("/api/checkins", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodPost:
			s.withAuth(s.handleCreateCheckin)(w, r)
		case http.MethodGet:
			s.withAuth(s.handleListCheckins)(w, r)
		default:
			w.Header().Set("Allow", "GET, POST")
			writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		}
	})
	mux.HandleFunc("/api/journal", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodPost:
			s.withAuth(s.handleCreateJournal)(w, r)
		case http.MethodGet:
			s.withAuth(s.handleListJournal)(w, r)
		default:
			w.Header().Set("Allow", "GET, POST")
			writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		}
	})
	mux.HandleFunc("/api/reminders", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodPost:
			s.withAuth(s.handleCreateReminder)(w, r)
		case http.MethodGet:
			s.withAuth(s.handleListReminders)(w, r)
		default:
			w.Header().Set("Allow", "GET, POST")
			writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		}
	})
	mux.HandleFunc("/api/appointments", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodPost:
			s.withAuth(s.handleCreateAppointment)(w, r)
		case http.MethodGet:
			s.withAuth(s.handleListAppointments)(w, r)
		default:
			w.Header().Set("Allow", "GET, POST")
			writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		}
	})
	mux.HandleFunc("/api/community/messages", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodPost:
			s.withAuth(s.handleCreateCommunityMessage)(w, r)
		case http.MethodGet:
			s.withAuth(s.handleListCommunityMessages)(w, r)
		default:
			w.Header().Set("Allow", "GET, POST")
			writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		}
	})
	// mux.HandleFunc("/api/care/messages", s.withAuth(s.handleListCareMessages))
	mux.HandleFunc("/api/ussd/simulate", s.withAuth(s.handleSimulateUSSD))
	mux.HandleFunc("/api/rewards", s.withAuth(s.handleGetRewards))
	mux.HandleFunc("/api/rewards/redeem", s.withAuth(s.handleRedeemRewards))
	mux.HandleFunc("/api/certification/generate", s.withAuth(s.handleGenerateCertificate))
	mux.HandleFunc("/api/dashboard/summary", s.withAuth(s.handleDashboardSummary))
	mux.HandleFunc("/api/sms/send", s.withAuth(s.handleSendSMS))
	mux.HandleFunc("/api/motivation/send", s.withAuth(s.handleSendMotivation))
	mux.HandleFunc("/api/voice/helpline", s.withAuth(s.handleVoiceHelpline))
	mux.HandleFunc("/api/resources", s.withAuth(s.handleResources))
	mux.HandleFunc("/api/ai/assistant", s.withAuth(s.handleAIAssistant))
	// mux.HandleFunc("/ws/care", s.handleCareSocket)
	mux.HandleFunc("/", s.serveFrontend)

	log.Printf("server running at http://localhost:%s", port)
	if err := http.ListenAndServe(":"+port, withCORS(mux)); err != nil {
		log.Fatal(err)
	}
}

func openDB(path string) (*sql.DB, error) {
	db, err := sql.Open("sqlite3", path)
	if err != nil {
		return nil, err
	}

	db.SetMaxOpenConns(1)
	if err := db.Ping(); err != nil {
		return nil, err
	}

	schema := `
	PRAGMA foreign_keys = ON;

	CREATE TABLE IF NOT EXISTS users (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		name TEXT NOT NULL,
		email TEXT NOT NULL UNIQUE,
		password_hash TEXT NOT NULL,
		language TEXT NOT NULL DEFAULT 'en',
		role TEXT NOT NULL DEFAULT 'mental_health_user',
		created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS sessions (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		user_id INTEGER NOT NULL,
		token TEXT NOT NULL UNIQUE,
		expires_at DATETIME NOT NULL,
		created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
	);

	CREATE TABLE IF NOT EXISTS chw_links (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		user_id INTEGER NOT NULL,
		chw_name TEXT NOT NULL,
		phone TEXT NOT NULL,
		region TEXT NOT NULL,
		chw_user_id INTEGER,
		created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
		FOREIGN KEY(chw_user_id) REFERENCES users(id) ON DELETE SET NULL
	);

	CREATE TABLE IF NOT EXISTS checkins (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		user_id INTEGER NOT NULL,
		mood INTEGER NOT NULL,
		stress INTEGER NOT NULL,
		anxiety INTEGER NOT NULL,
		sleep_hours REAL NOT NULL,
		note TEXT NOT NULL DEFAULT '',
		risk_level TEXT NOT NULL,
		created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
	);

	CREATE TABLE IF NOT EXISTS journal_entries (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		user_id INTEGER NOT NULL,
		entry TEXT NOT NULL,
		created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
	);

	CREATE TABLE IF NOT EXISTS reminders (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		user_id INTEGER NOT NULL,
		title TEXT NOT NULL,
		schedule_time TEXT NOT NULL,
		is_active INTEGER NOT NULL DEFAULT 1,
		created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
	);

	CREATE TABLE IF NOT EXISTS appointments (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		user_id INTEGER NOT NULL,
		therapist TEXT NOT NULL,
		session_mode TEXT NOT NULL,
		appointment_time TEXT NOT NULL,
		status TEXT NOT NULL DEFAULT 'booked',
		created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
	);

	CREATE TABLE IF NOT EXISTS community_messages (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		user_id INTEGER NOT NULL,
		room TEXT NOT NULL,
		message TEXT NOT NULL,
		created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
	);

	CREATE TABLE IF NOT EXISTS care_messages (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		room_id TEXT NOT NULL,
		sender_id INTEGER NOT NULL,
		sender_name TEXT NOT NULL,
		sender_role TEXT NOT NULL,
		message TEXT NOT NULL,
		created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY(sender_id) REFERENCES users(id) ON DELETE CASCADE
	);

	CREATE TABLE IF NOT EXISTS rewards (
		user_id INTEGER PRIMARY KEY,
		points INTEGER NOT NULL DEFAULT 0,
		updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
	);

	CREATE TABLE IF NOT EXISTS risk_events (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		user_id INTEGER NOT NULL,
		source TEXT NOT NULL,
		severity TEXT NOT NULL,
		message TEXT NOT NULL,
		created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
	);

	CREATE TABLE IF NOT EXISTS certificates (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		user_id INTEGER NOT NULL,
		status TEXT NOT NULL,
		summary TEXT NOT NULL,
		created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
	);

	CREATE TABLE IF NOT EXISTS sms_logs (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		user_id INTEGER NOT NULL,
		to_number TEXT NOT NULL,
		message TEXT NOT NULL,
		provider_status TEXT NOT NULL,
		provider_id TEXT NOT NULL,
		created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
	);
	`

	if _, err := db.Exec(schema); err != nil {
		return nil, err
	}

	_, _ = db.Exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'mental_health_user'")
	_, _ = db.Exec("ALTER TABLE chw_links ADD COLUMN chw_user_id INTEGER")
	_, _ = db.Exec("UPDATE users SET role = 'mental_health_user' WHERE role IS NULL OR TRIM(role) = '' OR LOWER(TRIM(role)) = 'user'")
	_, _ = db.Exec("UPDATE users SET role = 'community_health_worker' WHERE LOWER(TRIM(role)) IN ('chw', 'community health worker', 'community_health_worker')")
	_, _ = db.Exec("CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)")
	_, _ = db.Exec("CREATE INDEX IF NOT EXISTS idx_chw_links_name_user ON chw_links(chw_name, user_id)")
	_, _ = db.Exec("CREATE INDEX IF NOT EXISTS idx_chw_links_chw_user ON chw_links(chw_user_id)")
	_, _ = db.Exec("CREATE INDEX IF NOT EXISTS idx_care_messages_room_created ON care_messages(room_id, created_at)")

	return db, nil
}

func (s *Server) handleHealth(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (s *Server) handleRegister(w http.ResponseWriter, r *http.Request) {
	var req registerRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	req.Name = strings.TrimSpace(req.Name)
	req.Email = strings.ToLower(strings.TrimSpace(req.Email))
	req.Language = normalizeLanguage(req.Language)
	req.Role = normalizeRole(req.Role)

	if req.Name == "" || req.Email == "" || req.Password == "" {
		writeError(w, http.StatusBadRequest, "name, email, and password are required")
		return
	}
	if len(req.Password) < 8 {
		writeError(w, http.StatusBadRequest, "password must be at least 8 characters")
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to hash password")
		return
	}

	res, err := s.db.Exec(
		"INSERT INTO users(name, email, password_hash, language, role) VALUES(?, ?, ?, ?, ?)",
		req.Name,
		req.Email,
		string(hash),
		req.Language,
		req.Role,
	)
	if err != nil {
		if strings.Contains(strings.ToLower(err.Error()), "unique") {
			writeError(w, http.StatusConflict, "email already exists")
			return
		}
		writeError(w, http.StatusInternalServerError, "failed to create user")
		return
	}

	userID, err := res.LastInsertId()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to fetch new user id")
		return
	}

	_, _ = s.db.Exec("INSERT OR IGNORE INTO rewards(user_id, points) VALUES(?, 0)", userID)

	token, err := s.createSession(userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create session")
		return
	}

	user, err := s.getUserByID(userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to load user")
		return
	}

	writeJSON(w, http.StatusCreated, authResponse{Token: token, User: user})
}

func (s *Server) handleLogin(w http.ResponseWriter, r *http.Request) {
	var req loginRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	req.Email = strings.ToLower(strings.TrimSpace(req.Email))
	if req.Email == "" || req.Password == "" {
		writeError(w, http.StatusBadRequest, "email and password are required")
		return
	}

	var (
		user AuthUser
		hash string
	)

	err := s.db.QueryRow(
		"SELECT id, name, email, language, role, password_hash FROM users WHERE email = ?",
		req.Email,
	).Scan(&user.ID, &user.Name, &user.Email, &user.Language, &user.Role, &hash)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusUnauthorized, "invalid credentials")
			return
		}
		writeError(w, http.StatusInternalServerError, "failed to load user")
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(req.Password)); err != nil {
		writeError(w, http.StatusUnauthorized, "invalid credentials")
		return
	}
	user.Role = normalizeRole(user.Role)

	token, err := s.createSession(user.ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create session")
		return
	}

	writeJSON(w, http.StatusOK, authResponse{Token: token, User: user})
}

func (s *Server) handleMe(w http.ResponseWriter, _ *http.Request, user AuthUser) {
	writeJSON(w, http.StatusOK, user)
}

func (s *Server) handleUpdateLanguage(w http.ResponseWriter, r *http.Request, user AuthUser) {
	var req languageRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	lang := normalizeLanguage(req.Language)
	if _, err := s.db.Exec("UPDATE users SET language = ? WHERE id = ?", lang, user.ID); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to update language")
		return
	}

	user.Language = lang
	writeJSON(w, http.StatusOK, user)
}

func (s *Server) handleLinkCHW(w http.ResponseWriter, r *http.Request, user AuthUser) {
	if err := requireUserRole(user, roleMentalHealthUser); err != nil {
		writeError(w, http.StatusForbidden, err.Error())
		return
	}

	var req chwLinkRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	req.CHWName = strings.TrimSpace(req.CHWName)
	req.Phone = strings.TrimSpace(req.Phone)
	req.Region = strings.TrimSpace(req.Region)
	if req.Region == "" {
		req.Region = "Nairobi"
	}
	if req.CHWUserID > 0 {
		var linkedCHW AuthUser
		err := s.db.QueryRow(
			"SELECT id, name, email, language, role FROM users WHERE id = ?",
			req.CHWUserID,
		).Scan(&linkedCHW.ID, &linkedCHW.Name, &linkedCHW.Email, &linkedCHW.Language, &linkedCHW.Role)
		if err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				writeError(w, http.StatusNotFound, "selected CHW account was not found")
				return
			}
			writeError(w, http.StatusInternalServerError, "failed to load selected CHW")
			return
		}
		if normalizeRole(linkedCHW.Role) != roleCommunityHealthWorker {
			writeError(w, http.StatusBadRequest, "selected account is not a Community Health Worker")
			return
		}
		if req.CHWName == "" {
			req.CHWName = linkedCHW.Name
		}
	}

	if req.CHWName == "" || req.Phone == "" {
		writeError(w, http.StatusBadRequest, "chw_name, phone, and region are required")
		return
	}

	_, err := s.db.Exec(
		"INSERT INTO chw_links(user_id, chw_name, phone, region, chw_user_id) VALUES(?, ?, ?, ?, ?)",
		user.ID,
		req.CHWName,
		req.Phone,
		req.Region,
		nullableInt64(req.CHWUserID),
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to link CHW")
		return
	}

	writeJSON(w, http.StatusCreated, map[string]string{
		"message": "CHW linked successfully",
	})
}

func (s *Server) handleGetCHWLink(w http.ResponseWriter, _ *http.Request, user AuthUser) {
	if err := requireUserRole(user, roleMentalHealthUser); err != nil {
		writeError(w, http.StatusForbidden, err.Error())
		return
	}

	var (
		id        int64
		name      string
		phone     string
		region    string
		chwUserID sql.NullInt64
		createdAt time.Time
	)

	err := s.db.QueryRow(
		"SELECT id, chw_name, phone, region, chw_user_id, created_at FROM chw_links WHERE user_id = ? ORDER BY id DESC LIMIT 1",
		user.ID,
	).Scan(&id, &name, &phone, &region, &chwUserID, &createdAt)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeJSON(w, http.StatusOK, map[string]any{"linked": false})
			return
		}
		writeError(w, http.StatusInternalServerError, "failed to fetch CHW link")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"linked":   true,
		"id":       id,
		"chw_name": name,
		"phone":    phone,
		"region":   region,
		"chw_user_id": func() any {
			if chwUserID.Valid {
				return chwUserID.Int64
			}
			return nil
		}(),
		"created_at": createdAt,
	})
}

func (s *Server) handleListCHWDirectory(w http.ResponseWriter, _ *http.Request, _ AuthUser) {
	items := make([]map[string]any, 0)
	registeredByName := map[string]struct{}{}

	rows, err := s.db.Query(
		`SELECT
			u.id,
			u.name,
			u.email,
			COALESCE((
				SELECT cl.phone
				FROM chw_links cl
				WHERE cl.chw_user_id = u.id
				ORDER BY cl.created_at DESC, cl.id DESC
				LIMIT 1
			), '') AS phone,
			COALESCE((
				SELECT cl.region
				FROM chw_links cl
				WHERE cl.chw_user_id = u.id
				ORDER BY cl.created_at DESC, cl.id DESC
				LIMIT 1
			), '') AS region,
			COALESCE((
				SELECT COUNT(DISTINCT cl.user_id)
				FROM chw_links cl
				WHERE cl.chw_user_id = u.id
			), 0) AS caseload_count
		FROM users u
		WHERE u.role = ?
		ORDER BY u.name ASC`,
		roleCommunityHealthWorker,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to load CHW directory")
		return
	}
	defer rows.Close()

	for rows.Next() {
		var (
			id            int64
			name          string
			email         string
			phone         string
			region        string
			caseloadCount int
		)
		if err := rows.Scan(&id, &name, &email, &phone, &region, &caseloadCount); err != nil {
			writeError(w, http.StatusInternalServerError, "failed to scan CHW directory")
			return
		}

		registeredByName[canonicalName(name)] = struct{}{}
		items = append(items, map[string]any{
			"id":             id,
			"name":           name,
			"email":          email,
			"phone":          phone,
			"region":         firstNonEmpty(region, "Unassigned"),
			"caseload_count": caseloadCount,
			"is_registered":  true,
		})
	}

	manualRows, err := s.db.Query(
		`SELECT
			chw_name,
			phone,
			region,
			COUNT(DISTINCT user_id) AS caseload_count
		FROM chw_links
		WHERE chw_user_id IS NULL
		GROUP BY LOWER(TRIM(chw_name)), phone, region
		ORDER BY chw_name ASC`,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to load manual CHW links")
		return
	}
	defer manualRows.Close()

	for manualRows.Next() {
		var (
			name          string
			phone         string
			region        string
			caseloadCount int
		)
		if err := manualRows.Scan(&name, &phone, &region, &caseloadCount); err != nil {
			writeError(w, http.StatusInternalServerError, "failed to scan manual CHW links")
			return
		}
		if _, exists := registeredByName[canonicalName(name)]; exists {
			continue
		}

		items = append(items, map[string]any{
			"id":             nil,
			"name":           name,
			"email":          "",
			"phone":          phone,
			"region":         firstNonEmpty(region, "Unassigned"),
			"caseload_count": caseloadCount,
			"is_registered":  false,
		})
	}

	writeJSON(w, http.StatusOK, items)
}

func (s *Server) handleCHWCaseload(w http.ResponseWriter, _ *http.Request, user AuthUser) {
	if err := requireUserRole(user, roleCommunityHealthWorker); err != nil {
		writeError(w, http.StatusForbidden, err.Error())
		return
	}

	rows, err := s.db.Query(
		`SELECT
			u.id,
			u.name,
			u.email,
			u.language,
			cl.region,
			cl.chw_name,
			cl.created_at,
			COALESCE((
				SELECT c.risk_level
				FROM checkins c
				WHERE c.user_id = u.id
				ORDER BY c.created_at DESC, c.id DESC
				LIMIT 1
			), 'not_assessed') AS last_risk_level,
			(
				SELECT c.created_at
				FROM checkins c
				WHERE c.user_id = u.id
				ORDER BY c.created_at DESC, c.id DESC
				LIMIT 1
			) AS last_checkin_at,
			COALESCE((
				SELECT COUNT(1)
				FROM checkins c
				WHERE c.user_id = u.id
			), 0) AS total_checkins
		FROM chw_links cl
		JOIN users u ON u.id = cl.user_id
		WHERE cl.chw_user_id = ?
			OR (cl.chw_user_id IS NULL AND LOWER(TRIM(cl.chw_name)) = LOWER(TRIM(?)))
		ORDER BY cl.created_at DESC, cl.id DESC`,
		user.ID,
		user.Name,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to load CHW caseload")
		return
	}
	defer rows.Close()

	items := make([]map[string]any, 0)
	seenPatients := map[int64]struct{}{}
	for rows.Next() {
		var (
			patientID    int64
			patientName  string
			patientEmail string
			language     string
			region       string
			chwName      string
			linkedAt     time.Time
			lastRisk     string
			lastCheckin  sql.NullTime
			totalCheckin int
		)
		if err := rows.Scan(
			&patientID,
			&patientName,
			&patientEmail,
			&language,
			&region,
			&chwName,
			&linkedAt,
			&lastRisk,
			&lastCheckin,
			&totalCheckin,
		); err != nil {
			writeError(w, http.StatusInternalServerError, "failed to scan CHW caseload")
			return
		}
		if _, exists := seenPatients[patientID]; exists {
			continue
		}
		seenPatients[patientID] = struct{}{}

		items = append(items, map[string]any{
			"patient_id":      patientID,
			"patient_name":    patientName,
			"patient_email":   patientEmail,
			"language":        language,
			"region":          firstNonEmpty(region, "Unassigned"),
			"chw_name":        chwName,
			"linked_at":       linkedAt,
			"last_risk_level": lastRisk,
			"last_checkin_at": func() any {
				if lastCheckin.Valid {
					return lastCheckin.Time
				}
				return nil
			}(),
			"total_checkins": totalCheckin,
		})
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"chw":            user,
		"total_patients": len(items),
		"patients":       items,
	})
}

func (s *Server) handleStartAdmission(w http.ResponseWriter, r *http.Request, user AuthUser) {
	if err := requireUserRole(user, roleMentalHealthUser); err != nil {
		writeError(w, http.StatusForbidden, err.Error())
		return
	}

	var req admissionRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	phq, err := assessPHQ9(req.PHQ9Answers)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if !phq.Provided {
		writeError(w, http.StatusBadRequest, "phq9_answers are required to start admission")
		return
	}

	mood := 5
	if req.Mood != nil {
		mood = *req.Mood
	}
	stress := 4
	if req.Stress != nil {
		stress = *req.Stress
	}
	anxiety := 4
	if req.Anxiety != nil {
		anxiety = *req.Anxiety
	}
	sleepHours := 7.0
	if req.SleepHours != nil {
		sleepHours = *req.SleepHours
	}

	if mood < 1 || mood > 10 || stress < 0 || stress > 10 || anxiety < 0 || anxiety > 10 {
		writeError(w, http.StatusBadRequest, "invalid range for mood, stress, or anxiety")
		return
	}
	if sleepHours < 0 || sleepHours > 24 {
		writeError(w, http.StatusBadRequest, "sleep_hours must be between 0 and 24")
		return
	}

	note := strings.TrimSpace(req.Note)
	if note == "" {
		note = "Admission intake completed with PHQ-9 screening."
	}

	risk := maxRiskLevel(detectRisk(note, mood, stress, anxiety, sleepHours), phq.RiskLevel)

	res, err := s.db.Exec(
		"INSERT INTO checkins(user_id, mood, stress, anxiety, sleep_hours, note, risk_level) VALUES(?, ?, ?, ?, ?, ?, ?)",
		user.ID,
		mood,
		stress,
		anxiety,
		sleepHours,
		note,
		risk,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create admission record")
		return
	}

	checkinID, _ := res.LastInsertId()
	points, _ := s.addRewardPoints(user.ID, 12)
	chwLinked := s.hasLinkedCHW(user.ID)
	recommendation := buildCareRecommendation(risk, phq, chwLinked, user.Language)

	if risk == "medium" || risk == "high" {
		s.createRiskEvent(
			user.ID,
			"admission_phq9",
			risk,
			fmt.Sprintf("Admission PHQ-9 score %d (%s) triggered %s risk triage", phq.Score, humanizeLabel(phq.Severity), risk),
		)
	}

	var createdAt time.Time
	_ = s.db.QueryRow("SELECT created_at FROM checkins WHERE id = ?", checkinID).Scan(&createdAt)

	writeJSON(w, http.StatusCreated, map[string]any{
		"admission_id":            checkinID,
		"risk_level":              risk,
		"created_at":              createdAt,
		"phq9_score":              phq.Score,
		"phq9_severity":           phq.Severity,
		"phq9_risk_level":         phq.RiskLevel,
		"reward_points":           points,
		"recommendation_type":     recommendation.Type,
		"recommendation_message":  recommendation.Message,
		"suggested_actions":       recommendation.Actions,
		"admission_flow_complete": true,
	})
}

func (s *Server) handleCreateCheckin(w http.ResponseWriter, r *http.Request, user AuthUser) {
	if err := requireUserRole(user, roleMentalHealthUser); err != nil {
		writeError(w, http.StatusForbidden, err.Error())
		return
	}

	var req checkinRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	if req.Mood < 1 || req.Mood > 10 || req.Stress < 0 || req.Stress > 10 || req.Anxiety < 0 || req.Anxiety > 10 {
		writeError(w, http.StatusBadRequest, "invalid range for mood, stress, or anxiety")
		return
	}
	if req.SleepHours < 0 || req.SleepHours > 24 {
		writeError(w, http.StatusBadRequest, "sleep_hours must be between 0 and 24")
		return
	}

	note := strings.TrimSpace(req.Note)
	phq, err := assessPHQ9(req.PHQ9Answers)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	risk := detectRisk(note, req.Mood, req.Stress, req.Anxiety, req.SleepHours)
	if phq.Provided {
		risk = maxRiskLevel(risk, phq.RiskLevel)
	}

	res, err := s.db.Exec(
		"INSERT INTO checkins(user_id, mood, stress, anxiety, sleep_hours, note, risk_level) VALUES(?, ?, ?, ?, ?, ?, ?)",
		user.ID,
		req.Mood,
		req.Stress,
		req.Anxiety,
		req.SleepHours,
		note,
		risk,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to save checkin")
		return
	}

	checkinID, _ := res.LastInsertId()
	points, _ := s.addRewardPoints(user.ID, 10)
	chwLinked := s.hasLinkedCHW(user.ID)
	recommendation := buildCareRecommendation(risk, phq, chwLinked, user.Language)

	if risk == "medium" || risk == "high" {
		eventMessage := "early detection flagged from check-in values"
		if phq.Provided {
			eventMessage = fmt.Sprintf("PHQ-9 score %d (%s) with check-in values requires follow-up", phq.Score, humanizeLabel(phq.Severity))
		}
		s.createRiskEvent(user.ID, "checkin", risk, eventMessage)
	}

	var createdAt time.Time
	_ = s.db.QueryRow("SELECT created_at FROM checkins WHERE id = ?", checkinID).Scan(&createdAt)

	response := map[string]any{
		"id":                     checkinID,
		"risk_level":             risk,
		"created_at":             createdAt,
		"reward_points":          points,
		"recommendation_type":    recommendation.Type,
		"recommendation_message": recommendation.Message,
		"suggested_actions":      recommendation.Actions,
	}
	if phq.Provided {
		response["phq9_score"] = phq.Score
		response["phq9_severity"] = phq.Severity
		response["phq9_risk_level"] = phq.RiskLevel
	} else {
		response["phq9_score"] = nil
		response["phq9_severity"] = "not_assessed"
		response["phq9_risk_level"] = "not_assessed"
	}

	writeJSON(w, http.StatusCreated, response)
}

func (s *Server) handleListCheckins(w http.ResponseWriter, _ *http.Request, user AuthUser) {
	if err := requireUserRole(user, roleMentalHealthUser); err != nil {
		writeError(w, http.StatusForbidden, err.Error())
		return
	}

	rows, err := s.db.Query(
		"SELECT id, mood, stress, anxiety, sleep_hours, note, risk_level, created_at FROM checkins WHERE user_id = ? ORDER BY created_at DESC LIMIT 40",
		user.ID,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to fetch checkins")
		return
	}
	defer rows.Close()

	items := make([]moodRecord, 0)
	for rows.Next() {
		var item moodRecord
		if err := rows.Scan(&item.ID, &item.Mood, &item.Stress, &item.Anxiety, &item.SleepHours, &item.Note, &item.RiskLevel, &item.CreatedAt); err != nil {
			writeError(w, http.StatusInternalServerError, "failed to scan checkins")
			return
		}
		items = append(items, item)
	}

	writeJSON(w, http.StatusOK, items)
}

func (s *Server) handleCreateJournal(w http.ResponseWriter, r *http.Request, user AuthUser) {
	if err := requireUserRole(user, roleMentalHealthUser); err != nil {
		writeError(w, http.StatusForbidden, err.Error())
		return
	}

	var req struct {
		Entry string `json:"entry"`
	}
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	entry := strings.TrimSpace(req.Entry)
	if entry == "" {
		writeError(w, http.StatusBadRequest, "entry is required")
		return
	}

	res, err := s.db.Exec("INSERT INTO journal_entries(user_id, entry) VALUES(?, ?)", user.ID, entry)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to save journal")
		return
	}
	journalID, _ := res.LastInsertId()
	points, _ := s.addRewardPoints(user.ID, 5)

	risk := detectRisk(entry, 5, 4, 4, 7)
	if risk == "medium" || risk == "high" {
		s.createRiskEvent(user.ID, "journal", risk, "risk keywords detected in journal entry")
	}

	writeJSON(w, http.StatusCreated, map[string]any{
		"id":            journalID,
		"risk_level":    risk,
		"reward_points": points,
	})
}

func (s *Server) handleListJournal(w http.ResponseWriter, _ *http.Request, user AuthUser) {
	if err := requireUserRole(user, roleMentalHealthUser); err != nil {
		writeError(w, http.StatusForbidden, err.Error())
		return
	}

	rows, err := s.db.Query(
		"SELECT id, entry, created_at FROM journal_entries WHERE user_id = ? ORDER BY created_at DESC LIMIT 30",
		user.ID,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to fetch journal entries")
		return
	}
	defer rows.Close()

	items := make([]map[string]any, 0)
	for rows.Next() {
		var id int64
		var entry string
		var createdAt time.Time
		if err := rows.Scan(&id, &entry, &createdAt); err != nil {
			writeError(w, http.StatusInternalServerError, "failed to scan journal entries")
			return
		}
		items = append(items, map[string]any{"id": id, "entry": entry, "created_at": createdAt})
	}

	writeJSON(w, http.StatusOK, items)
}

func (s *Server) handleCreateReminder(w http.ResponseWriter, r *http.Request, user AuthUser) {
	if err := requireUserRole(user, roleMentalHealthUser); err != nil {
		writeError(w, http.StatusForbidden, err.Error())
		return
	}

	var req reminderRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	req.Title = strings.TrimSpace(req.Title)
	req.ScheduleTime = strings.TrimSpace(req.ScheduleTime)
	if req.Title == "" || req.ScheduleTime == "" {
		writeError(w, http.StatusBadRequest, "title and schedule_time are required")
		return
	}

	res, err := s.db.Exec(
		"INSERT INTO reminders(user_id, title, schedule_time) VALUES(?, ?, ?)",
		user.ID,
		req.Title,
		req.ScheduleTime,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create reminder")
		return
	}

	id, _ := res.LastInsertId()
	writeJSON(w, http.StatusCreated, map[string]any{"id": id, "message": "AI reminder saved"})
}

func (s *Server) handleListReminders(w http.ResponseWriter, _ *http.Request, user AuthUser) {
	if err := requireUserRole(user, roleMentalHealthUser); err != nil {
		writeError(w, http.StatusForbidden, err.Error())
		return
	}

	rows, err := s.db.Query(
		"SELECT id, title, schedule_time, is_active, created_at FROM reminders WHERE user_id = ? ORDER BY created_at DESC LIMIT 50",
		user.ID,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list reminders")
		return
	}
	defer rows.Close()

	items := make([]map[string]any, 0)
	for rows.Next() {
		var (
			id           int64
			title        string
			scheduleTime string
			isActive     int
			createdAt    time.Time
		)
		if err := rows.Scan(&id, &title, &scheduleTime, &isActive, &createdAt); err != nil {
			writeError(w, http.StatusInternalServerError, "failed to scan reminders")
			return
		}
		items = append(items, map[string]any{
			"id":            id,
			"title":         title,
			"schedule_time": scheduleTime,
			"is_active":     isActive == 1,
			"created_at":    createdAt,
		})
	}

	writeJSON(w, http.StatusOK, items)
}

func (s *Server) handleCreateAppointment(w http.ResponseWriter, r *http.Request, user AuthUser) {
	if err := requireUserRole(user, roleMentalHealthUser); err != nil {
		writeError(w, http.StatusForbidden, err.Error())
		return
	}

	var req appointmentRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	req.Therapist = strings.TrimSpace(req.Therapist)
	req.SessionMode = strings.TrimSpace(req.SessionMode)
	req.AppointmentTime = strings.TrimSpace(req.AppointmentTime)

	if req.Therapist == "" || req.SessionMode == "" || req.AppointmentTime == "" {
		writeError(w, http.StatusBadRequest, "therapist, session_mode, and appointment_time are required")
		return
	}

	res, err := s.db.Exec(
		"INSERT INTO appointments(user_id, therapist, session_mode, appointment_time) VALUES(?, ?, ?, ?)",
		user.ID,
		req.Therapist,
		req.SessionMode,
		req.AppointmentTime,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to book appointment")
		return
	}

	id, _ := res.LastInsertId()
	points, _ := s.addRewardPoints(user.ID, 15)
	_, _ = s.db.Exec(
		"INSERT INTO reminders(user_id, title, schedule_time) VALUES(?, ?, ?)",
		user.ID,
		"Therapy session reminder",
		req.AppointmentTime,
	)

	writeJSON(w, http.StatusCreated, map[string]any{
		"id":            id,
		"reward_points": points,
		"message":       "virtual therapist session booked",
	})
}

func (s *Server) handleListAppointments(w http.ResponseWriter, _ *http.Request, user AuthUser) {
	if err := requireUserRole(user, roleMentalHealthUser); err != nil {
		writeError(w, http.StatusForbidden, err.Error())
		return
	}

	rows, err := s.db.Query(
		"SELECT id, therapist, session_mode, appointment_time, status, created_at FROM appointments WHERE user_id = ? ORDER BY appointment_time ASC LIMIT 50",
		user.ID,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list appointments")
		return
	}
	defer rows.Close()

	items := make([]map[string]any, 0)
	for rows.Next() {
		var (
			id              int64
			therapist       string
			sessionMode     string
			appointmentTime string
			status          string
			createdAt       time.Time
		)
		if err := rows.Scan(&id, &therapist, &sessionMode, &appointmentTime, &status, &createdAt); err != nil {
			writeError(w, http.StatusInternalServerError, "failed to scan appointments")
			return
		}
		items = append(items, map[string]any{
			"id":               id,
			"therapist":        therapist,
			"session_mode":     sessionMode,
			"appointment_time": appointmentTime,
			"status":           status,
			"created_at":       createdAt,
		})
	}

	writeJSON(w, http.StatusOK, items)
}

func (s *Server) handleCreateCommunityMessage(w http.ResponseWriter, r *http.Request, user AuthUser) {
	var req communityMessageRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	req.Room = strings.TrimSpace(strings.ToLower(req.Room))
	req.Message = strings.TrimSpace(req.Message)
	if req.Room == "" || req.Message == "" {
		writeError(w, http.StatusBadRequest, "room and message are required")
		return
	}

	res, err := s.db.Exec(
		"INSERT INTO community_messages(user_id, room, message) VALUES(?, ?, ?)",
		user.ID,
		req.Room,
		req.Message,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to save message")
		return
	}

	id, _ := res.LastInsertId()
	writeJSON(w, http.StatusCreated, map[string]any{"id": id, "message": "message posted"})
}

func (s *Server) handleListCommunityMessages(w http.ResponseWriter, r *http.Request, _ AuthUser) {
	room := strings.TrimSpace(strings.ToLower(r.URL.Query().Get("room")))
	if room == "" {
		room = "students"
	}

	rows, err := s.db.Query(
		`SELECT m.id, m.room, m.message, m.created_at, u.name
		 FROM community_messages m
		 JOIN users u ON u.id = m.user_id
		 WHERE m.room = ?
		 ORDER BY m.created_at DESC
		 LIMIT 80`,
		room,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list community messages")
		return
	}
	defer rows.Close()

	items := make([]map[string]any, 0)
	for rows.Next() {
		var (
			id        int64
			roomName  string
			message   string
			createdAt time.Time
			name      string
		)
		if err := rows.Scan(&id, &roomName, &message, &createdAt, &name); err != nil {
			writeError(w, http.StatusInternalServerError, "failed to scan community messages")
			return
		}
		items = append(items, map[string]any{
			"id":         id,
			"room":       roomName,
			"message":    message,
			"created_at": createdAt,
			"name":       name,
		})
	}

	writeJSON(w, http.StatusOK, items)
}

func (s *Server) handleSimulateUSSD(w http.ResponseWriter, r *http.Request, user AuthUser) {
	if err := requireUserRole(user, roleMentalHealthUser); err != nil {
		writeError(w, http.StatusForbidden, err.Error())
		return
	}

	var req ussdRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	code := strings.TrimSpace(req.Code)
	response := "Invalid USSD code"
	actions := make([]string, 0)

	switch code {
	case "*384#":
		response = "1.Mood Check-in 2.Crisis Help 3.CHW Link 4.Daily Motivation"
	case "1":
		_, _ = s.db.Exec(
			"INSERT INTO checkins(user_id, mood, stress, anxiety, sleep_hours, note, risk_level) VALUES(?, 5, 4, 4, 7, ?, 'low')",
			user.ID,
			"USSD quick check-in",
		)
		points, _ := s.addRewardPoints(user.ID, 5)
		response = fmt.Sprintf("Mood check-in recorded. Reward points: %d", points)
		actions = append(actions, "checkin_recorded", "reward_added")
	case "2":
		s.createRiskEvent(user.ID, "ussd", "high", "user requested crisis help via USSD")
		response = "Crisis line triggered. Call 1199 immediately. Counselor alerted."
		actions = append(actions, "risk_alert")
	case "3":
		response = "To link CHW, go to the CHW section and submit CHW name + phone + region."
	case "4":
		response = pickMotivation(normalizeLanguage(user.Language))
		actions = append(actions, "motivation_generated")
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"code":     code,
		"response": response,
		"actions":  actions,
	})
}

func (s *Server) handleGetRewards(w http.ResponseWriter, _ *http.Request, user AuthUser) {
	if err := requireUserRole(user, roleMentalHealthUser); err != nil {
		writeError(w, http.StatusForbidden, err.Error())
		return
	}

	points, err := s.getRewardPoints(user.ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to load rewards")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"points": points})
}

func (s *Server) handleRedeemRewards(w http.ResponseWriter, r *http.Request, user AuthUser) {
	if err := requireUserRole(user, roleMentalHealthUser); err != nil {
		writeError(w, http.StatusForbidden, err.Error())
		return
	}

	var req redeemRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	amount := req.AmountPoints
	if amount <= 0 {
		amount = 50
	}

	remaining, err := s.deductRewardPoints(user.ID, amount)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	reference := fmt.Sprintf("MPESA-%d", time.Now().UnixNano())
	writeJSON(w, http.StatusOK, map[string]any{
		"message":          "M-Pesa reward redemption simulated successfully",
		"amount_points":    amount,
		"remaining_points": remaining,
		"mpesa_reference":  reference,
	})
}

func (s *Server) handleGenerateCertificate(w http.ResponseWriter, _ *http.Request, user AuthUser) {
	if err := requireUserRole(user, roleMentalHealthUser); err != nil {
		writeError(w, http.StatusForbidden, err.Error())
		return
	}

	rows, err := s.db.Query(
		"SELECT mood, risk_level FROM checkins WHERE user_id = ? ORDER BY created_at DESC LIMIT 14",
		user.ID,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to load checkins")
		return
	}
	defer rows.Close()

	totalMood := 0
	count := 0
	highCount := 0
	for rows.Next() {
		var mood int
		var risk string
		if err := rows.Scan(&mood, &risk); err != nil {
			writeError(w, http.StatusInternalServerError, "failed to scan checkins")
			return
		}
		totalMood += mood
		count++
		if risk == "high" {
			highCount++
		}
	}

	avgMood := 0.0
	if count > 0 {
		avgMood = float64(totalMood) / float64(count)
	}

	status := "Stable"
	summary := "Consistent follow-up recommended"
	if highCount >= 2 || avgMood < 4 {
		status = "Needs Intensive Follow-up"
		summary = "Multiple high-risk indicators detected"
	} else if avgMood < 6 {
		status = "Needs Follow-up"
		summary = "Moderate symptoms present; keep therapy and CHW support active"
	}

	res, err := s.db.Exec(
		"INSERT INTO certificates(user_id, status, summary) VALUES(?, ?, ?)",
		user.ID,
		status,
		summary,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to store certificate")
		return
	}
	certID, _ := res.LastInsertId()

	writeJSON(w, http.StatusOK, map[string]any{
		"certificate_id": certID,
		"status":         status,
		"summary":        summary,
		"avg_mood":       avgMood,
		"created_at":     time.Now().UTC(),
	})
}

func (s *Server) handleDashboardSummary(w http.ResponseWriter, _ *http.Request, user AuthUser) {
	if normalizeRole(user.Role) == roleCommunityHealthWorker {
		var (
			totalPatients     int
			totalHighRisk     int
			totalAppointments int
			totalCommunity    int
		)

		_ = s.db.QueryRow(
			`SELECT COUNT(DISTINCT cl.user_id)
			FROM chw_links cl
			WHERE cl.chw_user_id = ?
				OR (cl.chw_user_id IS NULL AND LOWER(TRIM(cl.chw_name)) = LOWER(TRIM(?)))`,
			user.ID,
			user.Name,
		).Scan(&totalPatients)

		_ = s.db.QueryRow(
			`SELECT COUNT(1)
			FROM checkins c
			WHERE c.user_id IN (
				SELECT DISTINCT cl.user_id
				FROM chw_links cl
				WHERE cl.chw_user_id = ?
					OR (cl.chw_user_id IS NULL AND LOWER(TRIM(cl.chw_name)) = LOWER(TRIM(?)))
			)
			AND c.risk_level IN ('medium', 'high')`,
			user.ID,
			user.Name,
		).Scan(&totalHighRisk)

		_ = s.db.QueryRow(
			`SELECT COUNT(1)
			FROM appointments a
			WHERE a.user_id IN (
				SELECT DISTINCT cl.user_id
				FROM chw_links cl
				WHERE cl.chw_user_id = ?
					OR (cl.chw_user_id IS NULL AND LOWER(TRIM(cl.chw_name)) = LOWER(TRIM(?)))
			)`,
			user.ID,
			user.Name,
		).Scan(&totalAppointments)

		_ = s.db.QueryRow("SELECT COUNT(1) FROM community_messages").Scan(&totalCommunity)

		writeJSON(w, http.StatusOK, summaryResponse{
			User:              user,
			Points:            0,
			CHWLinked:         true,
			TotalCheckins:     totalPatients,
			TotalRiskEvents:   totalHighRisk,
			TotalAppointments: totalAppointments,
			TotalCommunity:    totalCommunity,
			LastRiskLevel:     "monitoring",
		})
		return
	}

	points, _ := s.getRewardPoints(user.ID)
	chwLinked := false
	var totalCheckins, totalRisk, totalAppointments, totalCommunity, linkedCount int
	var lastRisk string

	_ = s.db.QueryRow("SELECT COUNT(1) FROM chw_links WHERE user_id = ?", user.ID).Scan(&linkedCount)
	chwLinked = linkedCount > 0

	_ = s.db.QueryRow("SELECT COUNT(1) FROM checkins WHERE user_id = ?", user.ID).Scan(&totalCheckins)
	_ = s.db.QueryRow("SELECT COUNT(1) FROM risk_events WHERE user_id = ?", user.ID).Scan(&totalRisk)
	_ = s.db.QueryRow("SELECT COUNT(1) FROM appointments WHERE user_id = ?", user.ID).Scan(&totalAppointments)
	_ = s.db.QueryRow("SELECT COUNT(1) FROM community_messages").Scan(&totalCommunity)
	_ = s.db.QueryRow("SELECT COALESCE((SELECT risk_level FROM checkins WHERE user_id = ? ORDER BY created_at DESC LIMIT 1), 'low')", user.ID).Scan(&lastRisk)

	writeJSON(w, http.StatusOK, summaryResponse{
		User:              user,
		Points:            points,
		CHWLinked:         chwLinked,
		TotalCheckins:     totalCheckins,
		TotalRiskEvents:   totalRisk,
		TotalAppointments: totalAppointments,
		TotalCommunity:    totalCommunity,
		LastRiskLevel:     lastRisk,
	})
}

func (s *Server) handleSendSMS(w http.ResponseWriter, r *http.Request, user AuthUser) {
	var req smsRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	req.To = strings.TrimSpace(req.To)
	req.Message = strings.TrimSpace(req.Message)
	if req.To == "" || req.Message == "" {
		writeError(w, http.StatusBadRequest, "to and message are required")
		return
	}

	result, err := s.sendSMSViaDevText(r.Context(), req.To, req.Message)
	if err != nil {
		writeError(w, http.StatusBadGateway, err.Error())
		return
	}

	_, _ = s.db.Exec(
		"INSERT INTO sms_logs(user_id, to_number, message, provider_status, provider_id) VALUES(?, ?, ?, ?, ?)",
		user.ID,
		req.To,
		req.Message,
		result.ProviderStatus,
		result.ProviderID,
	)

	writeJSON(w, http.StatusOK, result)
}

func (s *Server) handleSendMotivation(w http.ResponseWriter, r *http.Request, user AuthUser) {
	var req motivationRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	lang := normalizeLanguage(req.Language)
	if lang == "" {
		lang = user.Language
	}
	message := pickMotivation(lang)

	if strings.TrimSpace(req.To) == "" {
		writeJSON(w, http.StatusOK, map[string]any{"message": message, "language": lang})
		return
	}

	result, err := s.sendSMSViaDevText(r.Context(), strings.TrimSpace(req.To), message)
	if err != nil {
		writeError(w, http.StatusBadGateway, err.Error())
		return
	}

	_, _ = s.db.Exec(
		"INSERT INTO sms_logs(user_id, to_number, message, provider_status, provider_id) VALUES(?, ?, ?, ?, ?)",
		user.ID,
		strings.TrimSpace(req.To),
		message,
		result.ProviderStatus,
		result.ProviderID,
	)

	writeJSON(w, http.StatusOK, map[string]any{
		"message":  message,
		"language": lang,
		"provider": result,
	})
}

func (s *Server) handleVoiceHelpline(w http.ResponseWriter, r *http.Request, user AuthUser) {
	var req struct {
		Language string `json:"language"`
	}
	_ = decodeJSONAllowEmpty(r, &req)
	lang := normalizeLanguage(req.Language)
	if lang == "" {
		lang = user.Language
	}

	script := map[string]string{
		"en": "You are safe. Breathe in for four, hold for four, out for six. Help is available now.",
		"sw": "Uko salama. Vuta pumzi sekunde nne, shikilia nne, toa sita. Msaada upo sasa.",
		"fr": "Vous etes en securite. Inspirez quatre secondes, retenez quatre, expirez six. De l'aide est disponible.",
		"es": "Estas a salvo. Inhala cuatro segundos, sostén cuatro, exhala seis. Hay ayuda disponible ahora.",
		"ar": "You are safe. Breathe in for four, hold for four, out for six. Help is available now.",
	}[lang]

	writeJSON(w, http.StatusOK, map[string]any{"language": lang, "script": script})
}

func (s *Server) handleResources(w http.ResponseWriter, _ *http.Request, _ AuthUser) {
	resources := []resourceItem{
		{Category: "depression", Title: "Understanding Depression", Summary: "Signs, support options, and recovery steps."},
		{Category: "anxiety", Title: "Grounding for Anxiety", Summary: "Fast regulation techniques during panic."},
		{Category: "stress", Title: "Stress Recovery Plan", Summary: "Practical daily structure to reduce overload."},
		{Category: "sleep", Title: "Sleep Hygiene", Summary: "Habits that improve sleep quality."},
		{Category: "crisis", Title: "Crisis Contacts", Summary: "Immediate actions for suicidal or high-risk distress."},
	}
	writeJSON(w, http.StatusOK, resources)
}

func (s *Server) handleAIAssistant(w http.ResponseWriter, r *http.Request, user AuthUser) {
	var req aiRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	prompt := strings.TrimSpace(req.Prompt)
	if prompt == "" {
		writeError(w, http.StatusBadRequest, "prompt is required")
		return
	}

	risk := detectRisk(prompt, 5, 4, 4, 7)
	if risk == "medium" || risk == "high" {
		s.createRiskEvent(user.ID, "ai_assistant", risk, "risk keywords detected in AI assistant prompt")
	}

	lang := normalizeLanguage(req.Language)
	if strings.TrimSpace(req.Language) == "" {
		lang = normalizeLanguage(user.Language)
	}
	reply, model := s.generateChatAssistantReply(r.Context(), prompt, lang, risk)
	suggested := suggestedActionsByRisk(risk)

	writeJSON(w, http.StatusOK, map[string]any{
		"model":             model,
		"reply":             reply,
		"suggested_actions": suggested,
		"risk_level":        risk,
	})
}

func (s *Server) generateChatAssistantReply(ctx context.Context, prompt, language, risk string) (string, string) {
	fallbackReply, _ := fallbackAssistantReply(prompt)
	switch normalizeAIProvider(s.aiProvider) {
	case "llama":
		reply, err := s.callLlamaChatCompletion(ctx, prompt, language, risk)
		if err == nil {
			return reply, "Llama-Local"
		}
		log.Printf("llama fallback: %v", err)
		if strings.TrimSpace(s.openAIAPIKey) != "" {
			openAIReply, openAIErr := s.callOpenAIChatCompletion(ctx, prompt, language, risk)
			if openAIErr == nil {
				return openAIReply, "ChatGPT"
			}
			log.Printf("chatgpt fallback after llama: %v", openAIErr)
		}
		return fallbackReply, "MindBridge-Free"

	case "openai":
		if strings.TrimSpace(s.openAIAPIKey) == "" {
			return fallbackReply, "MindBridge-Free"
		}
		reply, err := s.callOpenAIChatCompletion(ctx, prompt, language, risk)
		if err != nil {
			log.Printf("chatgpt fallback: %v", err)
			return fallbackReply, "MindBridge-Free"
		}
		return reply, "ChatGPT"

	default:
		return fallbackReply, "MindBridge-Free"
	}
}

func (s *Server) callLlamaChatCompletion(ctx context.Context, prompt, language, risk string) (string, error) {
	lang := normalizeLanguage(language)
	systemPrompt := fmt.Sprintf(
		"You are a mental wellness support assistant. Reply in %s with empathy, natural flow, and short actionable guidance. Do not diagnose. When useful, ask one gentle follow-up question. Keep it under 120 words. If risk is high, prioritize immediate support, safety, and crisis guidance.",
		languageDisplayName(lang),
	)
	userPrompt := fmt.Sprintf("User message: %s\nDetected risk: %s", prompt, risk)

	payload := map[string]any{
		"model": s.llamaModel,
		"messages": []map[string]string{
			{"role": "system", "content": systemPrompt},
			{"role": "user", "content": userPrompt},
		},
		"stream": false,
		"options": map[string]any{
			"temperature": 0.6,
		},
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return "", err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, s.llamaChatURL, strings.NewReader(string(body)))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("llama request failed: %w", err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(io.LimitReader(resp.Body, 2<<20))
	if resp.StatusCode >= 300 {
		return "", fmt.Errorf("llama error (%d): %s", resp.StatusCode, strings.TrimSpace(string(respBody)))
	}

	var raw map[string]any
	if err := json.Unmarshal(respBody, &raw); err != nil {
		return "", fmt.Errorf("llama invalid response: %w", err)
	}

	reply := extractLlamaReply(raw)
	if strings.TrimSpace(reply) == "" {
		reply = extractChatReply(raw)
	}
	if strings.TrimSpace(reply) == "" {
		return "", errors.New("llama returned an empty reply")
	}
	return strings.TrimSpace(reply), nil
}

func (s *Server) callOpenAIChatCompletion(ctx context.Context, prompt, language, risk string) (string, error) {
	lang := normalizeLanguage(language)
	systemPrompt := fmt.Sprintf(
		"You are ChatGPT for MindBridge mental wellness support. Reply in %s with empathy, natural flow, and practical next steps. Do not diagnose. When useful, ask one gentle follow-up question. Keep it under 120 words. If risk is high, prioritize immediate support, safety, and crisis guidance.",
		languageDisplayName(lang),
	)
	userPrompt := fmt.Sprintf("User message: %s\nDetected risk: %s", prompt, risk)

	payload := map[string]any{
		"model": s.openAIModel,
		"messages": []map[string]string{
			{"role": "system", "content": systemPrompt},
			{"role": "user", "content": userPrompt},
		},
		"temperature": 0.6,
		"max_tokens":  220,
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return "", err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, s.openAIChatURL, strings.NewReader(string(body)))
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", "Bearer "+s.openAIAPIKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("chatgpt request failed: %w", err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if resp.StatusCode >= 300 {
		return "", fmt.Errorf("chatgpt error (%d): %s", resp.StatusCode, strings.TrimSpace(string(respBody)))
	}

	var raw map[string]any
	if err := json.Unmarshal(respBody, &raw); err != nil {
		return "", fmt.Errorf("chatgpt invalid response: %w", err)
	}

	reply := extractChatReply(raw)
	if strings.TrimSpace(reply) == "" {
		return "", errors.New("chatgpt returned an empty reply")
	}
	return strings.TrimSpace(reply), nil
}

func extractChatReply(raw map[string]any) string {
	choices, ok := raw["choices"].([]any)
	if !ok || len(choices) == 0 {
		return ""
	}
	first, ok := choices[0].(map[string]any)
	if !ok {
		return ""
	}
	message, ok := first["message"].(map[string]any)
	if !ok {
		return ""
	}

	content, ok := message["content"]
	if !ok {
		return ""
	}
	if text, ok := content.(string); ok {
		return text
	}

	parts, ok := content.([]any)
	if !ok {
		return ""
	}
	lines := make([]string, 0, len(parts))
	for _, item := range parts {
		part, ok := item.(map[string]any)
		if !ok {
			continue
		}
		if text, ok := part["text"].(string); ok && strings.TrimSpace(text) != "" {
			lines = append(lines, strings.TrimSpace(text))
		}
	}
	return strings.Join(lines, "\n")
}

func extractLlamaReply(raw map[string]any) string {
	if message, ok := raw["message"].(map[string]any); ok {
		if content, ok := message["content"].(string); ok {
			return strings.TrimSpace(content)
		}
	}
	if response, ok := raw["response"].(string); ok {
		return strings.TrimSpace(response)
	}
	return ""
}

func fallbackAssistantReply(prompt string) (string, string) {
	normalized := strings.ToLower(strings.TrimSpace(prompt))
	reply := "Let us slow things down together. Try a 10-minute reset: breathe, hydrate, and message someone you trust. What feels heaviest right now?"
	source := "fallback"

	switch {
	case strings.Contains(normalized, "panic"):
		reply = "Start 5-4-3-2-1 grounding right now, then slow your breathing. If the panic keeps rising, contact a counselor or trusted person immediately."
	case strings.Contains(normalized, "sleep"):
		reply = "Keep lights low, avoid caffeine late in the day, and try 4-7-8 breathing before bed. Would you like a short bedtime routine?"
	case strings.Contains(normalized, "sad") || strings.Contains(normalized, "depress"):
		reply = "Pick one small task you can finish now, then reach out to someone you trust for support. You do not have to carry this alone."
	case strings.Contains(normalized, "alone"):
		reply = "You are not alone. Consider joining a community room or booking a therapist session today. A short check-in with someone safe can help."
	}

	return reply, source
}

func suggestedActionsByRisk(risk string) []string {
	switch strings.ToLower(strings.TrimSpace(risk)) {
	case "high":
		return []string{"Call crisis contact now", "Contact CHW immediately", "Stay with a trusted person"}
	case "medium":
		return []string{"Use grounding exercise", "Book therapist follow-up", "Share update with CHW"}
	default:
		return []string{"Box breathing", "Short walk", "Journal one page"}
	}
}

func languageDisplayName(language string) string {
	switch normalizeLanguage(language) {
	case "sw":
		return "Kiswahili"
	case "fr":
		return "French"
	case "es":
		return "Spanish"
	case "ar":
		return "Arabic"
	default:
		return "English"
	}
}

func (s *Server) serveFrontend(w http.ResponseWriter, r *http.Request) {
	if strings.HasPrefix(r.URL.Path, "/api/") {
		writeError(w, http.StatusNotFound, "route not found")
		return
	}

	dist := s.frontendDist
	cleanPath := filepath.Clean("/" + r.URL.Path)
	relPath := strings.TrimPrefix(cleanPath, "/")
	if relPath == "" {
		relPath = "index.html"
	}

	target := filepath.Join(dist, relPath)
	distClean := filepath.Clean(dist)
	targetClean := filepath.Clean(target)
	if !strings.HasPrefix(targetClean, distClean) {
		writeError(w, http.StatusBadRequest, "invalid path")
		return
	}

	if info, err := os.Stat(targetClean); err == nil && !info.IsDir() {
		http.ServeFile(w, r, targetClean)
		return
	}

	indexPath := filepath.Join(dist, "index.html")
	if _, err := os.Stat(indexPath); err != nil {
		writeError(w, http.StatusServiceUnavailable, "frontend not built yet; run npm run build in frontend")
		return
	}
	http.ServeFile(w, r, indexPath)
}

func (s *Server) withAuth(handler func(http.ResponseWriter, *http.Request, AuthUser)) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user, err := s.authenticate(r)
		if err != nil {
			writeError(w, http.StatusUnauthorized, err.Error())
			return
		}
		handler(w, r, user)
	}
}

func (s *Server) authenticate(r *http.Request) (AuthUser, error) {
	auth := strings.TrimSpace(r.Header.Get("Authorization"))
	if auth == "" {
		return AuthUser{}, errors.New("missing Authorization header")
	}
	const prefix = "Bearer "
	if !strings.HasPrefix(auth, prefix) {
		return AuthUser{}, errors.New("authorization must be Bearer <token>")
	}
	token := strings.TrimSpace(strings.TrimPrefix(auth, prefix))
	if token == "" {
		return AuthUser{}, errors.New("missing bearer token")
	}

	var (
		user      AuthUser
		expiresAt time.Time
	)

	err := s.db.QueryRow(
		`SELECT u.id, u.name, u.email, u.language, u.role, sess.expires_at
		 FROM sessions sess
		 JOIN users u ON u.id = sess.user_id
		 WHERE sess.token = ?`,
		token,
	).Scan(&user.ID, &user.Name, &user.Email, &user.Language, &user.Role, &expiresAt)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return AuthUser{}, errors.New("invalid session token")
		}
		return AuthUser{}, errors.New("failed to validate session")
	}

	if time.Now().UTC().After(expiresAt) {
		_, _ = s.db.Exec("DELETE FROM sessions WHERE token = ?", token)
		return AuthUser{}, errors.New("session expired")
	}
	user.Role = normalizeRole(user.Role)

	return user, nil
}

func (s *Server) createSession(userID int64) (string, error) {
	token, err := generateToken(32)
	if err != nil {
		return "", err
	}

	expiresAt := time.Now().UTC().Add(7 * 24 * time.Hour)
	_, err = s.db.Exec("INSERT INTO sessions(user_id, token, expires_at) VALUES(?, ?, ?)", userID, token, expiresAt)
	if err != nil {
		return "", err
	}
	return token, nil
}

func (s *Server) getUserByID(id int64) (AuthUser, error) {
	var user AuthUser
	err := s.db.QueryRow("SELECT id, name, email, language, role FROM users WHERE id = ?", id).Scan(&user.ID, &user.Name, &user.Email, &user.Language, &user.Role)
	user.Role = normalizeRole(user.Role)
	return user, err
}

func (s *Server) addRewardPoints(userID int64, points int) (int, error) {
	_, err := s.db.Exec(
		`INSERT INTO rewards(user_id, points, updated_at)
		 VALUES(?, ?, CURRENT_TIMESTAMP)
		 ON CONFLICT(user_id) DO UPDATE SET points = rewards.points + excluded.points, updated_at = CURRENT_TIMESTAMP`,
		userID,
		points,
	)
	if err != nil {
		return 0, err
	}
	return s.getRewardPoints(userID)
}

func (s *Server) getRewardPoints(userID int64) (int, error) {
	_, _ = s.db.Exec("INSERT OR IGNORE INTO rewards(user_id, points) VALUES(?, 0)", userID)
	var points int
	err := s.db.QueryRow("SELECT points FROM rewards WHERE user_id = ?", userID).Scan(&points)
	return points, err
}

func (s *Server) deductRewardPoints(userID int64, points int) (int, error) {
	tx, err := s.db.Begin()
	if err != nil {
		return 0, err
	}
	defer tx.Rollback()

	if _, err := tx.Exec("INSERT OR IGNORE INTO rewards(user_id, points) VALUES(?, 0)", userID); err != nil {
		return 0, err
	}

	var current int
	if err := tx.QueryRow("SELECT points FROM rewards WHERE user_id = ?", userID).Scan(&current); err != nil {
		return 0, err
	}
	if current < points {
		return 0, fmt.Errorf("not enough reward points (have %d)", current)
	}

	if _, err := tx.Exec("UPDATE rewards SET points = points - ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?", points, userID); err != nil {
		return 0, err
	}

	if err := tx.QueryRow("SELECT points FROM rewards WHERE user_id = ?", userID).Scan(&current); err != nil {
		return 0, err
	}

	if err := tx.Commit(); err != nil {
		return 0, err
	}

	return current, nil
}

func (s *Server) createRiskEvent(userID int64, source, severity, message string) {
	_, _ = s.db.Exec(
		"INSERT INTO risk_events(user_id, source, severity, message) VALUES(?, ?, ?, ?)",
		userID,
		source,
		severity,
		message,
	)
}

func (s *Server) hasLinkedCHW(userID int64) bool {
	var count int
	_ = s.db.QueryRow("SELECT COUNT(1) FROM chw_links WHERE user_id = ?", userID).Scan(&count)
	return count > 0
}

func (s *Server) sendSMSViaDevText(ctx context.Context, to, message string) (smsProviderResponse, error) {
	if strings.TrimSpace(s.smsAPIKey) == "" {
		return smsProviderResponse{}, errors.New("DEVTEXT_API_KEY is missing on backend")
	}

	payload := map[string]any{
		"to":             to,
		"message":        message,
		"correlation_id": fmt.Sprintf("mh-%d", time.Now().UnixNano()),
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return smsProviderResponse{}, err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, s.smsURL, strings.NewReader(string(body)))
	if err != nil {
		return smsProviderResponse{}, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-API-Key", s.smsAPIKey)

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return smsProviderResponse{}, fmt.Errorf("failed to call sms provider: %w", err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	providerRaw := map[string]any{}
	_ = json.Unmarshal(respBody, &providerRaw)

	if resp.StatusCode >= 300 {
		return smsProviderResponse{}, fmt.Errorf("sms provider error (%d): %s", resp.StatusCode, strings.TrimSpace(string(respBody)))
	}

	providerStatus := firstNonEmpty(
		stringFromMap(providerRaw, "status"),
		stringFromNestedMap(providerRaw, "message", "status"),
		"queued",
	)
	providerID := firstNonEmpty(
		stringFromMap(providerRaw, "id"),
		stringFromMap(providerRaw, "message_id"),
		stringFromNestedMap(providerRaw, "message", "id"),
		"n/a",
	)

	return smsProviderResponse{
		ProviderStatus: providerStatus,
		ProviderID:     providerID,
		ProviderRaw:    providerRaw,
	}, nil
}

func detectRisk(text string, mood, stress, anxiety int, sleepHours float64) string {
	normalized := strings.ToLower(strings.TrimSpace(text))
	highSignals := []string{"suicide", "kill myself", "end my life", "hopeless", "no reason to live"}
	mediumSignals := []string{"overwhelmed", "panic", "anxious", "can't sleep", "alone"}

	for _, item := range highSignals {
		if strings.Contains(normalized, item) {
			return "high"
		}
	}
	for _, item := range mediumSignals {
		if strings.Contains(normalized, item) {
			return "medium"
		}
	}

	if mood <= 2 || stress >= 9 || anxiety >= 9 || sleepHours < 3 {
		return "high"
	}
	if mood <= 4 || stress >= 7 || anxiety >= 7 || sleepHours < 5 {
		return "medium"
	}
	return "low"
}

func assessPHQ9(answers []int) (phq9Assessment, error) {
	if len(answers) == 0 {
		return phq9Assessment{
			Provided:  false,
			Severity:  "not_assessed",
			RiskLevel: "low",
		}, nil
	}
	if len(answers) != 9 {
		return phq9Assessment{}, fmt.Errorf("phq9_answers must contain 9 values (0-3)")
	}

	score := 0
	for i, value := range answers {
		if value < 0 || value > 3 {
			return phq9Assessment{}, fmt.Errorf("phq9_answers[%d] must be between 0 and 3", i)
		}
		score += value
	}

	severity := "minimal"
	switch {
	case score >= 20:
		severity = "severe"
	case score >= 15:
		severity = "moderately_severe"
	case score >= 10:
		severity = "moderate"
	case score >= 5:
		severity = "mild"
	}

	item9 := answers[8]
	risk := "low"
	if score >= 20 || item9 >= 2 {
		risk = "high"
	} else if score >= 10 || item9 == 1 {
		risk = "medium"
	}

	return phq9Assessment{
		Provided:  true,
		Score:     score,
		Severity:  severity,
		RiskLevel: risk,
		Item9:     item9,
	}, nil
}

func maxRiskLevel(a, b string) string {
	if riskRank(b) > riskRank(a) {
		return b
	}
	return a
}

func riskRank(level string) int {
	switch strings.ToLower(strings.TrimSpace(level)) {
	case "high":
		return 3
	case "medium":
		return 2
	default:
		return 1
	}
}

func buildCareRecommendation(risk string, phq phq9Assessment, chwLinked bool, language string) careRecommendation {
	switch risk {
	case "high":
		actions := []string{
			"Schedule CHW meeting in the next 24 hours",
			"Book therapist session this week",
			"Use crisis contacts immediately if danger is present",
		}
		if !chwLinked {
			actions = append([]string{"Link a CHW now"}, actions...)
		}
		if phq.Item9 > 0 {
			actions = append(actions, "Do not stay alone while self-harm thoughts are present")
		}
		return careRecommendation{
			Type:    "schedule_chw_meeting",
			Message: "High-risk symptoms detected. Prioritize immediate CHW follow-up and escalate to crisis support if needed.",
			Actions: actions,
		}
	case "medium":
		actions := []string{
			"Follow a daily routine for sleep, hydration, and movement",
			"Use grounding exercises and journaling each day",
			"Schedule a support follow-up this week",
		}
		if chwLinked {
			actions = append(actions, "Share this update with your CHW")
		} else {
			actions = append(actions, "Link a CHW for structured follow-up")
		}
		return careRecommendation{
			Type:    "advice",
			Message: "Moderate symptoms detected. Structured self-care and a near-term follow-up are recommended.",
			Actions: actions,
		}
	default:
		return careRecommendation{
			Type:    "motivation",
			Message: pickMotivation(normalizeLanguage(language)),
			Actions: []string{
				"Keep daily check-ins active",
				"Continue one small self-care action today",
				"Reach out early if symptoms worsen",
			},
		}
	}
}

func humanizeLabel(value string) string {
	return strings.ReplaceAll(value, "_", " ")
}

func pickMotivation(language string) string {
	messages := map[string][]string{
		"en": {
			"You are not alone. One small step today still counts.",
			"Breathe slowly: in 4, hold 4, out 6. You are doing your best.",
			"Healing is progress, not perfection.",
		},
		"sw": {
			"Hauko peke yako. Hatua ndogo leo ni muhimu.",
			"Vuta pumzi: ndani 4, shikilia 4, toa 6. Utafika.",
			"Kupona ni safari, sio mashindano.",
		},
		"fr": {
			"Vous n'etes pas seul. Chaque petit pas compte.",
			"Respirez lentement: 4, 4, 6. Continuez doucement.",
			"La guerison est un parcours, pas une course.",
		},
		"es": {
			"No estas solo. Un paso pequeno hoy todavia cuenta.",
			"Respira lento: entra 4, sostén 4, suelta 6. Lo estas intentando.",
			"Sanar es progreso, no perfeccion.",
		},
		"ar": {
			"You are not alone. One gentle step today still matters.",
			"Breathe in for 4, hold for 4, out for 6. You are doing enough for this moment.",
			"Healing takes patience, not perfection.",
		},
	}

	lang := normalizeLanguage(language)
	arr := messages[lang]
	if len(arr) == 0 {
		arr = messages["en"]
	}
	index := int(time.Now().Unix()/86400) % len(arr)
	return arr[index]
}

func normalizeRole(role string) string {
	normalized := strings.ToLower(strings.TrimSpace(role))
	normalized = strings.ReplaceAll(normalized, "-", "_")
	normalized = strings.ReplaceAll(normalized, " ", "_")

	switch normalized {
	case "", "user", "patient", "mental_health_user", "mental_user", "mental_health_patient", "mh_user":
		return roleMentalHealthUser
	case "community_health_worker", "community_worker", "chw", "communityhealthworker", "community_healthworker":
		return roleCommunityHealthWorker
	default:
		return roleMentalHealthUser
	}
}

func normalizeAIProvider(provider string) string {
	switch strings.ToLower(strings.TrimSpace(provider)) {
	case "llama", "ollama":
		return "llama"
	case "openai", "chatgpt":
		return "openai"
	default:
		return "fallback"
	}
}

func requireUserRole(user AuthUser, expectedRole string) error {
	actual := normalizeRole(user.Role)
	expected := normalizeRole(expectedRole)
	if actual != expected {
		return fmt.Errorf("access denied: %s role required", humanizeLabel(expected))
	}
	return nil
}

func canonicalName(value string) string {
	return strings.ToLower(strings.Join(strings.Fields(strings.TrimSpace(value)), " "))
}

func nullableInt64(value int64) any {
	if value <= 0 {
		return nil
	}
	return value
}

func normalizeLanguage(language string) string {
	lang := strings.ToLower(strings.TrimSpace(language))
	switch lang {
	case "english", "en-us", "en-gb":
		return "en"
	case "kiswahili", "swahili":
		return "sw"
	case "french", "francais", "français":
		return "fr"
	case "spanish", "espanol", "español":
		return "es"
	case "arabic", "ar":
		return "ar"
	case "sw", "fr", "en", "es":
		return lang
	default:
		return "en"
	}
}

func decodeJSON(r *http.Request, dst any) error {
	defer r.Body.Close()
	dec := json.NewDecoder(io.LimitReader(r.Body, 1<<20))
	dec.DisallowUnknownFields()
	if err := dec.Decode(dst); err != nil {
		return fmt.Errorf("invalid json: %w", err)
	}
	return nil
}

func decodeJSONAllowEmpty(r *http.Request, dst any) error {
	defer r.Body.Close()
	body, err := io.ReadAll(io.LimitReader(r.Body, 1<<20))
	if err != nil {
		return err
	}
	if len(strings.TrimSpace(string(body))) == 0 {
		return nil
	}
	if err := json.Unmarshal(body, dst); err != nil {
		return fmt.Errorf("invalid json: %w", err)
	}
	return nil
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}

func envOrDefault(key, fallback string) string {
	if value := strings.TrimSpace(os.Getenv(key)); value != "" {
		return value
	}
	return fallback
}

func withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func generateToken(byteLength int) (string, error) {
	buf := make([]byte, byteLength)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return hex.EncodeToString(buf), nil
}

func stringFromMap(m map[string]any, key string) string {
	if value, ok := m[key]; ok {
		switch typed := value.(type) {
		case string:
			return strings.TrimSpace(typed)
		case float64:
			return strconv.FormatFloat(typed, 'f', -1, 64)
		case int:
			return strconv.Itoa(typed)
		}
	}
	return ""
}

func stringFromNestedMap(m map[string]any, firstKey, secondKey string) string {
	if value, ok := m[firstKey]; ok {
		if nested, ok := value.(map[string]any); ok {
			return stringFromMap(nested, secondKey)
		}
	}
	return ""
}

func firstNonEmpty(values ...string) string {
	for _, item := range values {
		trimmed := strings.TrimSpace(item)
		if trimmed != "" {
			return trimmed
		}
	}
	return ""
}
