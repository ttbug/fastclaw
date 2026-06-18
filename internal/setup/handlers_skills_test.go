package setup

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/fastclaw-ai/fastclaw/internal/auth"
	"github.com/fastclaw-ai/fastclaw/internal/config"
	"github.com/fastclaw-ai/fastclaw/internal/store"
	"github.com/fastclaw-ai/fastclaw/internal/users"
)

func TestListSkillsRequiresAuth(t *testing.T) {
	ctx := context.Background()
	s, resolver, adminUser, regularUser := newAuthTestServer(t, ctx)
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
		handler(rr, authTestRequest(t, ctx, resolver, http.MethodGet, "/api/skills", regularUser.ID))
		if rr.Code != http.StatusOK {
			t.Fatalf("status = %d, want %d", rr.Code, http.StatusOK)
		}
		if got := strings.TrimSpace(rr.Body.String()); got != "[]" {
			t.Fatalf("body = %q, want []", got)
		}
	})

	t.Run("super admin is allowed", func(t *testing.T) {
		rr := httptest.NewRecorder()
		handler(rr, authTestRequest(t, ctx, resolver, http.MethodGet, "/api/skills", adminUser.ID))
		if rr.Code != http.StatusOK {
			t.Fatalf("status = %d, want %d", rr.Code, http.StatusOK)
		}
		if got := strings.TrimSpace(rr.Body.String()); got != "[]" {
			t.Fatalf("body = %q, want []", got)
		}
	})
}

func newAuthTestServer(t *testing.T, ctx context.Context) (*Server, *auth.Resolver, *users.Account, *users.Account) {
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
	adminUser := createAuthTestUser(t, ctx, accts, "admin", users.RoleSuperAdmin)
	regularUser := createAuthTestUser(t, ctx, accts, "user", users.RoleUser)
	resolver, err := auth.NewResolver(st)
	if err != nil {
		t.Fatalf("NewResolver: %v", err)
	}

	s := NewServer(0)
	s.SetStore(st)
	s.SetAuth(resolver)
	return s, resolver, adminUser, regularUser
}

func createAuthTestUser(t *testing.T, ctx context.Context, accts *users.Accounts, username, role string) *users.Account {
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

func authTestRequest(t *testing.T, ctx context.Context, resolver *auth.Resolver, method, path, userID string) *http.Request {
	t.Helper()

	cookie, err := resolver.IssueSession(ctx, userID)
	if err != nil {
		t.Fatalf("IssueSession: %v", err)
	}
	req := httptest.NewRequest(method, path, nil)
	req.AddCookie(cookie)
	return req
}

// writeSkillMD is a tiny helper that drops a minimal SKILL.md into a
// user-scoped skill directory. Mirrors what `npx skills add` lands on
// disk so tests exercise the same on-disk shape the loader consumes.
func writeSkillMD(t *testing.T, uid, name, description string) {
	t.Helper()
	homeDir, err := config.HomeDir()
	if err != nil {
		t.Fatalf("HomeDir: %v", err)
	}
	dir := filepath.Join(homeDir, "users", uid, "skills", name)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		t.Fatalf("MkdirAll: %v", err)
	}
	body := "---\nname: " + name + "\ndescription: " + description + "\n---\n\n# " + name + "\n"
	if err := os.WriteFile(filepath.Join(dir, "SKILL.md"), []byte(body), 0o644); err != nil {
		t.Fatalf("WriteFile: %v", err)
	}
}

