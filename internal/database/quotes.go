package database

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"math"
	"strings"
	"time"

	"github.com/google/uuid"
)

// CompanySettings contains the issuer details shown on a quotation.
type CompanySettings struct {
	BusinessName             string  `json:"businessName"`
	TaxID                    string  `json:"taxId"`
	Phone                    string  `json:"phone"`
	Address                  string  `json:"address"`
	LogoPath                 string  `json:"logoPath"`
	DefaultVATRate           float64 `json:"defaultVatRate"`
	QuotationExpirationHours int     `json:"quotationExpirationHours"`
}

// Client is a customer in the local directory.
type Client struct {
	ID           string `json:"id"`
	BusinessName string `json:"businessName"`
	TaxID        string `json:"taxId"`
	Phone        string `json:"phone"`
	Address      string `json:"address"`
	CreatedAt    string `json:"createdAt"`
}

// QuotationItem is a line in a quotation.
type QuotationItem struct {
	ID          string  `json:"id"`
	Description string  `json:"description"`
	Quantity    float64 `json:"quantity"`
	UnitPrice   float64 `json:"unitPrice"`
	VATRate     float64 `json:"vatRate"`
	ApplyVAT    bool    `json:"applyVat"`
	Subtotal    float64 `json:"subtotal"`
}

// CreateQuotationRequest is the frontend payload used to create a quotation.
type CreateQuotationRequest struct {
	ClientID    string          `json:"clientId"`
	Items       []QuotationItem `json:"items"`
	FooterNotes string          `json:"footerNotes"`
}

// Quotation contains the persisted quotation totals and its lines.
type Quotation struct {
	ID          int64           `json:"id"`
	ClientID    string          `json:"clientId"`
	Subtotal    float64         `json:"subtotal"`
	TotalVAT    float64         `json:"totalVat"`
	GrandTotal  float64         `json:"grandTotal"`
	Status      string          `json:"status"`
	FooterNotes string          `json:"footerNotes"`
	Items       []QuotationItem `json:"items"`
	CreatedAt   string          `json:"createdAt"`
}

// QuotationSummary contains the fields needed by the quotation list.
type QuotationSummary struct {
	ID         int64   `json:"id"`
	ClientID   string  `json:"clientId"`
	ClientName string  `json:"clientName"`
	Subtotal   float64 `json:"subtotal"`
	TotalVAT   float64 `json:"totalVat"`
	GrandTotal float64 `json:"grandTotal"`
	Status     string  `json:"status"`
	CreatedAt  string  `json:"createdAt"`
}

// GetSettings returns the saved company settings, or defaults when none exist.
func (db *DB) GetSettings(ctx context.Context) (CompanySettings, error) {
	var settings CompanySettings
	err := db.conn.QueryRowContext(ctx, `
		SELECT business_name, tax_id, COALESCE(phone, ''), COALESCE(address, ''),
			COALESCE(logo_path, ''), default_vat_rate, COALESCE(quotation_expiration_hours, 72)
		FROM company_settings WHERE id = 1`).Scan(
		&settings.BusinessName, &settings.TaxID, &settings.Phone, &settings.Address,
		&settings.LogoPath, &settings.DefaultVATRate, &settings.QuotationExpirationHours)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return CompanySettings{DefaultVATRate: 16, QuotationExpirationHours: 72}, nil
		}
		return CompanySettings{}, fmt.Errorf("get company settings: %w", err)
	}
	return settings, nil
}

func (db *DB) SaveSettings(ctx context.Context, settings CompanySettings) error {
	if strings.TrimSpace(settings.BusinessName) == "" || strings.TrimSpace(settings.TaxID) == "" {
		return errors.New("business name and tax ID are required")
	}
	if !validRate(settings.DefaultVATRate) || settings.DefaultVATRate > 100 {
		return errors.New("default VAT rate must be between 0 and 100")
	}
	if settings.QuotationExpirationHours < 1 {
		settings.QuotationExpirationHours = 72
	}

	_, err := db.conn.ExecContext(ctx, `
		INSERT INTO company_settings
			(id, business_name, tax_id, phone, address, logo_path, default_vat_rate, quotation_expiration_hours)
		VALUES (1, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(id) DO UPDATE SET
			business_name = excluded.business_name,
			tax_id = excluded.tax_id,
			phone = excluded.phone,
			address = excluded.address,
			logo_path = excluded.logo_path,
			default_vat_rate = excluded.default_vat_rate,
			quotation_expiration_hours = excluded.quotation_expiration_hours,
			updated_at = CURRENT_TIMESTAMP`,
		settings.BusinessName, settings.TaxID, settings.Phone, settings.Address,
		settings.LogoPath, settings.DefaultVATRate, settings.QuotationExpirationHours)
	if err != nil {
		return fmt.Errorf("save company settings: %w", err)
	}
	return nil
}

