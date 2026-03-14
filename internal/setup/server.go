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
	"time"

	"github.com/fastclaw-ai/fastclaw/internal/config"
)

// Server serves the setup wizard UI and handles config API endpoints.
type Server struct {
	port     int
	onConfig func(*config.Config) // called after config is saved
}

// NewServer creates a setup wizard server on the given port.
func NewServer(port int, onConfig func(*config.Config)) *Server {
	return &Server{port: port, onConfig: onConfig}
}

// Run starts the HTTP server and blocks until the context is canceled
// or the setup is completed.
func (s *Server) Run(ctx context.Context) error {
	mux := http.NewServeMux()

	// API routes
	mux.HandleFunc("GET /api/status", s.handleStatus)
	mux.HandleFunc("POST /api/test-provider", s.handleTestProvider)
	mux.HandleFunc("POST /api/save-config", s.handleSaveConfig)

	// Static files from embedded web/out
	webRoot, err := fs.Sub(webFS, "web")
	if err != nil {
		return fmt.Errorf("setup: embed sub: %w", err)
	}
	fileServer := http.FileServer(http.FS(webRoot))
	mux.Handle("/", fileServer)

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

	slog.Info("setup wizard running", "url", fmt.Sprintf("http://localhost:%d", s.port))
	if err := srv.Serve(ln); err != nil && err != http.ErrServerClosed {
		return err
	}
	return nil
}

func (s *Server) handleStatus(w http.ResponseWriter, r *http.Request) {
	homeDir, err := config.HomeDir()
	if err != nil {
		jsonResponse(w, http.StatusOK, map[string]any{"configured": false, "running": false})
		return
	}
	configPath := filepath.Join(homeDir, "fastclaw.json")
	_, err = os.Stat(configPath)
	jsonResponse(w, http.StatusOK, map[string]any{
		"configured": err == nil,
		"running":    false,
	})
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
