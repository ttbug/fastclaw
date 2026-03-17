// Package store provides a pluggable storage backend for FastClaw.
// Default: file-based (single-user). For cloud multi-tenant: database-backed.
package store

import (
	"context"
	"time"
)

// Store is the unified interface for all persistent data.
// File-based impl reads/writes to ~/.fastclaw; DB impl uses SQL tables with tenant isolation.
type Store interface {
	// Config
	GetConfig(ctx context.Context, tenantID string) (*TenantConfig, error)
	SaveConfig(ctx context.Context, tenantID string, cfg *TenantConfig) error
	DeleteConfig(ctx context.Context, tenantID string) error

	// Agents
	ListAgents(ctx context.Context, tenantID string) ([]AgentRecord, error)
	GetAgent(ctx context.Context, tenantID, agentID string) (*AgentRecord, error)
	SaveAgent(ctx context.Context, tenantID string, agent *AgentRecord) error
	DeleteAgent(ctx context.Context, tenantID, agentID string) error

	// Sessions
	GetSession(ctx context.Context, tenantID, agentID, sessionKey string) (*SessionRecord, error)
	SaveSession(ctx context.Context, tenantID, agentID, sessionKey string, session *SessionRecord) error
	ListSessions(ctx context.Context, tenantID, agentID string) ([]SessionMeta, error)
	DeleteSession(ctx context.Context, tenantID, agentID, sessionKey string) error

	// Memory
	GetMemory(ctx context.Context, tenantID, agentID string) (string, error) // MEMORY.md content
	SaveMemory(ctx context.Context, tenantID, agentID, content string) error
	SearchMemory(ctx context.Context, tenantID, agentID, query string, limit int) ([]MemoryEntry, error)
	AppendMemoryLog(ctx context.Context, tenantID, agentID string, entry MemoryEntry) error

	// Workspace files (SOUL.md, AGENTS.md, etc.)
	GetWorkspaceFile(ctx context.Context, tenantID, agentID, filename string) ([]byte, error)
	SaveWorkspaceFile(ctx context.Context, tenantID, agentID, filename string, data []byte) error
	ListWorkspaceFiles(ctx context.Context, tenantID, agentID string) ([]string, error)

	// Close releases resources.
	Close() error
}

// TenantConfig holds the full config for a tenant (maps to fastclaw.json for file store).
type TenantConfig struct {
	TenantID  string                 `json:"tenantId"`
	Data      map[string]interface{} `json:"data"` // raw config JSON
	CreatedAt time.Time              `json:"createdAt"`
	UpdatedAt time.Time              `json:"updatedAt"`
}

// AgentRecord is the persisted state for one agent.
type AgentRecord struct {
	ID          string            `json:"id"`
	Name        string            `json:"name"`
	Model       string            `json:"model"`
	Config      map[string]interface{} `json:"config"` // agent.json content
	Workspace   map[string]string `json:"workspace"` // filename -> content (SOUL.md, etc.)
	CreatedAt   time.Time         `json:"createdAt"`
	UpdatedAt   time.Time         `json:"updatedAt"`
}

// SessionRecord holds a conversation session.
type SessionRecord struct {
	Messages  []SessionMessage `json:"messages"`
	UpdatedAt time.Time        `json:"updatedAt"`
}

// SessionMessage is a single message in a session.
type SessionMessage struct {
	Role       string      `json:"role"`
	Content    string      `json:"content"`
	ToolCalls  interface{} `json:"toolCalls,omitempty"`
	ToolCallID string      `json:"toolCallId,omitempty"`
	Timestamp  time.Time   `json:"timestamp"`
}

// SessionMeta is summary info for a session (for listing).
type SessionMeta struct {
	Key          string    `json:"key"`
	MessageCount int       `json:"messageCount"`
	UpdatedAt    time.Time `json:"updatedAt"`
}

// MemoryEntry is one searchable memory log entry.
type MemoryEntry struct {
	Timestamp time.Time `json:"timestamp"`
	Role      string    `json:"role"`
	Content   string    `json:"content"`
	SessionID string    `json:"sessionId,omitempty"`
}

// StorageType identifies the storage backend.
type StorageType string

const (
	StorageFile     StorageType = "file"
	StoragePostgres StorageType = "postgres"
	StorageSQLite   StorageType = "sqlite"
)

// StorageConfig is the config block for choosing and configuring the store.
type StorageConfig struct {
	Type     StorageType `json:"type"`               // "file" (default), "postgres", "sqlite"
	DSN      string      `json:"dsn,omitempty"`       // database connection string
	AutoMigrate bool    `json:"autoMigrate,omitempty"` // auto-create tables on startup
}

// DefaultTenantID is used for single-user file-based mode.
const DefaultTenantID = "default"