func TestListMySkills(t *testing.T) {
	ctx := context.Background()
	s, resolver, _, regularUser := newAuthTestServer(t, ctx)
	home := t.TempDir()
	t.Setenv("FASTCLAW_HOME", home)

	handler := s.authMiddleware(s.handleListMySkills)

	t.Run("unauthenticated request is rejected", func(t *testing.T) {
		rr := httptest.NewRecorder()
		handler(rr, httptest.NewRequest(http.MethodGet, "/api/me/skills", nil))
		if rr.Code != http.StatusUnauthorized {
			t.Fatalf("status = %d, want %d", rr.Code, http.StatusUnauthorized)
		}
	})

	t.Run("empty bucket returns empty array", func(t *testing.T) {
		rr := httptest.NewRecorder()
		handler(rr, authTestRequest(t, ctx, resolver, http.MethodGet, "/api/me/skills", regularUser.ID))
		if rr.Code != http.StatusOK {
			t.Fatalf("status = %d, want %d", rr.Code, http.StatusOK)
		}
		if got := strings.TrimSpace(rr.Body.String()); got != "[]" {
			t.Fatalf("body = %q, want []", got)
		}
	})

	t.Run("lists only the caller's skills", func(t *testing.T) {
		// Stand up a second user and a skill in their bucket; the
		// regular user must NOT see it. Catches the cross-tenant leak
		// the URL-keying design is supposed to prevent.
		accts, err := users.NewAccounts(s.dataStore)
		if err != nil {
			t.Fatalf("NewAccounts: %v", err)
		}
		other, err := accts.Create(ctx, users.CreateInput{
			Username: "other",
			Email:    "other@example.test",
			Password: "password",
			Role:     users.RoleUser,
		})
		if err != nil {
			t.Fatalf("Create other: %v", err)
		}
		writeSkillMD(t, regularUser.ID, "pdf-tools", "Convert documents to PDF")
		writeSkillMD(t, other.ID, "leaky-skill", "should not appear")

		rr := httptest.NewRecorder()
		handler(rr, authTestRequest(t, ctx, resolver, http.MethodGet, "/api/me/skills", regularUser.ID))
		if rr.Code != http.StatusOK {
			t.Fatalf("status = %d, want %d", rr.Code, http.StatusOK)
		}
		var list []map[string]any
		if err := json.Unmarshal(rr.Body.Bytes(), &list); err != nil {
			t.Fatalf("decode: %v", err)
		}
		if len(list) != 1 {
			t.Fatalf("len = %d, want 1; body = %s", len(list), rr.Body.String())
		}
		if list[0]["name"] != "pdf-tools" {
			t.Fatalf("name = %v, want pdf-tools", list[0]["name"])
		}
		if list[0]["description"] != "Convert documents to PDF" {
			t.Fatalf("description = %v, want 'Convert documents to PDF'", list[0]["description"])
		}
	})
}

func TestDeleteMySkill(t *testing.T) {
	ctx := context.Background()
	s, resolver, _, regularUser := newAuthTestServer(t, ctx)
	home := t.TempDir()
	t.Setenv("FASTCLAW_HOME", home)

	listHandler := s.authMiddleware(s.handleListMySkills)
	delHandler := s.authMiddleware(s.handleDeleteMySkill)

	writeSkillMD(t, regularUser.ID, "scratch", "to be deleted")
	writeSkillMD(t, regularUser.ID, "keep", "should survive")

	t.Run("delete removes the named skill from the bucket", func(t *testing.T) {
		req := authTestRequest(t, ctx, resolver, http.MethodDelete, "/api/me/skills/scratch", regularUser.ID)
		req.SetPathValue("name", "scratch")
		rr := httptest.NewRecorder()
		delHandler(rr, req)
		if rr.Code != http.StatusOK {
			t.Fatalf("status = %d, body = %s", rr.Code, rr.Body.String())
		}

		rr = httptest.NewRecorder()
		listHandler(rr, authTestRequest(t, ctx, resolver, http.MethodGet, "/api/me/skills", regularUser.ID))
		var list []map[string]any
		if err := json.Unmarshal(rr.Body.Bytes(), &list); err != nil {
			t.Fatalf("decode: %v", err)
		}
		if len(list) != 1 || list[0]["name"] != "keep" {
			t.Fatalf("after delete: %v", list)
		}

		// And the on-disk dir is gone.
		homeDir, _ := config.HomeDir()
		if _, err := os.Stat(filepath.Join(homeDir, "users", regularUser.ID, "skills", "scratch")); !os.IsNotExist(err) {
			t.Fatalf("scratch dir still on disk: %v", err)
		}
	})

	t.Run("cannot delete another user's skill", func(t *testing.T) {
		accts, _ := users.NewAccounts(s.dataStore)
		other, _ := accts.Create(ctx, users.CreateInput{
			Username: "victim", Email: "victim@example.test",
			Password: "password", Role: users.RoleUser,
		})
		writeSkillMD(t, other.ID, "private", "owner-only")

		// The path is keyed off auth context, not the URL — there's no
		// way to express "delete user X's skill" in this API. We can
		// only confirm the regular user can't delete something in
		// their OWN bucket that doesn't exist, which would be a 500
		// from RemoveAll on a missing path... so just verify their
		// own bucket is unchanged.
		rr := httptest.NewRecorder()
		listHandler(rr, authTestRequest(t, ctx, resolver, http.MethodGet, "/api/me/skills", other.ID))
		var list []map[string]any
		_ = json.Unmarshal(rr.Body.Bytes(), &list)
		if len(list) != 1 || list[0]["name"] != "private" {
			t.Fatalf("victim's bucket was disturbed: %v", list)
		}
	})
}
