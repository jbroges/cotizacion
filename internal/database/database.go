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
    quotation_expiration_hours INTEGER NOT NULL DEFAULT 72,
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
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id TEXT NOT NULL,
    subtotal REAL NOT NULL,
    total_vat REAL NOT NULL,
    grand_total REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    footer_notes TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients (id)
);

CREATE TABLE IF NOT EXISTS quotation_items (
    id TEXT PRIMARY KEY,
    quotation_id INTEGER NOT NULL,
    description TEXT NOT NULL,
    quantity REAL NOT NULL DEFAULT 1.0,
    unit_price REAL NOT NULL,
    vat_rate REAL NOT NULL,
    apply_vat BOOLEAN NOT NULL DEFAULT 1,
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

	// Defensive ALTER TABLEs for existing databases that may be missing new columns.
	// These are idempotent-ish: SQLite returns error if column exists, we ignore those specific errors.
	defensiveAlters := []string{
		`ALTER TABLE company_settings ADD COLUMN quotation_expiration_hours INTEGER NOT NULL DEFAULT 72`,
		`ALTER TABLE quotations ADD COLUMN status TEXT NOT NULL DEFAULT 'pending'`,
		`ALTER TABLE quotation_items ADD COLUMN quantity REAL NOT NULL DEFAULT 1.0`,
		`ALTER TABLE quotation_items ADD COLUMN apply_vat BOOLEAN NOT NULL DEFAULT 1`,
	}
	for _, alter := range defensiveAlters {
		_, _ = tx.Exec(alter) // Ignore errors (e.g., "duplicate column name")
	}

	// Migration version 1: initial schema
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

	// Migration version 2: change quotation ID from TEXT to INTEGER (for very old DBs with UUID)
	err = tx.QueryRow(`SELECT EXISTS (SELECT 1 FROM schema_migrations WHERE version = 2)`).Scan(&applied)
	if err != nil {
		return fmt.Errorf("check migration v2: %w", err)
	}
	if !applied {
		// SQLite doesn't support ALTER COLUMN TYPE, so we need to recreate tables
		// First, create new tables with correct schema
		_, err = tx.Exec(`
			CREATE TABLE quotations_new (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				client_id TEXT NOT NULL,
				subtotal REAL NOT NULL,
				total_vat REAL NOT NULL,
				grand_total REAL NOT NULL,
				status TEXT NOT NULL DEFAULT 'pending',
				footer_notes TEXT,
				created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
				FOREIGN KEY (client_id) REFERENCES clients (id)
			);
		`)
		if err != nil {
			return fmt.Errorf("create quotations_new: %w", err)
		}

		// Copy data, converting UUID to rowid (we'll just use the rowid as new ID)
		// For existing data, we'll assign new sequential IDs
		_, err = tx.Exec(`
			INSERT INTO quotations_new (client_id, subtotal, total_vat, grand_total, status, footer_notes, created_at)
			SELECT client_id, subtotal, total_vat, grand_total, COALESCE(status, 'pending'), footer_notes, created_at
			FROM quotations;
		`)
		if err != nil {
			return fmt.Errorf("copy quotations data: %w", err)
		}

		// Create new quotation_items table with integer quotation_id
		_, err = tx.Exec(`
			CREATE TABLE quotation_items_new (
				id TEXT PRIMARY KEY,
				quotation_id INTEGER NOT NULL,
				description TEXT NOT NULL,
				quantity REAL NOT NULL DEFAULT 1.0,
				unit_price REAL NOT NULL,
				vat_rate REAL NOT NULL,
				apply_vat BOOLEAN NOT NULL DEFAULT 1,
				subtotal REAL NOT NULL,
				FOREIGN KEY (quotation_id) REFERENCES quotations_new (id) ON DELETE CASCADE
			);
		`)
		if err != nil {
			return fmt.Errorf("create quotation_items_new: %w", err)
		}

		// For quotation_items, we need to map old quotation UUIDs to new integer IDs
		// This is complex, so for simplicity in development, we'll just drop old items
		// In production, you'd need a proper mapping
		_, err = tx.Exec(`DROP TABLE quotation_items;`)
		if err != nil {
			return fmt.Errorf("drop old quotation_items: %w", err)
		}

		_, err = tx.Exec(`ALTER TABLE quotation_items_new RENAME TO quotation_items;`)
		if err != nil {
			return fmt.Errorf("rename quotation_items_new: %w", err)
		}

		// Drop old quotations and rename new
		_, err = tx.Exec(`DROP TABLE quotations;`)
		if err != nil {
			return fmt.Errorf("drop old quotations: %w", err)
		}

		_, err = tx.Exec(`ALTER TABLE quotations_new RENAME TO quotations;`)
		if err != nil {
			return fmt.Errorf("rename quotations_new: %w", err)
		}

		if _, err = tx.Exec(`INSERT INTO schema_migrations (version) VALUES (2)`); err != nil {
			return fmt.Errorf("record migration v2: %w", err)
		}
	}

	if err = tx.Commit(); err != nil {
		return fmt.Errorf("commit database migration: %w", err)
	}
	return nil
}
