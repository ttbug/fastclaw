package setup

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"io/fs"
	"log/slog"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/fastclaw-ai/fastclaw/internal/config"
)

// AgentHandle is a minimal interface for interacting with an agent from the web UI.
type AgentHandle interface {
	Name() string
	HandleWebChat(ctx context.Context, text string) string
}

// AgentProvider gives the server access to the running agents.
type AgentProvider interface {
	AllAgents() []AgentHandle
	AgentByID(id string) AgentHandle
}

// Server serves the setup wizard UI and handles config API endpoints.
type Server struct {
	port          int
	onConfig      func(*config.Config) // called after config is saved
	agentProvider AgentProvider
	startedAt     time.Time
}

// NewServer creates a setup wizard server on the given port.
func NewServer(port int, onConfig func(*config.Config)) *Server {
	return &Server{port: port, onConfig: onConfig, startedAt: time.Now()}
}

// SetAgentProvider sets the agent provider for chat and status endpoints.
func (s *Server) SetAgentProvider(ap AgentProvider) {
	s.agentProvider = ap
}

// Run starts the HTTP server and blocks until the context is canceled
// or the setup is completed.
func (s *Server) Run(ctx context.Context) error {
	mux := http.NewServeMux()

	// API routes
	mux.HandleFunc("GET /api/status", s.handleStatus)
	mux.HandleFunc("GET /api/config", s.handleGetConfig)
	mux.HandleFunc("POST /api/config", s.handleUpdateConfig)
	mux.HandleFunc("POST /api/test-provider", s.handleTestProvider)
	mux.HandleFunc("POST /api/save-config", s.handleSaveConfig)
	mux.HandleFunc("POST /api/chat", s.handleChat)

	// Agent management
	mux.HandleFunc("GET /api/agents", s.handleListAgents)
	mux.HandleFunc("POST /api/agents", s.handleCreateAgent)
	mux.HandleFunc("PUT /api/agents/{id}", s.handleUpdateAgent)
	mux.HandleFunc("DELETE /api/agents/{id}", s.handleDeleteAgent)

	// Skills
	mux.HandleFunc("GET /api/skills", s.handleListSkills)
	mux.HandleFunc("DELETE /api/skills/{name}", s.handleDeleteSkill)

	// Plugins
	mux.HandleFunc("GET /api/plugins", s.handleListPlugins)
	mux.HandleFunc("PUT /api/plugins/{id}", s.handleUpdatePlugin)

	// Channels
	mux.HandleFunc("GET /api/channels", s.handleListChannels)

	// Cron jobs
	mux.HandleFunc("GET /api/cron", s.handleListCronJobs)
	mux.HandleFunc("POST /api/cron", s.handleCreateCronJob)
	mux.HandleFunc("PUT /api/cron/{id}", s.handleUpdateCronJob)
	mux.HandleFunc("DELETE /api/cron/{id}", s.handleDeleteCronJob)

	// Static files from embedded web/out
	webRoot, err := fs.Sub(webFS, "web")
	if err != nil {
		return fmt.Errorf("setup: embed sub: %w", err)
	}

	// Serve static files with SPA fallback
	mux.Handle("/", spaHandler{fs: webRoot})

	addr := fmt.Sprintf(":%d", s.port)
	srv := &http.Server{
		Addr:    addr,
		Handler: mux,
	}

	// Graceful shutdown on context cancel
	go func() {
		<-ctx.Done()
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		srv.Shutdown(shutdownCtx)
	}()

	ln, err := net.Listen("tcp", addr)
	if err != nil {
		return fmt.Errorf("setup: listen %s: %w", addr, err)
	}

	slog.Info("web UI running", "url", fmt.Sprintf("http://localhost:%d", s.port))
	if err := srv.Serve(ln); err != nil && err != http.ErrServerClosed {
		return err
	}
	return nil
}

// spaHandler serves static files, falling back to the directory's index.html
// for paths that don't match a file (to support client-side routing).
type spaHandler struct {
	fs fs.FS
}

