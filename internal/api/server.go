package api

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/fastclaw-ai/fastclaw/internal/agent"
	"github.com/fastclaw-ai/fastclaw/internal/config"
)

// Server handles the OpenAI-compatible API and WebSocket gateway.
type Server struct {
	agentMgr *agent.Manager
	token    string
}

// NewServer creates a new API server.
func NewServer(agentMgr *agent.Manager, token string) *Server {
	return &Server{
		agentMgr: agentMgr,
		token:    token,
	}
}

// RegisterRoutes registers API routes on the given mux.
func (s *Server) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("POST /v1/chat/completions", s.authMiddleware(s.HandleChatCompletions))
	mux.HandleFunc("GET /v1/agents", s.authMiddleware(s.HandleListAgents))
	mux.HandleFunc("/ws", s.HandleWebSocket)
}

// HandleListAgents handles GET /v1/agents.
func (s *Server) HandleListAgents(w http.ResponseWriter, r *http.Request) {
	agents := s.buildAgentList()
	writeJSON(w, http.StatusOK, map[string]any{"agents": agents})
}

func (s *Server) buildAgentList() []map[string]string {
	all := s.agentMgr.All()

	// Also load config for model info
	cfg, _ := config.Load()
	modelMap := make(map[string]string)
	if cfg != nil {
		for _, ra := range config.ResolveAgents(cfg) {
			modelMap[ra.ID] = ra.Model
		}
	}

	agents := make([]map[string]string, 0, len(all))
	for _, ag := range all {
		model := ag.Model()
		if model == "" {
			model = modelMap[ag.Name()]
		}
		agents = append(agents, map[string]string{
			"id":    ag.Name(),
			"name":  ag.Name(),
			"model": model,
		})
	}
	return agents
}

// authMiddleware validates the Bearer token for API routes.
func (s *Server) authMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if s.token == "" {
			// No token configured, skip auth
			next(w, r)
			return
		}

		auth := r.Header.Get("Authorization")
		if auth == "" {
			writeJSON(w, http.StatusUnauthorized, map[string]any{
				"error": map[string]string{"message": "missing Authorization header", "type": "authentication_error"},
			})
			return
		}

		token := strings.TrimPrefix(auth, "Bearer ")
		if token == auth || token != s.token {
			writeJSON(w, http.StatusUnauthorized, map[string]any{
				"error": map[string]string{"message": "invalid token", "type": "authentication_error"},
			})
			return
		}

		// Add CORS headers
		w.Header().Set("Access-Control-Allow-Origin", "*")
		next(w, r)
	}
}

func writeJSON(w http.ResponseWriter, status int, data any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}
