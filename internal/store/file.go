package store

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// FileStore implements Store using the local filesystem (~/.fastclaw/).
// This is the default for single-user self-hosted mode.
type FileStore struct {
	homeDir string
}

// NewFileStore creates a file-based store rooted at the given directory.
func NewFileStore(homeDir string) *FileStore {
	return &FileStore{homeDir: homeDir}
}

func (f *FileStore) Close() error { return nil }

// --- Config ---

func (f *FileStore) GetConfig(ctx context.Context, tenantID string) (*TenantConfig, error) {
	path := filepath.Join(f.homeDir, "fastclaw.json")
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read config: %w", err)
	}
	var raw map[string]interface{}
	if err := json.Unmarshal(data, &raw); err != nil {
		return nil, fmt.Errorf("parse config: %w", err)
	}
	info, _ := os.Stat(path)
	return &TenantConfig{
		TenantID:  tenantID,
		Data:      raw,
		UpdatedAt: info.ModTime(),
	}, nil
}

func (f *FileStore) SaveConfig(ctx context.Context, tenantID string, cfg *TenantConfig) error {
	path := filepath.Join(f.homeDir, "fastclaw.json")
	data, err := json.MarshalIndent(cfg.Data, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0o644)
}

func (f *FileStore) DeleteConfig(ctx context.Context, tenantID string) error {
	return os.Remove(filepath.Join(f.homeDir, "fastclaw.json"))
}

// --- Agents ---

func (f *FileStore) ListAgents(ctx context.Context, tenantID string) ([]AgentRecord, error) {
	agentsDir := filepath.Join(f.homeDir, "agents")
	entries, err := os.ReadDir(agentsDir)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, err
	}

	var agents []AgentRecord
	for _, e := range entries {
		if !e.IsDir() {
			continue
		}
		ag, err := f.GetAgent(ctx, tenantID, e.Name())
		if err != nil {
			continue
		}
		agents = append(agents, *ag)
	}
	return agents, nil
}

func (f *FileStore) GetAgent(ctx context.Context, tenantID, agentID string) (*AgentRecord, error) {
	wsDir := filepath.Join(f.homeDir, "agents", agentID, "agent")
	if _, err := os.Stat(wsDir); err != nil {
		return nil, fmt.Errorf("agent not found: %s", agentID)
	}

	rec := &AgentRecord{
		ID:        agentID,
		Name:      agentID,
		Workspace: make(map[string]string),
	}

	// Read agent.json
	if data, err := os.ReadFile(filepath.Join(wsDir, "agent.json")); err == nil {
		var cfg map[string]interface{}
		json.Unmarshal(data, &cfg)
		rec.Config = cfg
		if m, ok := cfg["model"].(string); ok {
			rec.Model = m
		}
	}

	// Read workspace files
	for _, name := range []string{"SOUL.md", "IDENTITY.md", "AGENTS.md", "TOOLS.md",
		"USER.md", "BOOTSTRAP.md", "HEARTBEAT.md", "MEMORY.md"} {
		if data, err := os.ReadFile(filepath.Join(wsDir, name)); err == nil {
			rec.Workspace[name] = string(data)
		}
	}

	return rec, nil
}

func (f *FileStore) SaveAgent(ctx context.Context, tenantID string, agent *AgentRecord) error {
	wsDir := filepath.Join(f.homeDir, "agents", agent.ID, "agent")
	os.MkdirAll(wsDir, 0o755)

	// Write agent.json
	if agent.Config != nil {
		data, _ := json.MarshalIndent(agent.Config, "", "  ")
		os.WriteFile(filepath.Join(wsDir, "agent.json"), data, 0o644)
	}

	// Write workspace files
	for name, content := range agent.Workspace {
		os.WriteFile(filepath.Join(wsDir, name), []byte(content), 0o644)
	}

	return nil
}

func (f *FileStore) DeleteAgent(ctx context.Context, tenantID, agentID string) error {
	return os.RemoveAll(filepath.Join(f.homeDir, "agents", agentID))
}

// --- Sessions ---