func (h spaHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	path := r.URL.Path

	// Strip trailing slash (except root) to normalize
	if path != "/" && strings.HasSuffix(path, "/") {
		path = strings.TrimSuffix(path, "/")
	}

	// fs.FS paths don't have leading slash
	fsPath := strings.TrimPrefix(path, "/")
	if fsPath == "" {
		fsPath = "."
	}

	// Try to open the file directly (static assets like .js, .css, .ico)
	f, err := h.fs.Open(fsPath)
	if err == nil {
		stat, statErr := f.Stat()
		f.Close()
		if statErr == nil && !stat.IsDir() {
			http.ServeFileFS(w, r, h.fs, fsPath)
			return
		}
	}

	// For route paths (/onboard, /overview, /chat), look for index.html in that dir
	var indexPath string
	if fsPath == "." {
		indexPath = "index.html"
	} else {
		indexPath = fsPath + "/index.html"
	}
	f, err = h.fs.Open(indexPath)
	if err == nil {
		f.Close()
		http.ServeFileFS(w, r, h.fs, indexPath)
		return
	}

	// Try path.html
	htmlPath := fsPath + ".html"
	f, err = h.fs.Open(htmlPath)
	if err == nil {
		f.Close()
		http.ServeFileFS(w, r, h.fs, htmlPath)
		return
	}

	// Fall back to index.html for client-side routing
	http.ServeFileFS(w, r, h.fs, "index.html")
}

func (s *Server) handleStatus(w http.ResponseWriter, r *http.Request) {
	homeDir, err := config.HomeDir()
	if err != nil {
		jsonResponse(w, http.StatusOK, map[string]any{
			"configured": false,
			"running":    false,
		})
		return
	}
	configPath := filepath.Join(homeDir, "fastclaw.json")
	_, statErr := os.Stat(configPath)
	configured := statErr == nil

	resp := map[string]any{
		"configured": configured,
		"running":    s.agentProvider != nil,
		"port":       s.port,
		"agents":     []any{},
		"channels":   []any{},
		"provider":   nil,
		"uptime":     "",
	}

	if s.agentProvider != nil {
		resp["uptime"] = formatDuration(time.Since(s.startedAt))
		var agentList []map[string]string
		for _, ag := range s.agentProvider.AllAgents() {
			agentList = append(agentList, map[string]string{
				"id": ag.Name(),
			})
		}
		resp["agents"] = agentList
	}

	// Load config for provider/channel/agent details
	if configured {
		cfg, loadErr := config.Load()
		if loadErr == nil {
			// Provider info
			for name, prov := range cfg.Providers {
				maskedKey := maskAPIKey(prov.APIKey)
				resp["provider"] = map[string]string{
					"name":   name,
					"model":  cfg.Agents.Defaults.Model,
					"apiBase": prov.APIBase,
					"apiKey": maskedKey,
				}
				break // use first provider
			}

			// Channel info
			var channelList []map[string]string
			for chType, ch := range cfg.Channels {
				if !ch.Enabled {
					continue
				}
				entry := map[string]string{"type": chType}
				channelList = append(channelList, entry)
			}
			if len(channelList) > 0 {
				resp["channels"] = channelList
			}

			// Agent info with model details
			if s.agentProvider == nil {
				// Not running - get agent list from config
				resolved := config.ResolveAgents(cfg)
				var agentList []map[string]string
				for _, ra := range resolved {
					agentList = append(agentList, map[string]string{
						"id":        ra.ID,
						"model":     ra.Model,
						"workspace": ra.Workspace,
					})
				}
				resp["agents"] = agentList
			} else {
				// Running - enrich with model info from config
				resolved := config.ResolveAgents(cfg)
				modelMap := make(map[string]string)
				wsMap := make(map[string]string)
				for _, ra := range resolved {
					modelMap[ra.ID] = ra.Model
					wsMap[ra.ID] = ra.Workspace
				}
				var agentList []map[string]string
				for _, ag := range s.agentProvider.AllAgents() {
					agentList = append(agentList, map[string]string{
						"id":        ag.Name(),
						"model":     modelMap[ag.Name()],
						"workspace": wsMap[ag.Name()],
					})
				}
				resp["agents"] = agentList
			}
		}
	}

	jsonResponse(w, http.StatusOK, resp)
}

