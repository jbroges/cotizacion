package app

import (
	"bytes"
	"context"
	"fmt"

	"x57quote/internal/database"
	"x57quote/internal/pdf"
)

// The aliases keep the Wails-facing API and database representation identical,
// so generated TypeScript types have one stable source of truth.
type CompanySettings = database.CompanySettings
type Client = database.Client
type QuotationItem = database.QuotationItem
type CreateQuotationRequest = database.CreateQuotationRequest
type Quotation = database.Quotation
type QuotationSummary = database.QuotationSummary

// SaveSettings persists the single company settings record.
func (a *App) SaveSettings(settings CompanySettings) error {
	return a.db.SaveSettings(context.Background(), settings)
}

func (a *App) GetSettings() (CompanySettings, error) {
	return a.db.GetSettings(context.Background())
}

// GetClients returns all clients ordered by business name.
func (a *App) GetClients() ([]Client, error) {
	return a.db.GetClients(context.Background())
}

func (a *App) CreateClient(client Client) (Client, error) {
	return a.db.CreateClient(context.Background(), client)
}

func (a *App) UpdateClient(client Client) error {
	return a.db.UpdateClient(context.Background(), client)
}

func (a *App) DeleteClient(id string) error {
	return a.db.DeleteClient(context.Background(), id)
}

// CreateQuotation validates, calculates, and persists a quotation atomically.
func (a *App) CreateQuotation(request CreateQuotationRequest) (Quotation, error) {
	return a.db.CreateQuotation(context.Background(), request)
}

func (a *App) GetQuotations() ([]QuotationSummary, error) {
	return a.db.GetQuotations(context.Background())
}

func (a *App) GetQuotation(id string) (Quotation, error) {
	return a.db.GetQuotation(context.Background(), id)
}

// DownloadQuotation renders a persisted quotation as a PDF byte slice for the
// Wails frontend, leaving file selection to the native client.
func (a *App) DownloadQuotation(id string) ([]byte, error) {
	ctx := context.Background()
	quotation, err := a.db.GetQuotation(ctx, id)
	if err != nil {
		return nil, err
	}
	settings, err := a.db.GetSettings(ctx)
	if err != nil {
		return nil, fmt.Errorf("load quotation settings: %w", err)
	}
	clients, err := a.db.GetClients(ctx)
	if err != nil {
		return nil, fmt.Errorf("load quotation client: %w", err)
	}
	var client database.Client
	for _, candidate := range clients {
		if candidate.ID == quotation.ClientID {
			client = candidate
			break
		}
	}
	if client.ID == "" {
		return nil, fmt.Errorf("quotation client not found")
	}

	document := pdf.Document{
		Number: quotation.ID, Issuer: pdf.Issuer{
			BusinessName: settings.BusinessName, TaxID: settings.TaxID,
			Phone: settings.Phone, Address: settings.Address, LogoPath: settings.LogoPath,
		},
		Client: pdf.Client{
			BusinessName: client.BusinessName, TaxID: client.TaxID,
			Phone: client.Phone, Address: client.Address,
		},
		Subtotal: quotation.Subtotal, TotalVAT: quotation.TotalVAT,
		GrandTotal: quotation.GrandTotal, FooterNotes: quotation.FooterNotes,
	}
	document.Items = make([]pdf.Item, len(quotation.Items))
	for i, item := range quotation.Items {
		document.Items[i] = pdf.Item{
			Description: item.Description, UnitPrice: item.UnitPrice,
			VATRate: item.VATRate, Subtotal: item.Subtotal,
		}
	}
	var output bytes.Buffer
	if err := pdf.Generate(&output, document); err != nil {
		return nil, err
	}
	return output.Bytes(), nil
}