func (db *DB) CreateClient(ctx context.Context, client Client) (Client, error) {
	if err := validateClient(client); err != nil {
		return Client{}, err
	}
	client.ID = uuid.NewString()
	_, err := db.conn.ExecContext(ctx, `
		INSERT INTO clients (id, business_name, tax_id, phone, address)
		VALUES (?, ?, ?, ?, ?)`,
		client.ID, client.BusinessName, client.TaxID, client.Phone, client.Address)
	if err != nil {
		if strings.Contains(err.Error(), "UNIQUE constraint failed") {
			return Client{}, errors.New("a client with this tax ID already exists")
		}
		return Client{}, fmt.Errorf("create client: %w", err)
	}
	return client, nil
}

func (db *DB) UpdateClient(ctx context.Context, client Client) error {
	if strings.TrimSpace(client.ID) == "" {
		return errors.New("client ID is required")
	}
	if err := validateClient(client); err != nil {
		return err
	}
	result, err := db.conn.ExecContext(ctx, `
		UPDATE clients SET business_name = ?, tax_id = ?, phone = ?, address = ?
		WHERE id = ?`, client.BusinessName, client.TaxID, client.Phone, client.Address, client.ID)
	if err != nil {
		if strings.Contains(err.Error(), "UNIQUE constraint failed") {
			return errors.New("a client with this tax ID already exists")
		}
		return fmt.Errorf("update client: %w", err)
	}
	if count, err := result.RowsAffected(); err != nil {
		return fmt.Errorf("check updated client: %w", err)
	} else if count == 0 {
		return errors.New("client not found")
	}
	return nil
}

func (db *DB) DeleteClient(ctx context.Context, id string) error {
	if strings.TrimSpace(id) == "" {
		return errors.New("client ID is required")
	}
	result, err := db.conn.ExecContext(ctx, `DELETE FROM clients WHERE id = ?`, id)
	if err != nil {
		return fmt.Errorf("delete client: %w", err)
	}
	if count, err := result.RowsAffected(); err != nil {
		return fmt.Errorf("check deleted client: %w", err)
	} else if count == 0 {
		return errors.New("client not found")
	}
	return nil
}

func validateClient(client Client) error {
	if strings.TrimSpace(client.BusinessName) == "" || strings.TrimSpace(client.TaxID) == "" {
		return errors.New("business name and tax ID are required")
	}
	return nil
}

func (db *DB) GetClients(ctx context.Context) ([]Client, error) {
	rows, err := db.conn.QueryContext(ctx, `
		SELECT id, business_name, tax_id, COALESCE(phone, ''), COALESCE(address, ''), created_at
		FROM clients ORDER BY business_name, id`)
	if err != nil {
		return nil, fmt.Errorf("query clients: %w", err)
	}
	defer rows.Close()

	clients := make([]Client, 0)
	for rows.Next() {
		var client Client
		if err := rows.Scan(&client.ID, &client.BusinessName, &client.TaxID, &client.Phone, &client.Address, &client.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan client: %w", err)
		}
		clients = append(clients, client)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate clients: %w", err)
	}
	return clients, nil
}