func (s *Server) handleGetConfig(w http.ResponseWriter, r *http.Request) {
	cfg, err := config.Load()
	if err != nil {
		jsonResponse(w, http.StatusOK, map[string]any{"error": "no config found"})
		return
	}

	// Mask API keys
	masked := *cfg
	masked.Providers = make(map[string]config.ProviderConfig)
	for k, v := range cfg.Providers {
		v.APIKey = maskAPIKey(v.APIKey)
		masked.Providers[k] = v
	}

	jsonResponse(w, http.StatusOK, masked)
}

type testProviderRequest struct {
	APIBase string `json:"apiBase"`
	APIKey  string `json:"apiKey"`
	Model   string `json:"model"`
}

func (s *Server) handleTestProvider(w http.ResponseWriter, r *http.Request) {
	var req testProviderRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonResponse(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "invalid request"})
		return
	}

	// Make a simple chat completion call to test the provider
	payload := map[string]any{
		"model": req.Model,
		"messages": []map[string]string{
			{"role": "user", "content": "Say hi in one word."},
		},
		"max_tokens": 10,
	}
	body, _ := json.Marshal(payload)

	httpReq, err := http.NewRequestWithContext(r.Context(), "POST", req.APIBase+"/chat/completions", bytes.NewReader(body))
	if err != nil {
		jsonResponse(w, http.StatusOK, map[string]any{"ok": false, "error": err.Error()})
		return
	}
	httpReq.Header.Set("Content-Type", "application/json")
	if req.APIKey != "" {
		httpReq.Header.Set("Authorization", "Bearer "+req.APIKey)
	}

	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(httpReq)
	if err != nil {
		jsonResponse(w, http.StatusOK, map[string]any{"ok": false, "error": err.Error()})
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(io.LimitReader(resp.Body, 1024))
		jsonResponse(w, http.StatusOK, map[string]any{"ok": false, "error": fmt.Sprintf("HTTP %d: %s", resp.StatusCode, string(respBody))})
		return
	}

	jsonResponse(w, http.StatusOK, map[string]any{"ok": true})
}

type chatRequest struct {
	AgentID string `json:"agentId"`
	Message string `json:"message"`
}

func (s *Server) handleChat(w http.ResponseWriter, r *http.Request) {
	if s.agentProvider == nil {
		jsonResponse(w, http.StatusServiceUnavailable, map[string]any{
			"error": "gateway is not running",
		})
		return
	}

	var req chatRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonResponse(w, http.StatusBadRequest, map[string]any{"error": "invalid request"})
		return
	}

	ag := s.agentProvider.AgentByID(req.AgentID)
	if ag == nil {
		jsonResponse(w, http.StatusNotFound, map[string]any{"error": "agent not found"})
		return
	}

	reply := ag.HandleWebChat(r.Context(), req.Message)
	jsonResponse(w, http.StatusOK, map[string]any{"response": reply})
}

type saveConfigRequest struct {
	Provider        string `json:"provider"`
	APIBase         string `json:"apiBase"`
	APIKey          string `json:"apiKey"`
	Model           string `json:"model"`
	TelegramEnabled bool   `json:"telegramEnabled"`
	TelegramToken   string `json:"telegramToken"`
	Port            int    `json:"port"`
	AgentName       string `json:"agentName"`
	Personality     string `json:"personality"`
}

