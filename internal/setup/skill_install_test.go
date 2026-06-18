package setup

import (
	"context"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/fastclaw-ai/fastclaw/internal/auth"
	"github.com/fastclaw-ai/fastclaw/internal/skills"
	"github.com/fastclaw-ai/fastclaw/internal/store"
	"github.com/fastclaw-ai/fastclaw/internal/users"
)

func TestAuthorizeSkillInstallTargetRequiresAdminForGlobalInstalls(t *testing.T) {
	s := NewServer(0)

	tests := []struct {
		name       string
		ident      auth.Identity
		wantOK     bool
		wantStatus int
	}{
		{
			name: "regular user session rejected",
			ident: auth.Identity{
				UserID:     "u_user",
				Role:       users.RoleUser,
				AuthMethod: "session",
			},
			wantOK:     false,
			wantStatus: http.StatusForbidden,
		},
		{
			name: "super admin session allowed",
			ident: auth.Identity{
				UserID:     "u_admin",
				Role:       users.RoleSuperAdmin,
				AuthMethod: "session",
			},
			wantOK: true,
		},
		{
			name: "admin api key allowed",
			ident: auth.Identity{
				UserID:     "u_user",
				Role:       users.RoleUser,
				AuthMethod: "apikey",
				APIKeyType: users.APIKeyTypeAdmin,
			},
			wantOK: true,
		},
		{
			name: "actAs super admin rejected as read only",
			ident: auth.Identity{
				UserID:      "u_admin",
				Role:        users.RoleSuperAdmin,
				AuthMethod:  "session",
				ActAsUserID: "u_other",
			},
			wantOK:     false,
			wantStatus: http.StatusForbidden,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rr := httptest.NewRecorder()
			ok := s.authorizeSkillInstallTarget(rr, skillInstallRequest(tt.ident), "")
			if ok != tt.wantOK {
				t.Fatalf("ok = %v, want %v", ok, tt.wantOK)
			}
			if !tt.wantOK && rr.Code != tt.wantStatus {
				t.Fatalf("status = %d, want %d", rr.Code, tt.wantStatus)
			}
		})
	}
}

func TestAuthorizeSkillInstallTargetKeepsUserInstallsSelfScoped(t *testing.T) {
	tests := []struct {
		name       string
		ident      auth.Identity
		agent      string
		wantOK     bool
		wantStatus int
	}{
		{
			name: "owner of their own bucket allowed",
			ident: auth.Identity{
				UserID:     "u_alice",
				Role:       users.RoleUser,
				AuthMethod: "session",
			},
			agent:  skills.UserSkillOwnerPrefix + "u_alice",
			wantOK: true,
		},
		{
			name: "different regular user rejected",
			ident: auth.Identity{
				UserID:     "u_bob",
				Role:       users.RoleUser,
				AuthMethod: "session",
			},
			agent:      skills.UserSkillOwnerPrefix + "u_alice",
			wantOK:     false,
			wantStatus: http.StatusForbidden,
		},
		{
			name: "admin can write to any user's bucket",
			ident: auth.Identity{
				UserID:     "u_admin",
				Role:       users.RoleSuperAdmin,
				AuthMethod: "session",
			},
			agent:  skills.UserSkillOwnerPrefix + "u_alice",
			wantOK: true,
		},
		{
			name: "admin api key can write to any user's bucket",
			ident: auth.Identity{
				UserID:     "u_anon",
				Role:       users.RoleUser,
				AuthMethod: "apikey",
				APIKeyType: users.APIKeyTypeAdmin,
			},
			agent:  skills.UserSkillOwnerPrefix + "u_alice",
			wantOK: true,
		},
		{
			name: "actAs read-only admin rejected",
			ident: auth.Identity{
				UserID:      "u_admin",
				Role:        users.RoleSuperAdmin,
				AuthMethod:  "session",
				ActAsUserID: "u_alice",
			},
			agent:      skills.UserSkillOwnerPrefix + "u_alice",
			wantOK:     false,
			wantStatus: http.StatusForbidden,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			s := NewServer(0)
			rr := httptest.NewRecorder()
			ok := s.authorizeSkillInstallTarget(rr, skillInstallRequest(tt.ident), tt.agent)
			if ok != tt.wantOK {
				t.Fatalf("ok = %v, want %v", ok, tt.wantOK)
			}
			if !tt.wantOK && rr.Code != tt.wantStatus {
				t.Fatalf("status = %d, want %d", rr.Code, tt.wantStatus)
			}
		})
	}
}