func (db *DB) CreateQuotation(ctx context.Context, request CreateQuotationRequest) (Quotation, error) {
	if strings.TrimSpace(request.ClientID) == "" {
		return Quotation{}, errors.New("client ID is required")
	}
	if len(request.Items) == 0 {
		return Quotation{}, errors.New("at least one quotation item is required")
	}

	tx, err := db.conn.BeginTx(ctx, nil)
	if err != nil {
		return Quotation{}, fmt.Errorf("start quotation transaction: %w", err)
	}
	defer tx.Rollback()

	var exists bool
	if err := tx.QueryRowContext(ctx, `SELECT EXISTS (SELECT 1 FROM clients WHERE id = ?)`, request.ClientID).Scan(&exists); err != nil {
		return Quotation{}, fmt.Errorf("check quotation client: %w", err)
	}
	if !exists {
		return Quotation{}, errors.New("quotation client does not exist")
	}

	quotation := Quotation{
		ClientID:    request.ClientID,
		FooterNotes: request.FooterNotes,
		Items:       make([]QuotationItem, len(request.Items)),
		Status:      "pending",
	}
	for i, item := range request.Items {
		if strings.TrimSpace(item.Description) == "" {
			return Quotation{}, fmt.Errorf("quotation item %d description is required", i+1)
		}
		if item.Quantity <= 0 {
			item.Quantity = 1.0
		}
		if !validMoney(item.UnitPrice) || item.UnitPrice < 0 {
			return Quotation{}, fmt.Errorf("quotation item %d unit price is invalid", i+1)
		}
		if !validRate(item.VATRate) || item.VATRate < 0 || item.VATRate > 100 {
			return Quotation{}, fmt.Errorf("quotation item %d VAT rate is invalid", i+1)
		}
		item.ID = uuid.NewString()
		item.Subtotal = item.Quantity * item.UnitPrice
		
		lineVAT := 0.0
		if item.ApplyVAT {
			lineVAT = item.Subtotal * item.VATRate / 100
		}
		
		quotation.Items[i] = item
		quotation.Subtotal += item.Subtotal
		quotation.TotalVAT += lineVAT
	}
	quotation.GrandTotal = quotation.Subtotal + quotation.TotalVAT

	result, err := tx.ExecContext(ctx, `
		INSERT INTO quotations (client_id, subtotal, total_vat, grand_total, status, footer_notes)
		VALUES (?, ?, ?, ?, ?, ?)`,
		quotation.ClientID, quotation.Subtotal, quotation.TotalVAT,
		quotation.GrandTotal, quotation.Status, quotation.FooterNotes)
	if err != nil {
		return Quotation{}, fmt.Errorf("insert quotation: %w", err)
	}

	quotationID, err := result.LastInsertId()
	if err != nil {
		return Quotation{}, fmt.Errorf("get last insert id: %w", err)
	}
	quotation.ID = quotationID

	for _, item := range quotation.Items {
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO quotation_items
				(id, quotation_id, description, quantity, unit_price, vat_rate, apply_vat, subtotal)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
			item.ID, quotation.ID, item.Description, item.Quantity, item.UnitPrice, item.VATRate, item.ApplyVAT, item.Subtotal); err != nil {
			return Quotation{}, fmt.Errorf("insert quotation item: %w", err)
		}
	}
	if err := tx.Commit(); err != nil {
		return Quotation{}, fmt.Errorf("commit quotation: %w", err)
	}
	return quotation, nil
}

// GetQuotation returns a quotation and all of its persisted line items.
func (db *DB) GetQuotation(ctx context.Context, id int64) (Quotation, error) {
	if id <= 0 {
		return Quotation{}, errors.New("quotation ID is required")
	}
	var quotation Quotation
	err := db.conn.QueryRowContext(ctx, `
		SELECT id, client_id, subtotal, total_vat, grand_total, status, COALESCE(footer_notes, ''), created_at
		FROM quotations WHERE id = ?`, id).Scan(
		&quotation.ID, &quotation.ClientID, &quotation.Subtotal, &quotation.TotalVAT,
		&quotation.GrandTotal, &quotation.Status, &quotation.FooterNotes, &quotation.CreatedAt)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return Quotation{}, errors.New("quotation not found")
		}
		return Quotation{}, fmt.Errorf("get quotation: %w", err)
	}

	// Auto-expire pending quotations
	if quotation.Status == "pending" {
		if err := db.maybeExpireQuotation(ctx, quotation.ID, quotation.CreatedAt); err != nil {
			return Quotation{}, err
		}
		// Re-fetch status if it was updated
		if err := db.conn.QueryRowContext(ctx, `SELECT status FROM quotations WHERE id = ?`, id).Scan(&quotation.Status); err != nil {
			return Quotation{}, fmt.Errorf("refresh quotation status: %w", err)
		}
	}

	rows, err := db.conn.QueryContext(ctx, `
		SELECT id, description, quantity, unit_price, vat_rate, apply_vat, subtotal
		FROM quotation_items WHERE quotation_id = ? ORDER BY rowid`, id)
	if err != nil {
		return Quotation{}, fmt.Errorf("query quotation items: %w", err)
	}
	defer rows.Close()
	for rows.Next() {
		var item QuotationItem
		if err := rows.Scan(&item.ID, &item.Description, &item.Quantity, &item.UnitPrice, &item.VATRate, &item.ApplyVAT, &item.Subtotal); err != nil {
			return Quotation{}, fmt.Errorf("scan quotation item: %w", err)
		}
		quotation.Items = append(quotation.Items, item)
	}
	if err := rows.Err(); err != nil {
		return Quotation{}, fmt.Errorf("iterate quotation items: %w", err)
	}
	return quotation, nil
}