func (f *FileStore) GetSession(ctx context.Context, tenantID, agentID, sessionKey string) (*SessionRecord, error) {
	path := f.sessionPath(agentID, sessionKey)
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}

	var msgs []SessionMessage
	for _, line := range strings.Split(strings.TrimSpace(string(data)), "\n") {
		if line == "" {
			continue
		}
		var msg SessionMessage
		if json.Unmarshal([]byte(line), &msg) == nil {
			msgs = append(msgs, msg)
		}
	}

	info, _ := os.Stat(path)
	return &SessionRecord{
		Messages:  msgs,
		UpdatedAt: info.ModTime(),
	}, nil
}

func (f *FileStore) SaveSession(ctx context.Context, tenantID, agentID, sessionKey string, session *SessionRecord) error {
	path := f.sessionPath(agentID, sessionKey)
	os.MkdirAll(filepath.Dir(path), 0o755)

	file, err := os.Create(path)
	if err != nil {
		return err
	}
	defer file.Close()

	enc := json.NewEncoder(file)
	for _, msg := range session.Messages {
		enc.Encode(msg)
	}
	return nil
}

func (f *FileStore) ListSessions(ctx context.Context, tenantID, agentID string) ([]SessionMeta, error) {
	sessDir := filepath.Join(f.homeDir, "agents", agentID, "agent", "sessions")
	entries, err := os.ReadDir(sessDir)
	if err != nil {
		return nil, nil
	}

	var metas []SessionMeta
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".jsonl") {
			continue
		}
		info, _ := e.Info()
		metas = append(metas, SessionMeta{
			Key:       strings.TrimSuffix(e.Name(), ".jsonl"),
			UpdatedAt: info.ModTime(),
		})
	}
	return metas, nil
}

func (f *FileStore) DeleteSession(ctx context.Context, tenantID, agentID, sessionKey string) error {
	return os.Remove(f.sessionPath(agentID, sessionKey))
}

func (f *FileStore) sessionPath(agentID, sessionKey string) string {
	return filepath.Join(f.homeDir, "agents", agentID, "agent", "sessions", sessionKey+".jsonl")
}

// --- Memory ---

func (f *FileStore) GetMemory(ctx context.Context, tenantID, agentID string) (string, error) {
	path := filepath.Join(f.homeDir, "agents", agentID, "agent", "MEMORY.md")
	data, err := os.ReadFile(path)
	if err != nil {
		return "", nil
	}
	return string(data), nil
}

func (f *FileStore) SaveMemory(ctx context.Context, tenantID, agentID, content string) error {
	path := filepath.Join(f.homeDir, "agents", agentID, "agent", "MEMORY.md")
	return os.WriteFile(path, []byte(content), 0o644)
}

func (f *FileStore) SearchMemory(ctx context.Context, tenantID, agentID, query string, limit int) ([]MemoryEntry, error) {
	memDir := filepath.Join(f.homeDir, "agents", agentID, "agent", "memory")
	entries, err := os.ReadDir(memDir)
	if err != nil {
		return nil, nil
	}

	queryLower := strings.ToLower(query)
	var results []MemoryEntry

	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		data, err := os.ReadFile(filepath.Join(memDir, e.Name()))
		if err != nil {
			continue
		}
		for _, line := range strings.Split(string(data), "\n") {
			if strings.Contains(strings.ToLower(line), queryLower) {
				results = append(results, MemoryEntry{
					Content:   line,
					SessionID: strings.TrimSuffix(e.Name(), filepath.Ext(e.Name())),
				})
				if limit > 0 && len(results) >= limit {
					return results, nil
				}
			}
		}
	}
	return results, nil
}

func (f *FileStore) AppendMemoryLog(ctx context.Context, tenantID, agentID string, entry MemoryEntry) error {
	memDir := filepath.Join(f.homeDir, "agents", agentID, "agent", "memory")
	os.MkdirAll(memDir, 0o755)

	filename := entry.Timestamp.Format("2006-01-02") + ".jsonl"
	path := filepath.Join(memDir, filename)

	file, err := os.OpenFile(path, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o644)
	if err != nil {
		return err
	}
	defer file.Close()

	return json.NewEncoder(file).Encode(entry)
}

// --- Workspace Files ---

