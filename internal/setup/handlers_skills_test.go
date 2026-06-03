package setup

import (
	"context"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"

	"github.com/fastclaw-ai/fastclaw/internal/auth"
	"github.com/fastclaw-ai/fastclaw/internal/store"
	"github.com/fastclaw-ai/fastclaw/internal/users"
)

func TestListSkillsRequiresAuth(t *testing.T) {
	ctx := context.Background()
	s, resolver, adminUser, regularUser := newSkillsAuthTestServer(t, ctx)
	t.Setenv("FASTCLAW_HOME", t.TempDir())

	handler := s.authMiddleware(s.handleListSkills)

	t.Run("unauthenticated request is rejected", func(t *testing.T) {
		rr := httptest.NewRecorder()
		handler(rr, httptest.NewRequest(http.MethodGet, "/api/skills", nil))
		if rr.Code != http.StatusUnauthorized {
			t.Fatalf("status = %d, want %d", rr.Code, http.StatusUnauthorized)
		}
	})

	t.Run("regular user is allowed", func(t *testing.T) {
		rr := httptest.NewRecorder()
		handler(rr, skillsListRequest(t, ctx, resolver, regularUser.ID))
		if rr.Code != http.StatusOK {
			t.Fatalf("status = %d, want %d", rr.Code, http.StatusOK)
		}
		if got := strings.TrimSpace(rr.Body.String()); got != "[]" {
			t.Fatalf("body = %q, want []", got)
		}
	})

	t.Run("super admin is allowed", func(t *testing.T) {
		rr := httptest.NewRecorder()
		handler(rr, skillsListRequest(t, ctx, resolver, adminUser.ID))
		if rr.Code != http.StatusOK {
			t.Fatalf("status = %d, want %d", rr.Code, http.StatusOK)
		}
		if got := strings.TrimSpace(rr.Body.String()); got != "[]" {
			t.Fatalf("body = %q, want []", got)
		}
	})
}

func newSkillsAuthTestServer(t *testing.T, ctx context.Context) (*Server, *auth.Resolver, *users.Account, *users.Account) {
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
	adminUser := createSkillsTestUser(t, ctx, accts, "admin", users.RoleSuperAdmin)
	regularUser := createSkillsTestUser(t, ctx, accts, "user", users.RoleUser)
	resolver, err := auth.NewResolver(st)
	if err != nil {
		t.Fatalf("NewResolver: %v", err)
	}

	s := NewServer(0)
	s.SetStore(st)
	s.SetAuth(resolver)
	return s, resolver, adminUser, regularUser
}

func createSkillsTestUser(t *testing.T, ctx context.Context, accts *users.Accounts, username, role string) *users.Account {
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

func skillsListRequest(t *testing.T, ctx context.Context, resolver *auth.Resolver, userID string) *http.Request {
	t.Helper()

	cookie, err := resolver.IssueSession(ctx, userID)
	if err != nil {
		t.Fatalf("IssueSession: %v", err)
	}
	req := httptest.NewRequest(http.MethodGet, "/api/skills", nil)
	req.AddCookie(cookie)
	return req
}
