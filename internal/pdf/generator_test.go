package pdf

import (
	"bytes"
	"testing"
)

func testDocument() Document {
	return Document{
		Number:   "COT-0001",
		Issuer:   Issuer{BusinessName: "Acme Services", TaxID: "J-123"},
		Client:   Client{BusinessName: "Client LLC", TaxID: "J-456"},
		Items:    []Item{{Description: "Consulting", UnitPrice: 100, VATRate: 16, Subtotal: 100}},
		Subtotal: 100, TotalVAT: 16, GrandTotal: 116,
	}
}

func TestGenerateProducesVectorPDF(t *testing.T) {
	var output bytes.Buffer
	if err := Generate(&output, testDocument()); err != nil {
		t.Fatalf("Generate() error = %v", err)
	}
	if !bytes.HasPrefix(output.Bytes(), []byte("%PDF-")) {
		t.Fatalf("output does not have a PDF header")
	}
	if output.Len() < 500 {
		t.Fatalf("output is unexpectedly small: %d bytes", output.Len())
	}
}

func TestGenerateValidatesRequiredData(t *testing.T) {
	document := testDocument()
	document.Items = nil
	if err := Generate(&bytes.Buffer{}, document); err == nil {
		t.Fatal("Generate() error = nil, want validation error")
	}
}

func TestGenerateWithBase64Logo(t *testing.T) {
	document := testDocument()
	// 1x1 transparent PNG data URL
	document.Issuer.LogoPath = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
	var output bytes.Buffer
	if err := Generate(&output, document); err != nil {
		t.Fatalf("Generate() with base64 logo error = %v", err)
	}
	if !bytes.HasPrefix(output.Bytes(), []byte("%PDF-")) {
		t.Fatalf("output does not have a PDF header")
	}
}