func TestParseUserAgentID(t *testing.T) {
	tests := []struct {
		in      string
		wantUID string
		wantOK  bool
	}{
		{"_user_u_alice", "u_alice", true},
		{"_user_", "", false},
		{"", "", false},
		{"agent_x", "", false},
		{"_USER_u_alice", "", false}, // case sensitive — guards against confusion with real IDs
		{"_user_u_with_underscores", "u_with_underscores", true},
	}
	for _, tt := range tests {
		t.Run(tt.in, func(t *testing.T) {
			uid, ok := parseUserAgentID(tt.in)
			if uid != tt.wantUID || ok != tt.wantOK {
				t.Fatalf("parseUserAgentID(%q) = (%q, %v), want (%q, %v)", tt.in, uid, ok, tt.wantUID, tt.wantOK)
			}
		})
	}
}

func TestResolveInstallTargetForUserBucket(t *testing.T) {
	home := t.TempDir()
	t.Setenv("FASTCLAW_HOME", home)

	uid := "u_charlie"
	agent := skills.UserSkillOwnerPrefix + uid
	dir, err := resolveInstallTarget(httptest.NewRequest(http.MethodPost, "/", nil), agent)
	if err != nil {
		t.Fatalf("resolveInstallTarget: %v", err)
	}
	want := filepath.Join(home, "users", uid, "skills")
	if dir != want {
		t.Fatalf("dir = %q, want %q", dir, want)
	}
	// Directory should have been created so the install can land directly.
	if _, err := os.Stat(dir); err != nil {
		t.Fatalf("stat: %v", err)
	}
}

func TestAuthorizeSkillInstallTargetKeepsAgentInstallsOwnerScoped(t *testing.T) {
	ctx := context.Background()
	s, st, accts := newSkillInstallAuthServer(t, ctx)
	owner := createSkillInstallTestUser(t, ctx, accts, "owner", users.RoleUser)
	other := createSkillInstallTestUser(t, ctx, accts, "other", users.RoleUser)
	if err := st.SaveAgent(ctx, &store.AgentRecord{
		ID:     "agt_owner",
		UserID: owner.ID,
		Name:   "Owner Agent",
	}); err != nil {
		t.Fatalf("SaveAgent: %v", err)
	}

	tests := []struct {
		name       string
		ident      auth.Identity
		wantOK     bool
		wantStatus int
	}{
		{
			name: "owner allowed",
			ident: auth.Identity{
				UserID:     owner.ID,
				Role:       users.RoleUser,
				AuthMethod: "session",
			},
			wantOK: true,
		},
		{
			name: "non owner rejected",
			ident: auth.Identity{
				UserID:     other.ID,
				Role:       users.RoleUser,
				AuthMethod: "session",
			},
			wantOK:     false,
			wantStatus: http.StatusForbidden,
		},
		{
			name: "read only owner rejected",
			ident: auth.Identity{
				UserID:      "u_admin",
				Role:        users.RoleSuperAdmin,
				AuthMethod:  "session",
				ActAsUserID: owner.ID,
			},
			wantOK:     false,
			wantStatus: http.StatusForbidden,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rr := httptest.NewRecorder()
			ok := s.authorizeSkillInstallTarget(rr, skillInstallRequest(tt.ident), "agt_owner")
			if ok != tt.wantOK {
				t.Fatalf("ok = %v, want %v", ok, tt.wantOK)
			}
			if !tt.wantOK && rr.Code != tt.wantStatus {
				t.Fatalf("status = %d, want %d", rr.Code, tt.wantStatus)
			}
		})
	}
}

func skillInstallRequest(ident auth.Identity) *http.Request {
	req := httptest.NewRequest(http.MethodPost, "/api/skills/install", nil)
	return req.WithContext(auth.WithIdentity(req.Context(), ident))
}

func newSkillInstallAuthServer(t *testing.T, ctx context.Context) (*Server, store.Store, *users.Accounts) {
	t.Helper()

	dbPath := filepath.Join(t.TempDir(), "fastclaw.db")
	st, err := store.NewDBStore("sqlite", "file:"+dbPath+"?cache=shared")
	if err != nil {
		t.Fatalf("NewDBStore: %v", err)
	}
	t.Cleanup(func() {
		_ = st.Close()
	})
	if err := st.Migrate(ctx); err != nil {
		t.Fatalf("Migrate: %v", err)
	}
	accts, err := users.NewAccounts(st)
	if err != nil {
		t.Fatalf("NewAccounts: %v", err)
	}
	s := NewServer(0)
	s.SetStore(st)
	return s, st, accts
}

func createSkillInstallTestUser(t *testing.T, ctx context.Context, accts *users.Accounts, username, role string) *users.Account {
	t.Helper()

	acct, err := accts.Create(ctx, users.CreateInput{
		Username: username,
		Email:    username + "@example.test",
		Password: "password",
		Role:     role,
	})
	if err != nil {
		t.Fatalf("Create(%s): %v", username, err)
	}
	return acct
}
