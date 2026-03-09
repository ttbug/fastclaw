package agent

import (
	"fmt"
	"log/slog"

	"github.com/fastclaw-ai/fastclaw/internal/bus"
	"github.com/fastclaw-ai/fastclaw/internal/config"
	"github.com/fastclaw-ai/fastclaw/internal/provider"
)

// Manager loads and manages all agent instances.
type Manager struct {
	agents       map[string]*Agent
	channelMap   map[string]*Agent // channel name -> agent
	defaultAgent *Agent
}

// NewManager creates agents from resolved configs.
func NewManager(cfg *config.Config, resolved []config.ResolvedAgent, prov provider.Provider, mb *bus.MessageBus) (*Manager, error) {
	m := &Manager{
		agents:     make(map[string]*Agent),
		channelMap: make(map[string]*Agent),
	}

	homeDir, err := config.HomeDir()
	if err != nil {
		return nil, fmt.Errorf("get home dir: %w", err)
	}

	for _, rc := range resolved {
		ag := NewAgent(rc, prov, mb, homeDir)
		m.agents[rc.Name] = ag

		slog.Info("loaded agent",
			"name", rc.Name,
			"model", rc.Model,
			"workspace", rc.Workspace,
			"channels", rc.Channels,
		)

		// Build channel -> agent mapping
		for _, ch := range rc.Channels {
			if existing, ok := m.channelMap[ch]; ok {
				slog.Warn("channel already bound to agent, overriding",
					"channel", ch,
					"previous", existing.name,
					"new", rc.Name,
				)
			}
			m.channelMap[ch] = ag
		}
	}

	// If only one agent, make it the default for all channels
	if len(m.agents) == 1 {
		for _, ag := range m.agents {
			m.defaultAgent = ag
		}
	}

	return m, nil
}

// AgentForChannel returns the agent that handles messages from the given channel.
func (m *Manager) AgentForChannel(channel string) *Agent {
	if ag, ok := m.channelMap[channel]; ok {
		return ag
	}
	return m.defaultAgent
}

// Get returns an agent by name.
func (m *Manager) Get(name string) *Agent {
	return m.agents[name]
}

// All returns all loaded agents.
func (m *Manager) All() []*Agent {
	result := make([]*Agent, 0, len(m.agents))
	for _, ag := range m.agents {
		result = append(result, ag)
	}
	return result
}

// Names returns all agent names.
func (m *Manager) Names() []string {
	names := make([]string, 0, len(m.agents))
	for name := range m.agents {
		names = append(names, name)
	}
	return names
}
