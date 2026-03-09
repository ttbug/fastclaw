package agent

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/fastclaw-ai/fastclaw/internal/config"
)

// Skill represents a discovered skill.
type Skill struct {
	Name    string // directory name
	Layer   string // "global", "team", or "agent"
	Content string // contents of SKILL.md
}

// SkillsLoader discovers and merges skills from three layers: global > team > agent.
// Agent-level skills win on conflict.
type SkillsLoader struct {
	homeDir   string
	agentDir  string // agent workspace path
	teamDir   string // team directory (empty if no team)
	skillsCfg config.SkillsConfig
}

// NewSkillsLoader creates a new skills loader.
func NewSkillsLoader(homeDir, agentDir, teamDir string, skillsCfg config.SkillsConfig) *SkillsLoader {
	return &SkillsLoader{
		homeDir:   homeDir,
		agentDir:  agentDir,
		teamDir:   teamDir,
		skillsCfg: skillsCfg,
	}
}

// LoadSkills discovers skills from all layers and returns them merged (agent wins on conflict).
func (sl *SkillsLoader) LoadSkills() []Skill {
	skills := make(map[string]Skill)

	disabled := make(map[string]bool, len(sl.skillsCfg.Disabled))
	for _, name := range sl.skillsCfg.Disabled {
		disabled[name] = true
	}

	// Layer 1: global skills (~/.fastclaw/skills/)
	globalDir := filepath.Join(sl.homeDir, "skills")
	for name, content := range discoverSkills(globalDir) {
		if !disabled[name] {
			skills[name] = Skill{Name: name, Layer: "global", Content: content}
		}
	}

	// Layer 2: team skills
	if sl.teamDir != "" {
		teamSkillsDir := filepath.Join(sl.teamDir, "skills")
		for name, content := range discoverSkills(teamSkillsDir) {
			if !disabled[name] {
				skills[name] = Skill{Name: name, Layer: "team", Content: content}
			}
		}
	}

	// Layer 3: agent skills (highest priority)
	agentSkillsDir := filepath.Join(sl.agentDir, "skills")
	for name, content := range discoverSkills(agentSkillsDir) {
		if !disabled[name] {
			skills[name] = Skill{Name: name, Layer: "agent", Content: content}
		}
	}

	result := make([]Skill, 0, len(skills))
	for _, s := range skills {
		result = append(result, s)
	}
	return result
}

// BuildSkillsSummary returns an XML summary of all skills for the system prompt.
// Always-load skills get their full content injected.
func (sl *SkillsLoader) BuildSkillsSummary(skills []Skill) string {
	if len(skills) == 0 {
		return ""
	}

	alwaysLoad := make(map[string]bool, len(sl.skillsCfg.AlwaysLoad))
	for _, name := range sl.skillsCfg.AlwaysLoad {
		alwaysLoad[name] = true
	}

	var sb strings.Builder
	sb.WriteString("<skills>\n")

	for _, skill := range skills {
		if alwaysLoad[skill.Name] {
			// Full content for always-load skills
			fmt.Fprintf(&sb, "<skill name=%q layer=%q>\n%s\n</skill>\n", skill.Name, skill.Layer, skill.Content)
		} else {
			// Summary only: first line or truncated
			summary := firstLine(skill.Content)
			fmt.Fprintf(&sb, "<skill name=%q layer=%q summary=%q />\n", skill.Name, skill.Layer, summary)
		}
	}

	sb.WriteString("</skills>")
	return sb.String()
}

// discoverSkills scans a directory for subdirectories containing SKILL.md.
func discoverSkills(dir string) map[string]string {
	result := make(map[string]string)

	entries, err := os.ReadDir(dir)
	if err != nil {
		return result
	}

	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		skillFile := filepath.Join(dir, entry.Name(), "SKILL.md")
		data, err := os.ReadFile(skillFile)
		if err != nil {
			continue
		}
		result[entry.Name()] = strings.TrimSpace(string(data))
	}

	return result
}

func firstLine(s string) string {
	if idx := strings.IndexByte(s, '\n'); idx >= 0 {
		return s[:idx]
	}
	if len(s) > 120 {
		return s[:120] + "..."
	}
	return s
}
