package database

import (
	"context"
	"path/filepath"
	"testing"
)

func TestQuotationBindingsPersistCalculatedTotals(t *testing.T) {
	db, err := Open(filepath.Join(t.TempDir(), "quotes.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	if _, err := db.conn.Exec(`INSERT INTO clients (id, business_name, tax_id) VALUES ('client-1', 'Acme', 'J-1')`); err != nil {
		t.Fatal(err)
	}

	quotation, err := db.CreateQuotation(context.Background(), CreateQuotationRequest{
		ClientID: "client-1",
		Items:    []QuotationItem{{Description: "Service", UnitPrice: 100, VATRate: 16}},
	})
	if err != nil {
		t.Fatal(err)
	}
	if quotation.Subtotal != 100 || quotation.TotalVAT != 16 || quotation.GrandTotal != 116 {
		t.Fatalf("unexpected totals: %#v", quotation)
	}

	clients, err := db.GetClients(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if len(clients) != 1 || clients[0].BusinessName != "Acme" {
		t.Fatalf("unexpected clients: %#v", clients)
	}
}