func (s *Server) handleSaveConfig(w http.ResponseWriter, r *http.Request) {
	var req saveConfigRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonResponse(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "invalid request"})
		return
	}

	// Build config
	cfg := &config.Config{
		Providers: map[string]config.ProviderConfig{
			"default": {
				APIKey:  req.APIKey,
				APIBase: req.APIBase,
			},
		},
		Agents: config.AgentsConfig{
			Defaults: config.AgentDefaults{
				Model:             req.Model,
				MaxTokens:         8192,
				Temperature:       0.7,
				MaxToolIterations: 20,
			},
			List: []config.AgentEntry{
				{ID: req.AgentName},
			},
		},
		Channels: map[string]config.ChannelConfig{},
		Bindings: []config.Binding{
			{
				AgentID: req.AgentName,
				Match:   config.Match{Channel: "telegram"},
			},
		},
	}

	if req.TelegramEnabled && req.TelegramToken != "" {
		cfg.Channels["telegram"] = config.ChannelConfig{
			Enabled:  true,
			BotToken: req.TelegramToken,
		}
	}

	// Ensure home dir exists
	homeDir, err := config.HomeDir()
	if err != nil {
		jsonResponse(w, http.StatusInternalServerError, map[string]any{"ok": false, "error": err.Error()})
		return
	}
	if err := os.MkdirAll(homeDir, 0o755); err != nil {
		jsonResponse(w, http.StatusInternalServerError, map[string]any{"ok": false, "error": err.Error()})
		return
	}

	// Write config
	configPath := filepath.Join(homeDir, "fastclaw.json")
	data, _ := json.MarshalIndent(cfg, "", "  ")
	if err := os.WriteFile(configPath, data, 0o644); err != nil {
		jsonResponse(w, http.StatusInternalServerError, map[string]any{"ok": false, "error": err.Error()})
		return
	}

	// Create agent workspace
	agentDir := filepath.Join(homeDir, "agents", req.AgentName, "agent")
	dirs := []string{
		agentDir,
		filepath.Join(agentDir, "memory"),
		filepath.Join(agentDir, "sessions"),
		filepath.Join(agentDir, "skills"),
	}
	for _, dir := range dirs {
		os.MkdirAll(dir, 0o755)
	}

	// Write bootstrap files
	bootstrapFiles := map[string]string{
		"AGENTS.md":    "# Agent Capabilities\n\nDescribe what this agent can do.\n",
		"IDENTITY.md":  fmt.Sprintf("# Identity\n\nYou are %s, a FastClaw AI agent.\n", req.AgentName),
		"USER.md":      "# User\n\nInformation about the user you serve.\n",
		"TOOLS.md":     "# Tools\n\nAdditional tool usage instructions.\n",
		"BOOTSTRAP.md": "# Bootstrap\n\nStartup instructions loaded on every conversation.\n",
		"HEARTBEAT.md": "# Heartbeat\n\nPeriodic check-in instructions.\n",
		"MEMORY.md":    "# Memory\n\nLong-term memory for this agent.\n",
	}
	if req.Personality != "" {
		bootstrapFiles["SOUL.md"] = fmt.Sprintf("# Soul\n\n%s\n", req.Personality)
	} else {
		bootstrapFiles["SOUL.md"] = "# Soul\n\nYour personality and behavioral guidelines.\n"
	}

	for filename, content := range bootstrapFiles {
		path := filepath.Join(agentDir, filename)
		if _, err := os.Stat(path); os.IsNotExist(err) {
			os.WriteFile(path, []byte(content), 0o644)
		}
	}

	// Write agent.json
	agentCfg := config.AgentFileConfig{Model: req.Model}
	agentData, _ := json.MarshalIndent(agentCfg, "", "  ")
	agentJSONPath := filepath.Join(agentDir, "agent.json")
	if _, err := os.Stat(agentJSONPath); os.IsNotExist(err) {
		os.WriteFile(agentJSONPath, agentData, 0o644)
	}

	slog.Info("config saved", "path", configPath, "agent", req.AgentName)

	jsonResponse(w, http.StatusOK, map[string]any{"ok": true})

	// Signal that config is ready
	if s.onConfig != nil {
		go s.onConfig(cfg)
	}
}

