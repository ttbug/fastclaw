package setup

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/fastclaw-ai/fastclaw/internal/store"
)

// createCronTestAgent provisions an agent owned by ownerID for the
// per-agent cron handler tests.
func createCronTestAgent(t *testing.T, ctx context.Context, st store.Store, id, ownerID string) string {
	t.Helper()
	if err := st.SaveAgent(ctx, &store.AgentRecord{ID: id, UserID: ownerID, Name: "Cron Test"}); err != nil {
		t.Fatalf("SaveAgent: %v", err)
	}
	return id
}

func postCronJob(t *testing.T, ctx context.Context, s *Server, resolver interface {
	IssueSession(context.Context, string) (*http.Cookie, error)
}, agentID, userID, body string) *httptest.ResponseRecorder {
	t.Helper()
	req := mcpAuthRequest(t, ctx, resolver, http.MethodPost, "/api/agents/"+agentID+"/cron", userID, body)
	req.SetPathValue("id", agentID)
	rr := httptest.NewRecorder()
	s.authMiddleware(s.handleCreateAgentCronJob)(rr, req)
	return rr
}

func TestCreateAgentCronJobTypes(t *testing.T) {
	ctx := context.Background()
	s, resolver, _, owner := newAuthTestServer(t, ctx)
	agentID := createCronTestAgent(t, ctx, s.dataStore, "agt_cron_types", owner.ID)

	cases := []struct {
		name     string
		body     string
		wantType string
	}{
		{"cron", `{"name":"daily","type":"cron","schedule":"0 9 * * *","message":"hi","channel":"web","chatId":"sess-1"}`, "cron"},
		{"interval", `{"name":"poll","type":"interval","schedule":"30m","message":"hi","channel":"web","chatId":"sess-1"}`, "interval"},
		{"once", `{"name":"remind","type":"once","schedule":"2099-01-01T09:00:00","message":"hi","channel":"web","chatId":"sess-1"}`, "once"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			rr := postCronJob(t, ctx, s, resolver, agentID, owner.ID, tc.body)
			if rr.Code != http.StatusOK {
				t.Fatalf("status = %d, body=%s", rr.Code, rr.Body.String())
			}
			var resp struct {
				OK  bool                 `json:"ok"`
				Job *store.CronJobRecord `json:"job"`
			}
			if err := json.Unmarshal(rr.Body.Bytes(), &resp); err != nil {
				t.Fatalf("decode: %v", err)
			}
			if !resp.OK || resp.Job == nil {
				t.Fatalf("want ok+job, got %s", rr.Body.String())
			}
			if resp.Job.Type != tc.wantType {
				t.Fatalf("type = %q, want %q", resp.Job.Type, tc.wantType)
			}
			if resp.Job.ID == "" || resp.Job.NextRun == nil {
				t.Fatalf("job must have id + nextRun, got %#v", resp.Job)
			}
		})
	}

	// All three persisted under this agent.
	jobs, err := s.dataStore.ListCronJobsByAgent(ctx, agentID)
	if err != nil {
		t.Fatalf("ListCronJobsByAgent: %v", err)
	}
	if len(jobs) != 3 {
		t.Fatalf("want 3 persisted jobs, got %d", len(jobs))
	}
}

func TestCreateAgentCronJobIntervalNextRun(t *testing.T) {
	ctx := context.Background()
	s, resolver, _, owner := newAuthTestServer(t, ctx)
	agentID := createCronTestAgent(t, ctx, s.dataStore, "agt_cron_interval", owner.ID)

	before := time.Now()
	rr := postCronJob(t, ctx, s, resolver, agentID, owner.ID,
		`{"name":"poll","type":"interval","schedule":"30m","message":"hi","channel":"web","chatId":"s"}`)
	if rr.Code != http.StatusOK {
		t.Fatalf("status = %d, body=%s", rr.Code, rr.Body.String())
	}
	var resp struct {
		Job *store.CronJobRecord `json:"job"`
	}
	if err := json.Unmarshal(rr.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if resp.Job == nil || resp.Job.NextRun == nil {
		t.Fatalf("missing nextRun: %s", rr.Body.String())
	}
	delta := resp.Job.NextRun.Sub(before)
	if delta < 29*time.Minute || delta > 31*time.Minute {
		t.Fatalf("interval nextRun should be ~30m out, got %s", delta)
	}
}

func TestCreateAgentCronJobValidation(t *testing.T) {
	ctx := context.Background()
	s, resolver, _, owner := newAuthTestServer(t, ctx)
	agentID := createCronTestAgent(t, ctx, s.dataStore, "agt_cron_invalid", owner.ID)

	bad := []struct {
		name string
		body string
	}{
		{"missing message", `{"name":"x","type":"cron","schedule":"0 9 * * *","channel":"web","chatId":"s"}`},
		{"missing name", `{"type":"cron","schedule":"0 9 * * *","message":"hi","channel":"web","chatId":"s"}`},
		{"missing schedule", `{"name":"x","type":"cron","message":"hi","channel":"web","chatId":"s"}`},
		{"once in the past", `{"name":"x","type":"once","schedule":"2000-01-01T00:00:00","message":"hi","channel":"web","chatId":"s"}`},
		{"malformed cron", `{"name":"x","type":"cron","schedule":"not a cron","message":"hi","channel":"web","chatId":"s"}`},
		{"bad interval", `{"name":"x","type":"interval","schedule":"abc","message":"hi","channel":"web","chatId":"s"}`},
	}
	for _, tc := range bad {
		t.Run(tc.name, func(t *testing.T) {
			rr := postCronJob(t, ctx, s, resolver, agentID, owner.ID, tc.body)
			if rr.Code != http.StatusBadRequest {
				t.Fatalf("want 400, got %d (body=%s)", rr.Code, rr.Body.String())
			}
		})
	}
}

func TestCreateAgentCronJobRejectsNonOwner(t *testing.T) {
	ctx := context.Background()
	s, resolver, admin, regular := newAuthTestServer(t, ctx)
	// Agent owned by admin; regular (non-owner, non-superadmin) is denied.
	agentID := createCronTestAgent(t, ctx, s.dataStore, "agt_cron_owned", admin.ID)

	rr := postCronJob(t, ctx, s, resolver, agentID, regular.ID,
		`{"name":"x","type":"cron","schedule":"0 9 * * *","message":"hi","channel":"web","chatId":"s"}`)
	if rr.Code != http.StatusForbidden {
		t.Fatalf("want 403, got %d (body=%s)", rr.Code, rr.Body.String())
	}
}
