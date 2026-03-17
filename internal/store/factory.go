package store

import (
	"context"
	"fmt"
	"log/slog"
)

// New creates a Store based on the storage config.
// If cfg is nil or type is empty/"file", returns a FileStore.
func New(cfg *StorageConfig, homeDir string) (Store, error) {
	if cfg == nil || cfg.Type == "" || cfg.Type == StorageFile {
		slog.Info("using file-based storage", "dir", homeDir)
		return NewFileStore(homeDir), nil
	}

	switch cfg.Type {
	case StoragePostgres, StorageSQLite:
		slog.Info("using database storage", "dialect", cfg.Type, "dsn", maskDSN(cfg.DSN))
		db, err := NewDBStore(string(cfg.Type), cfg.DSN)
		if err != nil {
			return nil, fmt.Errorf("open database: %w", err)
		}
		if cfg.AutoMigrate {
			slog.Info("running database migrations")
			if err := db.Migrate(context.Background()); err != nil {
				db.Close()
				return nil, fmt.Errorf("migrate: %w", err)
			}
		}
		return db, nil

	default:
		return nil, fmt.Errorf("unsupported storage type: %s", cfg.Type)
	}
}

// maskDSN masks passwords in DSN strings for logging.
func maskDSN(dsn string) string {
	if len(dsn) > 20 {
		return dsn[:10] + "***" + dsn[len(dsn)-5:]
	}
	return "***"
}
