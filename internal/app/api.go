package app

import (
	"context"

	"x57quote/internal/database"
)

// The aliases keep the Wails-facing API and database representation identical,
// so generated TypeScript types have one stable source of truth.
type CompanySettings = database.CompanySettings
type Client = database.Client
type QuotationItem = database.QuotationItem
type CreateQuotationRequest = database.CreateQuotationRequest
type Quotation = database.Quotation

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
