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
	config  *config.Config
	bus     *bus.MessageBus
	agents  *agent.Manager
	chanMgr *channels.Manager
}

// New creates a new Gateway with multi-agent support.
func New(cfg *config.Config) (*Gateway, error) {
	mb := bus.New()

	// Create LLM provider
	providerCfg := cfg.Providers["openai"]
	llm := provider.NewOpenAI(providerCfg.APIKey, providerCfg.APIBase)

	// Resolve agent configs from directory structure + config layers
	resolved, err := config.ResolveAgents(cfg)
	if err != nil {
		return nil, err
	}

	// Create agent manager
	agentMgr, err := agent.NewManager(cfg, resolved, llm, mb)
	if err != nil {
		return nil, err
	}

	slog.Info("agents loaded", "count", len(resolved), "names", agentMgr.Names())

	// Create channel manager
	chanMgr := channels.NewManager(mb)

	// Register Telegram channel if enabled
	if cfg.Channels.Telegram.Enabled {
		tg, err := channels.NewTelegram(cfg.Channels.Telegram.BotToken, mb)
		if err != nil {
			return nil, err
		}
		chanMgr.Register(tg)
	}

	return &Gateway{
		config:  cfg,
		bus:     mb,
		agents:  agentMgr,
		chanMgr: chanMgr,
	}, nil
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
			// Route to the agent that handles this channel
			ag := g.agents.AgentForChannel(msg.Channel)
			if ag == nil {
				slog.Warn("no agent for channel, dropping message", "channel", msg.Channel)
				continue
			}

			slog.Info("routing message",
				"channel", msg.Channel,
				"chat_id", msg.ChatID,
				"agent", ag.Name(),
			)

			go func(m bus.InboundMessage, a *agent.Agent) {
				reply := a.HandleMessage(ctx, m)
				g.bus.Outbound <- bus.OutboundMessage{
					Channel: m.Channel,
					ChatID:  m.ChatID,
					Text:    reply,
				}
			}(msg, ag)
		}
	}
}