func jsonResponse(w http.ResponseWriter, status int, data any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func maskAPIKey(key string) string {
	if len(key) <= 8 {
		return "****"
	}
	return key[:4] + "****" + key[len(key)-4:]
}

func formatDuration(d time.Duration) string {
	if d < time.Minute {
		return fmt.Sprintf("%ds", int(d.Seconds()))
	}
	if d < time.Hour {
		return fmt.Sprintf("%dm", int(d.Minutes()))
	}
	hours := int(d.Hours())
	mins := int(d.Minutes()) % 60
	if hours < 24 {
		return fmt.Sprintf("%dh %dm", hours, mins)
	}
	days := hours / 24
	hours = hours % 24
	return fmt.Sprintf("%dd %dh", days, hours)
}

// --- Agent Management ---

func (s *Server) handleListAgents(w http.ResponseWriter, r *http.Request) {
	cfg, err := config.Load()
	if err != nil {
		jsonResponse(w, http.StatusOK, []any{})
		return
	}
	resolved := config.ResolveAgents(cfg)
	var agents []map[string]any
	for _, ra := range resolved {
		soul := ""
		soulPath := filepath.Join(ra.Workspace, "SOUL.md")
		if data, readErr := os.ReadFile(soulPath); readErr == nil {
			soul = string(data)
		}
		agents = append(agents, map[string]any{
			"id":                ra.ID,
			"model":             ra.Model,
			"workspace":         ra.Workspace,
			"maxTokens":         ra.MaxTokens,
			"temperature":       ra.Temperature,
			"maxToolIterations": ra.MaxToolIterations,
			"thinking":          ra.Thinking,
			"soul":              soul,
		})
	}
	if agents == nil {
		agents = []map[string]any{}
	}
	jsonResponse(w, http.StatusOK, agents)
}

func (s *Server) handleCreateAgent(w http.ResponseWriter, r *http.Request) {
	var req struct {
		ID    string `json:"id"`
		Model string `json:"model"`
		Soul  string `json:"soul"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonResponse(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "invalid request"})
		return
	}
	if req.ID == "" {
		jsonResponse(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "id is required"})
		return
	}

	cfg, err := config.Load()
	if err != nil {
		jsonResponse(w, http.StatusInternalServerError, map[string]any{"ok": false, "error": err.Error()})
		return
	}

	// Add agent to config
	cfg.Agents.List = append(cfg.Agents.List, config.AgentEntry{
		ID:    req.ID,
		Model: req.Model,
	})

	if err := saveConfigFile(cfg); err != nil {
		jsonResponse(w, http.StatusInternalServerError, map[string]any{"ok": false, "error": err.Error()})
		return
	}

	// Create workspace
	homeDir, _ := config.HomeDir()
	agentDir := filepath.Join(homeDir, "agents", req.ID, "agent")
	for _, dir := range []string{agentDir, filepath.Join(agentDir, "memory"), filepath.Join(agentDir, "sessions"), filepath.Join(agentDir, "skills")} {
		os.MkdirAll(dir, 0o755)
	}
	if req.Soul != "" {
		os.WriteFile(filepath.Join(agentDir, "SOUL.md"), []byte(req.Soul), 0o644)
	}
	agentCfg := config.AgentFileConfig{Model: req.Model}
	agentData, _ := json.MarshalIndent(agentCfg, "", "  ")
	os.WriteFile(filepath.Join(agentDir, "agent.json"), agentData, 0o644)

	jsonResponse(w, http.StatusOK, map[string]any{"ok": true})
}

func (s *Server) handleUpdateAgent(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var req struct {
		Model string `json:"model"`
		Soul  string `json:"soul"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonResponse(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "invalid request"})
		return
	}

	cfg, err := config.Load()
	if err != nil {
		jsonResponse(w, http.StatusInternalServerError, map[string]any{"ok": false, "error": err.Error()})
		return
	}

	found := false
	for i, entry := range cfg.Agents.List {
		if entry.ID == id {
			if req.Model != "" {
				cfg.Agents.List[i].Model = req.Model
			}
			found = true
			break
		}
	}
	if !found {
		jsonResponse(w, http.StatusNotFound, map[string]any{"ok": false, "error": "agent not found"})
		return
	}

	if err := saveConfigFile(cfg); err != nil {
		jsonResponse(w, http.StatusInternalServerError, map[string]any{"ok": false, "error": err.Error()})
		return
	}

	// Update workspace files
	homeDir, _ := config.HomeDir()
	agentDir := filepath.Join(homeDir, "agents", id, "agent")
	if req.Soul != "" {
		os.WriteFile(filepath.Join(agentDir, "SOUL.md"), []byte(req.Soul), 0o644)
	}
	if req.Model != "" {
		agentCfg := config.AgentFileConfig{Model: req.Model}
		agentData, _ := json.MarshalIndent(agentCfg, "", "  ")
		os.WriteFile(filepath.Join(agentDir, "agent.json"), agentData, 0o644)
	}

	jsonResponse(w, http.StatusOK, map[string]any{"ok": true})
}

