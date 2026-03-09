package config

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

// Config is the top-level configuration loaded from ~/.fastclaw/config.json.
type Config struct {
	Providers map[string]ProviderConfig      `json:"providers"`
	Defaults  DefaultsConfig                 `json:"defaults"`
	Agents    map[string]AgentOverrideConfig  `json:"agents,omitempty"`
	Channels  ChannelsConfig                 `json:"channels"`
}

// ProviderConfig holds API credentials for an LLM provider.
type ProviderConfig struct {
	APIKey  string `json:"apiKey"`
	APIBase string `json:"apiBase"`
}

// DefaultsConfig holds fallback values for all agents.
type DefaultsConfig struct {
	Model             string  `json:"model"`
	MaxTokens         int     `json:"maxTokens"`
	Temperature       float64 `json:"temperature"`
	MaxToolIterations int     `json:"maxToolIterations"`
}

// AgentOverrideConfig is a per-agent override block in config.json.
type AgentOverrideConfig struct {
	Model       string   `json:"model,omitempty"`
	MaxTokens   int      `json:"maxTokens,omitempty"`
	Temperature float64  `json:"temperature,omitempty"`
	Channels    []string `json:"channels,omitempty"`
}

// AgentFileConfig is the schema for agent.json inside an agent workspace.
type AgentFileConfig struct {
	Model             string       `json:"model,omitempty"`
	MaxTokens         int          `json:"maxTokens,omitempty"`
	Temperature       float64      `json:"temperature,omitempty"`
	MaxToolIterations int          `json:"maxToolIterations,omitempty"`
	Channels          []string     `json:"channels,omitempty"`
	Skills            SkillsConfig `json:"skills,omitempty"`
}

// SkillsConfig controls skill loading for an agent.
type SkillsConfig struct {
	Disabled   []string `json:"disabled,omitempty"`
	AlwaysLoad []string `json:"alwaysLoad,omitempty"`
}

// ResolvedAgent is the fully merged config for a single agent.
type ResolvedAgent struct {
	Name              string
	Workspace         string
	Model             string
	MaxTokens         int
	Temperature       float64
	MaxToolIterations int
	Channels          []string
	Skills            SkillsConfig
}

// TeamConfig is the schema for team.json.
type TeamConfig struct {
	Name    string            `json:"name"`
	Agents  []string          `json:"agents"`
	Routing map[string]string `json:"routing"`
}

// ChannelsConfig holds per-channel configuration.
type ChannelsConfig struct {
	Telegram TelegramConfig `json:"telegram"`
}

// TelegramConfig holds Telegram bot settings.
type TelegramConfig struct {
	Enabled  bool   `json:"enabled"`
	BotToken string `json:"botToken"`
}

// HomeDir returns the FastClaw home directory (~/.fastclaw).
func HomeDir() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(home, ".fastclaw"), nil
}

func expandPath(path string) string {
	if strings.HasPrefix(path, "~/") {
		home, err := os.UserHomeDir()
		if err != nil {
			return path
		}
		return filepath.Join(home, path[2:])
	}
	return path
}

// Load reads and parses ~/.fastclaw/config.json.
func Load() (*Config, error) {
	homeDir, err := HomeDir()
	if err != nil {
		return nil, fmt.Errorf("get home dir: %w", err)
	}

	configPath := filepath.Join(homeDir, "config.json")
	data, err := os.ReadFile(configPath)
	if err != nil {
		return nil, fmt.Errorf("read config %s: %w", configPath, err)
	}

	var cfg Config
	if err := json.Unmarshal(data, &cfg); err != nil {
		return nil, fmt.Errorf("parse config: %w", err)
	}

	if cfg.Defaults.Model == "" {
		cfg.Defaults.Model = "gpt-4o"
	}
	if cfg.Defaults.MaxTokens == 0 {
		cfg.Defaults.MaxTokens = 8192
	}
	if cfg.Defaults.Temperature == 0 {
		cfg.Defaults.Temperature = 0.7
	}
	if cfg.Defaults.MaxToolIterations == 0 {
		cfg.Defaults.MaxToolIterations = 20
	}

	return &cfg, nil
}

// ResolveAgents discovers agents from ~/.fastclaw/agents/ and merges config layers:
// defaults < config.json agents map < agent.json file.
func ResolveAgents(cfg *Config) ([]ResolvedAgent, error) {
	homeDir, err := HomeDir()
	if err != nil {
		return nil, err
	}

	agentsDir := filepath.Join(homeDir, "agents")
	entries, err := os.ReadDir(agentsDir)
	if err != nil {
		if os.IsNotExist(err) {
			return []ResolvedAgent{defaultAgent(cfg, homeDir)}, nil
		}
		return nil, fmt.Errorf("read agents dir: %w", err)
	}

	var agents []ResolvedAgent
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		name := entry.Name()
		workspace := filepath.Join(agentsDir, name, "agent")

		resolved := ResolvedAgent{
			Name:              name,
			Workspace:         workspace,
			Model:             cfg.Defaults.Model,
			MaxTokens:         cfg.Defaults.MaxTokens,
			Temperature:       cfg.Defaults.Temperature,
			MaxToolIterations: cfg.Defaults.MaxToolIterations,
		}

		// Layer 2: config.json per-agent overrides
		if override, ok := cfg.Agents[name]; ok {
			if override.Model != "" {
				resolved.Model = override.Model
			}
			if override.MaxTokens > 0 {
				resolved.MaxTokens = override.MaxTokens
			}
			if override.Temperature > 0 {
				resolved.Temperature = override.Temperature
			}
			if len(override.Channels) > 0 {
				resolved.Channels = override.Channels
			}
		}

		// Layer 3: agent.json (highest priority)
		agentJSON := filepath.Join(workspace, "agent.json")
		if data, readErr := os.ReadFile(agentJSON); readErr == nil {
			var fileCfg AgentFileConfig
			if jsonErr := json.Unmarshal(data, &fileCfg); jsonErr == nil {
				if fileCfg.Model != "" {
					resolved.Model = fileCfg.Model
				}
				if fileCfg.MaxTokens > 0 {
					resolved.MaxTokens = fileCfg.MaxTokens
				}
				if fileCfg.Temperature > 0 {
					resolved.Temperature = fileCfg.Temperature
				}
				if fileCfg.MaxToolIterations > 0 {
					resolved.MaxToolIterations = fileCfg.MaxToolIterations
				}
				if len(fileCfg.Channels) > 0 {
					resolved.Channels = fileCfg.Channels
				}
				resolved.Skills = fileCfg.Skills
			}
		}

		agents = append(agents, resolved)
	}

	if len(agents) == 0 {
		return []ResolvedAgent{defaultAgent(cfg, homeDir)}, nil
	}

	return agents, nil
}

// LoadTeam reads a team.json file.
func LoadTeam(path string) (*TeamConfig, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	var tc TeamConfig
	if err := json.Unmarshal(data, &tc); err != nil {
		return nil, err
	}
	return &tc, nil
}

func defaultAgent(cfg *Config, homeDir string) ResolvedAgent {
	return ResolvedAgent{
		Name:              "default",
		Workspace:         filepath.Join(homeDir, "agents", "default", "agent"),
		Model:             cfg.Defaults.Model,
		MaxTokens:         cfg.Defaults.MaxTokens,
		Temperature:       cfg.Defaults.Temperature,
		MaxToolIterations: cfg.Defaults.MaxToolIterations,
	}
}
