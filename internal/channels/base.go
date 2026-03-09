package channels

import "context"

// Channel is the interface that all channel implementations must satisfy.
type Channel interface {
	// Name returns the channel type identifier (e.g. "telegram").
	Name() string
	// AccountID returns the account identifier within the channel.
	AccountID() string
	// Start begins listening for messages. It should block until ctx is cancelled.
	Start(ctx context.Context) error
	// Send sends a message to the specified chat.
	Send(chatID string, text string) error
}