func (s *Server) handleDeleteAgent(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	cfg, err := config.Load()
	if err != nil {
		jsonResponse(w, http.StatusInternalServerError, map[string]any{"ok": false, "error": err.Error()})
		return
	}

	newList := make([]config.AgentEntry, 0, len(cfg.Agents.List))
	for _, entry := range cfg.Agents.List {
		if entry.ID != id {
			newList = append(newList, entry)
		}
	}
	cfg.Agents.List = newList

	if err := saveConfigFile(cfg); err != nil {
		jsonResponse(w, http.StatusInternalServerError, map[string]any{"ok": false, "error": err.Error()})
		return
	}

	jsonResponse(w, http.StatusOK, map[string]any{"ok": true})
}

// --- Skills ---

func (s *Server) handleListSkills(w http.ResponseWriter, r *http.Request) {
	homeDir, err := config.HomeDir()
	if err != nil {
		jsonResponse(w, http.StatusOK, []any{})
		return
	}

	skillsDir := filepath.Join(homeDir, "skills")
	entries, err := os.ReadDir(skillsDir)
	if err != nil {
		jsonResponse(w, http.StatusOK, []any{})
		return
	}

	var skills []map[string]string
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		name := entry.Name()
		desc := ""
		skillPath := filepath.Join(skillsDir, name, "SKILL.md")
		if data, readErr := os.ReadFile(skillPath); readErr == nil {
			lines := strings.SplitN(string(data), "\n", 3)
			for _, line := range lines {
				line = strings.TrimSpace(line)
				if line != "" && !strings.HasPrefix(line, "#") {
					desc = line
					break
				}
			}
		}
		skills = append(skills, map[string]string{
			"name":        name,
			"description": desc,
			"location":    filepath.Join(skillsDir, name),
			"type":        "skill",
		})
	}
	if skills == nil {
		jsonResponse(w, http.StatusOK, []any{})
		return
	}
	jsonResponse(w, http.StatusOK, skills)
}

func (s *Server) handleDeleteSkill(w http.ResponseWriter, r *http.Request) {
	name := r.PathValue("name")
	homeDir, err := config.HomeDir()
	if err != nil {
		jsonResponse(w, http.StatusInternalServerError, map[string]any{"ok": false, "error": err.Error()})
		return
	}
	skillPath := filepath.Join(homeDir, "skills", name)
	if err := os.RemoveAll(skillPath); err != nil {
		jsonResponse(w, http.StatusInternalServerError, map[string]any{"ok": false, "error": err.Error()})
		return
	}
	jsonResponse(w, http.StatusOK, map[string]any{"ok": true})
}

// --- Plugins ---

func (s *Server) handleListPlugins(w http.ResponseWriter, r *http.Request) {
	homeDir, err := config.HomeDir()
	if err != nil {
		jsonResponse(w, http.StatusOK, []any{})
		return
	}

	cfg, _ := config.Load()
	pluginsDir := filepath.Join(homeDir, "plugins")
	entries, err := os.ReadDir(pluginsDir)
	if err != nil {
		jsonResponse(w, http.StatusOK, []any{})
		return
	}

	var plugins []map[string]any
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		id := entry.Name()

		// Read plugin.json for metadata
		pluginType := "unknown"
		version := ""
		manifestPath := filepath.Join(pluginsDir, id, "plugin.json")
		if data, readErr := os.ReadFile(manifestPath); readErr == nil {
			var manifest map[string]any
			if json.Unmarshal(data, &manifest) == nil {
				if t, ok := manifest["type"].(string); ok {
					pluginType = t
				}
				if v, ok := manifest["version"].(string); ok {
					version = v
				}
			}
		}

		enabled := false
		if cfg != nil && cfg.Plugins.Entries != nil {
			if pe, ok := cfg.Plugins.Entries[id]; ok {
				enabled = pe.Enabled
			}
		}

		status := "stopped"
		if enabled {
			status = "running"
		}

		plugins = append(plugins, map[string]any{
			"id":      id,
			"type":    pluginType,
			"version": version,
			"status":  status,
			"enabled": enabled,
		})
	}
	if plugins == nil {
		jsonResponse(w, http.StatusOK, []any{})
		return
	}
	jsonResponse(w, http.StatusOK, plugins)
}

