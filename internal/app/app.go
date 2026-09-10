package app

import (
	"fmt"
	"path/filepath"

	"x57quote/internal/database"
)

// App owns the application's shared services.
type App struct {
	db *database.DB
}

// New initializes the application data directory and database.
func New(dataDir string) (*App, error) {
	dbPath := filepath.Join(dataDir, "x57quote.db")

	db, err := database.Open(dbPath)
	if err != nil {
		return nil, fmt.Errorf("open database: %w", err)
	}

	return &App{db: db}, nil
}

// DatabasePath returns the path of the local SQLite database.
func (a *App) DatabasePath() string {
	return a.db.Path()
}

// Close releases application resources.
func (a *App) Close() error {
	return a.db.Close()
}
