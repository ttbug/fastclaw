package webhook

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"strings"

	"github.com/fastclaw-ai/fastclaw/internal/bus"
)

// AgentHandler processes messages and returns responses.
type AgentHandler interface {
	HandleMessage(ctx context.Context, agentID string, msg bus.InboundMessage) (string, error)
}

// WebhookRequest is the body of a webhook POST request.
type WebhookRequest struct {
	AgentID string `json:"agentId"`
	Message string `json:"message"`
	Channel string `json:"channel"`
	ChatID  string `json:"chatId"`
}

// WebhookResponse is the JSON response returned to webhook callers.
type WebhookResponse struct {
	OK      bool   `json:"ok"`
	Reply   string `json:"reply,omitempty"`
	Error   string `json:"error,omitempty"`
}

// Server is the webhook HTTP server.
type Server struct {
	token   string
	path    string
	handler AgentHandler
}

// NewServer creates a new webhook server.
func NewServer(token, path string, handler AgentHandler) *Server {
	if path == "" {
		path = "/hooks"
	}
	return &Server{
		token:   token,
		path:    path,
		handler: handler,
	}
}

// Handler returns an http.Handler for the webhook endpoint.
func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc(s.path, s.handleWebhook)
	return mux
}

func (s *Server) handleWebhook(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, WebhookResponse{Error: "method not allowed"})
		return
	}

	// Validate bearer token
	auth := r.Header.Get("Authorization")
	if s.token != "" {
		expected := "Bearer " + s.token
		if !strings.EqualFold(auth, expected) {
			writeJSON(w, http.StatusUnauthorized, WebhookResponse{Error: "unauthorized"})
			return
		}
	}

	var req WebhookRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, WebhookResponse{Error: "invalid request body"})
		return
	}

	if req.AgentID == "" {
		writeJSON(w, http.StatusBadRequest, WebhookResponse{Error: "agentId is required"})
		return
	}
	if req.Message == "" {
		writeJSON(w, http.StatusBadRequest, WebhookResponse{Error: "message is required"})
		return
	}

	channel := req.Channel
	if channel == "" {
		channel = "webhook"
	}
	chatID := req.ChatID
	if chatID == "" {
		chatID = "webhook-default"
	}

	msg := bus.InboundMessage{
		Channel:  channel,
		ChatID:   chatID,
		UserID:   "webhook",
		Text:     req.Message,
		PeerKind: "dm",
	}

	slog.Info("webhook received",
		"agent", req.AgentID,
		"channel", channel,
		"chat_id", chatID,
	)

	reply, err := s.handler.HandleMessage(r.Context(), req.AgentID, msg)
	if err != nil {
		slog.Error("webhook handler error", "agent", req.AgentID, "error", err)
		writeJSON(w, http.StatusInternalServerError, WebhookResponse{Error: err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, WebhookResponse{OK: true, Reply: reply})
}

func writeJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

// ListenAndServe starts the webhook server on the given address.
func (s *Server) ListenAndServe(ctx context.Context, addr string) error {
	srv := &http.Server{
		Addr:    addr,
		Handler: s.Handler(),
	}

	go func() {
		<-ctx.Done()
		srv.Close()
	}()

	slog.Info("webhook server started", "addr", addr, "path", s.path)
	err := srv.ListenAndServe()
	if err == http.ErrServerClosed {
		return nil
	}
	return fmt.Errorf("webhook server: %w", err)
}