func (s *Server) handleUpdatePlugin(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var req struct {
		Enabled *bool                  `json:"enabled,omitempty"`
		Config  map[string]interface{} `json:"config,omitempty"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonResponse(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "invalid request"})
		return
	}

	cfg, err := config.Load()
	if err != nil {
		jsonResponse(w, http.StatusInternalServerError, map[string]any{"ok": false, "error": err.Error()})
		return
	}

	if cfg.Plugins.Entries == nil {
		cfg.Plugins.Entries = make(map[string]config.PluginEntryCfg)
	}
	entry := cfg.Plugins.Entries[id]
	if req.Enabled != nil {
		entry.Enabled = *req.Enabled
	}
	if req.Config != nil {
		entry.Config = req.Config
	}
	cfg.Plugins.Entries[id] = entry

	if err := saveConfigFile(cfg); err != nil {
		jsonResponse(w, http.StatusInternalServerError, map[string]any{"ok": false, "error": err.Error()})
		return
	}

	jsonResponse(w, http.StatusOK, map[string]any{"ok": true})
}

// --- Channels ---

func (s *Server) handleListChannels(w http.ResponseWriter, r *http.Request) {
	cfg, err := config.Load()
	if err != nil {
		jsonResponse(w, http.StatusOK, []any{})
		return
	}

	var channels []map[string]any
	for chType, ch := range cfg.Channels {
		status := "disconnected"
		if ch.Enabled {
			status = "connected"
		}
		channels = append(channels, map[string]any{
			"type":    chType,
			"enabled": ch.Enabled,
			"status":  status,
		})
	}
	if channels == nil {
		jsonResponse(w, http.StatusOK, []any{})
		return
	}
	jsonResponse(w, http.StatusOK, channels)
}

// --- Cron Jobs ---

func (s *Server) handleListCronJobs(w http.ResponseWriter, r *http.Request) {
	cfg, err := config.Load()
	if err != nil {
		jsonResponse(w, http.StatusOK, []any{})
		return
	}

	var jobs []map[string]any
	for i, job := range cfg.CronJobs {
		jobs = append(jobs, map[string]any{
			"id":       fmt.Sprintf("%d", i),
			"name":     job.Name,
			"type":     job.Type,
			"schedule": job.Schedule,
			"agentId":  job.AgentID,
			"channel":  job.Channel,
			"chatId":   job.ChatID,
			"message":  job.Message,
			"enabled":  true,
		})
	}
	if jobs == nil {
		jsonResponse(w, http.StatusOK, []any{})
		return
	}
	jsonResponse(w, http.StatusOK, jobs)
}

func (s *Server) handleCreateCronJob(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Name     string `json:"name"`
		Type     string `json:"type"`
		Schedule string `json:"schedule"`
		AgentID  string `json:"agentId"`
		Channel  string `json:"channel"`
		ChatID   string `json:"chatId"`
		Message  string `json:"message"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonResponse(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "invalid request"})
		return
	}

	cfg, err := config.Load()
	if err != nil {
		jsonResponse(w, http.StatusInternalServerError, map[string]any{"ok": false, "error": err.Error()})
		return
	}

	cfg.CronJobs = append(cfg.CronJobs, config.CronJob{
		Name:     req.Name,
		Type:     req.Type,
		Schedule: req.Schedule,
		AgentID:  req.AgentID,
		Channel:  req.Channel,
		ChatID:   req.ChatID,
		Message:  req.Message,
	})

	if err := saveConfigFile(cfg); err != nil {
		jsonResponse(w, http.StatusInternalServerError, map[string]any{"ok": false, "error": err.Error()})
		return
	}

	jsonResponse(w, http.StatusOK, map[string]any{"ok": true})
}

