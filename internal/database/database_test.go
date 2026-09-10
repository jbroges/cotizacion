package database

import (
	"path/filepath"
	"testing"
)

func TestOpenCreatesSchemaAndEnablesForeignKeys(t *testing.T) {
	db, err := Open(filepath.Join(t.TempDir(), "x57quote.db"))
	if err != nil {
		t.Fatalf("Open() error = %v", err)
	}
	defer db.Close()

	var foreignKeys int
	if err := db.conn.QueryRow(`PRAGMA foreign_keys`).Scan(&foreignKeys); err != nil {
		t.Fatalf("query foreign_keys: %v", err)
	}
	if foreignKeys != 1 {
		t.Fatalf("foreign_keys = %d, want 1", foreignKeys)
	}

	var tableCount int
	if err := db.conn.QueryRow(`
		SELECT COUNT(*)
		FROM sqlite_master
		WHERE type = 'table' AND name IN (
			'company_settings', 'clients', 'quotations', 'quotation_items'
		)
	`).Scan(&tableCount); err != nil {
		t.Fatalf("query schema: %v", err)
	}
	if tableCount != 4 {
		t.Fatalf("application table count = %d, want 4", tableCount)
	}

	var migrationCount int
	if err := db.conn.QueryRow(`SELECT COUNT(*) FROM schema_migrations WHERE version = 1`).Scan(&migrationCount); err != nil {
		t.Fatalf("query migrations: %v", err)
	}
	if migrationCount != 1 {
		t.Fatalf("initial migration count = %d, want 1", migrationCount)
	}
}

func TestOpenIsIdempotentAndCascadesQuotationItems(t *testing.T) {
	path := filepath.Join(t.TempDir(), "x57quote.db")
	db, err := Open(path)
	if err != nil {
		t.Fatalf("first Open() error = %v", err)
	}
	if err := db.Close(); err != nil {
		t.Fatalf("first Close() error = %v", err)
	}

	db, err = Open(path)
	if err != nil {
		t.Fatalf("second Open() error = %v", err)
	}
	defer db.Close()

	if _, err := db.conn.Exec(`
		INSERT INTO clients (id, business_name, tax_id) VALUES ('client-1', 'Client', 'J-1');
		INSERT INTO quotations (id, client_id, subtotal, total_vat, grand_total)
			VALUES ('quote-1', 'client-1', 10, 1.6, 11.6);
		INSERT INTO quotation_items
			(id, quotation_id, description, unit_price, vat_rate, subtotal)
			VALUES ('item-1', 'quote-1', 'Item', 10, 16, 10);
		DELETE FROM quotations WHERE id = 'quote-1';
	`); err != nil {
		t.Fatalf("exercise schema: %v", err)
	}

	var itemCount int
	if err := db.conn.QueryRow(`SELECT COUNT(*) FROM quotation_items`).Scan(&itemCount); err != nil {
		t.Fatalf("query quotation items: %v", err)
	}
	if itemCount != 0 {
		t.Fatalf("quotation item count = %d, want 0 after cascade", itemCount)
	}
}
