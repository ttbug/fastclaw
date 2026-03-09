package gateway

import (
	"context"
	"log/slog"
	"os"
	"os/signal"
	"sync"
	"syscall"

	"github.com/fastclaw-ai/fastclaw/internal/agent"
	"github.com/fastclaw-ai/fastclaw/internal/bus"
	"github.com/fastclaw-ai/fastclaw/internal/channels"
	"github.com/fastclaw-ai/fastclaw/internal/config"
	"github.com/fastclaw-ai/fastclaw/internal/provider"
)

// Gateway is the main orchestrator that starts all services.
type Gateway struct {
	config   *config.Config
	bus      *bus.MessageBus
	agents   *agent.Manager
	chanMgr  *channels.Manager
	bindings []config.Binding
}

// New creates a new Gateway with multi-agent support.
func New(cfg *config.Config) (*Gateway, error) {
	mb := bus.New()

	// Create LLM provider
	providerCfg := cfg.Providers["openai"]
	llm := provider.NewOpenAI(providerCfg.APIKey, providerCfg.APIBase)

	// Resolve agent configs
	resolved := config.ResolveAgents(cfg)

	// Create agent manager
	agentMgr, err := agent.NewManager(resolved, llm, mb)
	if err != nil {
		return nil, err
	}

	slog.Info("agents loaded", "count", len(resolved), "names", agentMgr.Names())

	// Create channel manager and register channel instances
	chanMgr := channels.NewManager(mb)

	if err := registerChannels(cfg, mb, chanMgr); err != nil {
		return nil, err
	}

	return &Gateway{
		config:   cfg,
		bus:      mb,
		agents:   agentMgr,
		chanMgr:  chanMgr,
		bindings: cfg.Bindings,
	}, nil
}

// registerChannels creates channel instances from config, one per account.
func registerChannels(cfg *config.Config, mb *bus.MessageBus, chanMgr *channels.Manager) error {
	for name, chCfg := range cfg.Channels {
		if !chCfg.Enabled {
			continue
		}

		switch name {
		case "telegram":
			if err := registerTelegramChannels(chCfg, mb, chanMgr); err != nil {
				return err
			}
		}
	}
	return nil
}

func registerTelegramChannels(chCfg config.ChannelConfig, mb *bus.MessageBus, chanMgr *channels.Manager) error {
	if len(chCfg.Accounts) == 0 {
		// No accounts defined — use the channel-level botToken as the default account
		tg, err := channels.NewTelegram(chCfg.BotToken, "", mb)
		if err != nil {
			return err
		}
		chanMgr.Register(tg)
		return nil
	}

	// One instance per account
	for accountID, acct := range chCfg.Accounts {
		token := acct.BotToken
		if token == "" {
			token = chCfg.BotToken // fall back to parent
		}
		tg, err := channels.NewTelegram(token, accountID, mb)
		if err != nil {
			return err
		}
		chanMgr.Register(tg)
	}
	return nil
}

// Run starts the gateway and blocks until shutdown signal.
func (g *Gateway) Run() error {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
	go func() {
		sig := <-sigCh
		slog.Info("received signal, shutting down", "signal", sig)
		cancel()
	}()

	var wg sync.WaitGroup

	// Start inbound message processor
	wg.Add(1)
	go func() {
		defer wg.Done()
		g.processInbound(ctx)
	}()

	// Start channel manager
	wg.Add(1)
	go func() {
		defer wg.Done()
		g.chanMgr.Start(ctx)
	}()

	slog.Info("gateway started")

	wg.Wait()
	slog.Info("gateway stopped")
	return nil
}

func (g *Gateway) processInbound(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			return
		case msg := <-g.bus.Inbound:
			ag := g.matchAgent(msg)
			if ag == nil {
				slog.Warn("no agent matched for message, dropping",
					"channel", msg.Channel,
					"account", msg.AccountID,
					"chat_id", msg.ChatID,
				)
				continue
			}

			slog.Info("routing message",
				"channel", msg.Channel,
				"account", msg.AccountID,
				"chat_id", msg.ChatID,
				"agent", ag.Name(),
			)

			go func(m bus.InboundMessage, a *agent.Agent) {
				reply := a.HandleMessage(ctx, m)
				g.bus.Outbound <- bus.OutboundMessage{
					Channel:   m.Channel,
					AccountID: m.AccountID,
					ChatID:    m.ChatID,
					Text:      reply,
				}
			}(msg, ag)
		}
	}
}

// matchAgent evaluates bindings top-to-bottom and returns the first matching agent.
// Falls back to the default agent if no bindings are defined.
func (g *Gateway) matchAgent(msg bus.InboundMessage) *agent.Agent {
	if len(g.bindings) == 0 {
		return g.agents.DefaultAgent()
	}

	for _, b := range g.bindings {
		if !matchBinding(b.Match, msg) {
			continue
		}
		ag := g.agents.AgentByID(b.AgentID)
		if ag != nil {
			return ag
		}
		slog.Warn("binding references unknown agent", "agentId", b.AgentID)
	}

	// No binding matched — fall back to default
	return g.agents.DefaultAgent()
}

func matchBinding(m config.Match, msg bus.InboundMessage) bool {
	if m.Channel != "" && m.Channel != msg.Channel {
		return false
	}
	if m.AccountID != "" && m.AccountID != msg.AccountID {
		return false
	}
	if m.Peer != nil {
		if m.Peer.Kind != "" && m.Peer.Kind != msg.PeerKind {
			return false
		}
		if m.Peer.ID != "" && m.Peer.ID != msg.ChatID {
			return false
		}
	}
	return true
}