func (f *FileStore) GetWorkspaceFile(ctx context.Context, tenantID, agentID, filename string) ([]byte, error) {
	path := filepath.Join(f.homeDir, "agents", agentID, "agent", filename)
	return os.ReadFile(path)
}

func (f *FileStore) SaveWorkspaceFile(ctx context.Context, tenantID, agentID, filename string, data []byte) error {
	path := filepath.Join(f.homeDir, "agents", agentID, "agent", filename)
	os.MkdirAll(filepath.Dir(path), 0o755)
	return os.WriteFile(path, data, 0o644)
}

func (f *FileStore) ListWorkspaceFiles(ctx context.Context, tenantID, agentID string) ([]string, error) {
	wsDir := filepath.Join(f.homeDir, "agents", agentID, "agent")
	entries, err := os.ReadDir(wsDir)
	if err != nil {
		return nil, nil
	}
	var files []string
	for _, e := range entries {
		if !e.IsDir() {
			files = append(files, e.Name())
		}
	}
	return files, nil
}

// --- Cron Jobs ---

func (f *FileStore) cronJobsPath() string {
	return filepath.Join(f.homeDir, "cron_jobs.json")
}

func (f *FileStore) loadCronJobs() ([]CronJobRecord, error) {
	data, err := os.ReadFile(f.cronJobsPath())
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, err
	}
	var jobs []CronJobRecord
	if err := json.Unmarshal(data, &jobs); err != nil {
		return nil, err
	}
	return jobs, nil
}

func (f *FileStore) saveCronJobs(jobs []CronJobRecord) error {
	data, err := json.MarshalIndent(jobs, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(f.cronJobsPath(), data, 0o644)
}

func (f *FileStore) ListCronJobs(ctx context.Context, tenantID string) ([]CronJobRecord, error) {
	return f.loadCronJobs()
}

func (f *FileStore) GetCronJob(ctx context.Context, tenantID, jobID string) (*CronJobRecord, error) {
	jobs, err := f.loadCronJobs()
	if err != nil {
		return nil, err
	}
	for i := range jobs {
		if jobs[i].ID == jobID {
			return &jobs[i], nil
		}
	}
	return nil, fmt.Errorf("cron job not found: %s", jobID)
}

func (f *FileStore) SaveCronJob(ctx context.Context, tenantID string, job *CronJobRecord) error {
	jobs, err := f.loadCronJobs()
	if err != nil {
		return err
	}
	found := false
	for i := range jobs {
		if jobs[i].ID == job.ID {
			jobs[i] = *job
			found = true
			break
		}
	}
	if !found {
		jobs = append(jobs, *job)
	}
	return f.saveCronJobs(jobs)
}

func (f *FileStore) DeleteCronJob(ctx context.Context, tenantID, jobID string) error {
	jobs, err := f.loadCronJobs()
	if err != nil {
		return err
	}
	for i := range jobs {
		if jobs[i].ID == jobID {
			jobs = append(jobs[:i], jobs[i+1:]...)
			return f.saveCronJobs(jobs)
		}
	}
	return fmt.Errorf("cron job not found: %s", jobID)
}

func (f *FileStore) GetDueCronJobs(ctx context.Context, now time.Time) ([]CronJobRecord, error) {
	jobs, err := f.loadCronJobs()
	if err != nil {
		return nil, err
	}
	var due []CronJobRecord
	for _, j := range jobs {
		if j.Enabled && j.NextRun != nil && !j.NextRun.After(now) {
			due = append(due, j)
		}
	}
	return due, nil
}

func (f *FileStore) LockCronJob(ctx context.Context, jobID, instanceID string) (bool, error) {
	// Single instance: always succeed
	return true, nil
}

func (f *FileStore) UpdateCronJobRun(ctx context.Context, jobID string, lastRun, nextRun time.Time) error {
	jobs, err := f.loadCronJobs()
	if err != nil {
		return err
	}
	for i := range jobs {
		if jobs[i].ID == jobID {
			jobs[i].LastRun = &lastRun
			jobs[i].NextRun = &nextRun
			return f.saveCronJobs(jobs)
		}
	}
	return fmt.Errorf("cron job not found: %s", jobID)
}

// Ensure FileStore implements Store.
var _ Store = (*FileStore)(nil)
