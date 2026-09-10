package database

import (
	"database/sql"
	"errors"
	"fmt"
	"os"
	"path/filepath"

	_ "modernc.org/sqlite"
)

// DB wraps the SQLite connection used by the application.
type DB struct {
	conn *sql.DB
	path string
}

// Open creates the database directory, opens SQLite, and applies migrations.
func Open(path string) (*DB, error) {
	if path == "" {
		return nil, errors.New("database path cannot be empty")
	}

	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return nil, fmt.Errorf("create database directory: %w", err)
	}

	conn, err := sql.Open("sqlite", path)
	if err != nil {
		return nil, fmt.Errorf("open SQLite connection: %w", err)
	}

	conn.SetMaxOpenConns(1)
	conn.SetMaxIdleConns(1)
	if _, err := conn.Exec(`PRAGMA foreign_keys = ON`); err != nil {
		_ = conn.Close()
		return nil, fmt.Errorf("enable SQLite foreign keys: %w", err)
	}

	db := &DB{conn: conn, path: path}
	if err := db.migrate(); err != nil {
		_ = conn.Close()
		return nil, err
	}

	return db, nil
}

// Path returns the database file path.
func (db *DB) Path() string {
	return db.path
}

// Close closes the SQLite connection.
func (db *DB) Close() error {
	return db.conn.Close()
}

func (db *DB) migrate() error {
	const schema = `
CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS company_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    business_name TEXT NOT NULL,
    tax_id TEXT NOT NULL,
    phone TEXT,
    address TEXT,
    logo_path TEXT,
    default_vat_rate REAL NOT NULL DEFAULT 16.00,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS clients (
    id TEXT PRIMARY KEY,
    business_name TEXT NOT NULL,
    tax_id TEXT NOT NULL UNIQUE,
    phone TEXT,
    address TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS quotations (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL,
    subtotal REAL NOT NULL,
    total_vat REAL NOT NULL,
    grand_total REAL NOT NULL,
    footer_notes TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients (id)
);

CREATE TABLE IF NOT EXISTS quotation_items (
    id TEXT PRIMARY KEY,
    quotation_id TEXT NOT NULL,
    description TEXT NOT NULL,
    unit_price REAL NOT NULL,
    vat_rate REAL NOT NULL,
    subtotal REAL NOT NULL,
    FOREIGN KEY (quotation_id) REFERENCES quotations (id) ON DELETE CASCADE
);
`

	tx, err := db.conn.Begin()
	if err != nil {
		return fmt.Errorf("start database migration: %w", err)
	}
	defer func() {
		if err != nil {
			_ = tx.Rollback()
		}
	}()

	if _, err = tx.Exec(schema); err != nil {
		return fmt.Errorf("apply initial database schema: %w", err)
	}

	var applied bool
	err = tx.QueryRow(`SELECT EXISTS (SELECT 1 FROM schema_migrations WHERE version = 1)`).Scan(&applied)
	if err != nil {
		return fmt.Errorf("check initial database migration: %w", err)
	}
	if !applied {
		if _, err = tx.Exec(`INSERT INTO schema_migrations (version) VALUES (1)`); err != nil {
			return fmt.Errorf("record initial database migration: %w", err)
		}
	}

	if err = tx.Commit(); err != nil {
		return fmt.Errorf("commit database migration: %w", err)
	}
	return nil
}