func (s *Server) handleUpdateCronJob(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	var idx int
	if _, err := fmt.Sscanf(idStr, "%d", &idx); err != nil {
		jsonResponse(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "invalid id"})
		return
	}

	var req struct {
		Enabled *bool `json:"enabled,omitempty"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonResponse(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "invalid request"})
		return
	}

	// For now, just acknowledge — cron enable/disable would need scheduler integration
	jsonResponse(w, http.StatusOK, map[string]any{"ok": true})
}

func (s *Server) handleDeleteCronJob(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	var idx int
	if _, err := fmt.Sscanf(idStr, "%d", &idx); err != nil {
		jsonResponse(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "invalid id"})
		return
	}

	cfg, err := config.Load()
	if err != nil {
		jsonResponse(w, http.StatusInternalServerError, map[string]any{"ok": false, "error": err.Error()})
		return
	}

	if idx < 0 || idx >= len(cfg.CronJobs) {
		jsonResponse(w, http.StatusNotFound, map[string]any{"ok": false, "error": "job not found"})
		return
	}

	cfg.CronJobs = append(cfg.CronJobs[:idx], cfg.CronJobs[idx+1:]...)

	if err := saveConfigFile(cfg); err != nil {
		jsonResponse(w, http.StatusInternalServerError, map[string]any{"ok": false, "error": err.Error()})
		return
	}

	jsonResponse(w, http.StatusOK, map[string]any{"ok": true})
}

// --- Config Update ---

func (s *Server) handleUpdateConfig(w http.ResponseWriter, r *http.Request) {
	var incoming map[string]json.RawMessage
	if err := json.NewDecoder(r.Body).Decode(&incoming); err != nil {
		jsonResponse(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "invalid request"})
		return
	}

	cfg, err := config.Load()
	if err != nil {
		jsonResponse(w, http.StatusInternalServerError, map[string]any{"ok": false, "error": err.Error()})
		return
	}

	// Merge providers
	if raw, ok := incoming["providers"]; ok {
		var providers map[string]config.ProviderConfig
		if json.Unmarshal(raw, &providers) == nil {
			for k, v := range providers {
				if cfg.Providers == nil {
					cfg.Providers = make(map[string]config.ProviderConfig)
				}
				existing := cfg.Providers[k]
				if v.APIBase != "" {
					existing.APIBase = v.APIBase
				}
				if v.APIKey != "" && !strings.Contains(v.APIKey, "****") {
					existing.APIKey = v.APIKey
				}
				cfg.Providers[k] = existing
			}
		}
	}

	// Merge agents defaults
	if raw, ok := incoming["agents"]; ok {
		var agentUpdate struct {
			Defaults struct {
				Model string `json:"model"`
			} `json:"defaults"`
		}
		if json.Unmarshal(raw, &agentUpdate) == nil {
			if agentUpdate.Defaults.Model != "" {
				cfg.Agents.Defaults.Model = agentUpdate.Defaults.Model
			}
		}
	}

	// Merge storage
	if raw, ok := incoming["storage"]; ok {
		var storage config.StorageCfg
		if json.Unmarshal(raw, &storage) == nil {
			cfg.Storage = storage
		}
	}

	// Merge hooks
	if raw, ok := incoming["hooks"]; ok {
		var hooks config.HooksCfg
		if json.Unmarshal(raw, &hooks) == nil {
			cfg.Hooks = hooks
		}
	}

	if err := saveConfigFile(cfg); err != nil {
		jsonResponse(w, http.StatusInternalServerError, map[string]any{"ok": false, "error": err.Error()})
		return
	}

	jsonResponse(w, http.StatusOK, map[string]any{"ok": true})
}

// saveConfigFile persists the config to ~/.fastclaw/fastclaw.json.
func saveConfigFile(cfg *config.Config) error {
	homeDir, err := config.HomeDir()
	if err != nil {
		return err
	}
	configPath := filepath.Join(homeDir, "fastclaw.json")
	data, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(configPath, data, 0o644)
}