// GetQuotations returns quotations ordered from newest to oldest.
func (db *DB) GetQuotations(ctx context.Context) ([]QuotationSummary, error) {
	rows, err := db.conn.QueryContext(ctx, `
		SELECT q.id, q.client_id, c.business_name, q.subtotal, q.total_vat,
			q.grand_total, q.status, q.created_at
		FROM quotations q JOIN clients c ON c.id = q.client_id
		ORDER BY q.created_at DESC, q.id DESC`)
	if err != nil {
		return nil, fmt.Errorf("query quotations: %w", err)
	}
	defer rows.Close()
	quotations := make([]QuotationSummary, 0)
	for rows.Next() {
		var quotation QuotationSummary
		if err := rows.Scan(&quotation.ID, &quotation.ClientID, &quotation.ClientName,
			&quotation.Subtotal, &quotation.TotalVAT, &quotation.GrandTotal, &quotation.Status, &quotation.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan quotation: %w", err)
		}

		// Auto-expire pending quotations
		if quotation.Status == "pending" {
			if err := db.maybeExpireQuotation(ctx, quotation.ID, quotation.CreatedAt); err != nil {
				return nil, err
			}
			// Re-fetch status if it was updated
			if err := db.conn.QueryRowContext(ctx, `SELECT status FROM quotations WHERE id = ?`, quotation.ID).Scan(&quotation.Status); err != nil {
				return nil, fmt.Errorf("refresh quotation status: %w", err)
			}
		}

		quotations = append(quotations, quotation)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate quotations: %w", err)
	}
	return quotations, nil
}

func validMoney(value float64) bool {
	return !math.IsNaN(value) && !math.IsInf(value, 0)
}

func validRate(value float64) bool {
	return validMoney(value)
}

// UpdateQuotationStatus updates the status of a quotation.
func (db *DB) UpdateQuotationStatus(ctx context.Context, id int64, status string) error {
	validStatuses := map[string]bool{"pending": true, "approved": true, "rejected": true, "cancelled": true, "expired": true}
	if !validStatuses[status] {
		return errors.New("invalid quotation status")
	}
	if id <= 0 {
		return errors.New("quotation ID is required")
	}
	result, err := db.conn.ExecContext(ctx, `UPDATE quotations SET status = ? WHERE id = ?`, status, id)
	if err != nil {
		return fmt.Errorf("update quotation status: %w", err)
	}
	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("check updated quotation: %w", err)
	}
	if rowsAffected == 0 {
		return errors.New("quotation not found")
	}
	return nil
}

// maybeExpireQuotation checks if a pending quotation has expired and updates its status.
func (db *DB) maybeExpireQuotation(ctx context.Context, id int64, createdAtStr string) error {
	settings, err := db.GetSettings(ctx)
	if err != nil {
		return fmt.Errorf("load settings for expiration check: %w", err)
	}
	createdAt, err := time.Parse(time.RFC3339, createdAtStr)
	if err != nil {
		// Try alternative format
		createdAt, err = time.Parse("2006-01-02 15:04:05", createdAtStr)
		if err != nil {
			return nil // If we can't parse the date, skip expiration check
		}
	}
	expirationDuration := time.Duration(settings.QuotationExpirationHours) * time.Hour
	if time.Since(createdAt) > expirationDuration {
		if err := db.UpdateQuotationStatus(ctx, id, "expired"); err != nil {
			return fmt.Errorf("expire quotation: %w", err)
		}
	}
	return nil
}
