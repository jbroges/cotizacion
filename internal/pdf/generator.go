package pdf

import (
	"errors"
	"fmt"
	"io"
	"math"
	"os"
	"strings"

	"github.com/go-pdf/fpdf"
)

const (
	pageWidth   = 210.0
	margin      = 18.0
	brandBlue   = 42
	headerColor = 72
)

// Document contains all data needed to render a quotation without coupling the
// PDF engine to the database or Wails bindings.
type Document struct {
	Number      string
	Issuer      Issuer
	Client      Client
	Items       []Item
	Subtotal    float64
	TotalVAT    float64
	GrandTotal  float64
	FooterNotes string
}

type Issuer struct {
	BusinessName string
	TaxID        string
	Phone        string
	Address      string
	LogoPath     string
}

type Client struct {
	BusinessName string
	TaxID        string
	Phone        string
	Address      string
}

type Item struct {
	Description string
	UnitPrice   float64
	VATRate     float64
	Subtotal    float64
}

// Generate writes a vector PDF to w. It does not retain document data after
// returning, making it suitable for both files and Wails download streams.
func Generate(w io.Writer, document Document) error {
	if w == nil {
		return errors.New("PDF output writer cannot be nil")
	}
	if err := validate(document); err != nil {
		return err
	}

	pdf := fpdf.New("P", "mm", "A4", "")
	pdf.SetTitle("Quotation "+document.Number, true)
	pdf.SetAuthor(document.Issuer.BusinessName, true)
	pdf.SetMargins(margin, 16, margin)
	pdf.SetAutoPageBreak(true, 18)
	pdf.SetHeaderFunc(func() {})
	pdf.SetFooterFunc(func() {
		pdf.SetY(-13)
		pdf.SetFont("Helvetica", "", 8)
		pdf.SetTextColor(130, 130, 130)
		pdf.CellFormat(0, 5, fmt.Sprintf("Quotation %s", document.Number), "", 0, "C", false, 0, "")
	})
	pdf.AddPage()

	if document.Issuer.LogoPath != "" {
		if err := addLogo(pdf, document.Issuer.LogoPath); err != nil {
			return err
		}
	}
	drawHeader(pdf, document)
	drawClient(pdf, document.Client)
	drawItems(pdf, document.Items)
	drawTotals(pdf, document)
	if strings.TrimSpace(document.FooterNotes) != "" {
		drawNotes(pdf, document.FooterNotes)
	}

	if err := pdf.Error(); err != nil {
		return fmt.Errorf("render quotation PDF: %w", err)
	}
	if err := pdf.Output(w); err != nil {
		return fmt.Errorf("write quotation PDF: %w", err)
	}
	return nil
}

func validate(document Document) error {
	if strings.TrimSpace(document.Number) == "" {
		return errors.New("quotation number is required")
	}
	if strings.TrimSpace(document.Issuer.BusinessName) == "" {
		return errors.New("issuer business name is required")
	}
	if strings.TrimSpace(document.Client.BusinessName) == "" {
		return errors.New("client business name is required")
	}
	if len(document.Items) == 0 {
		return errors.New("at least one quotation item is required")
	}
	for name, value := range map[string]float64{
		"subtotal": document.Subtotal, "total VAT": document.TotalVAT, "grand total": document.GrandTotal,
	} {
		if !finite(value) || value < 0 {
			return fmt.Errorf("%s is invalid", name)
		}
	}
	for index, item := range document.Items {
		if strings.TrimSpace(item.Description) == "" {
			return fmt.Errorf("quotation item %d description is required", index+1)
		}
		if !finite(item.UnitPrice) || !finite(item.Subtotal) || !finite(item.VATRate) ||
			item.UnitPrice < 0 || item.Subtotal < 0 || item.VATRate < 0 || item.VATRate > 100 {
			return fmt.Errorf("quotation item %d contains invalid amounts", index+1)
		}
	}
	return nil
}

func finite(value float64) bool {
	return !math.IsNaN(value) && !math.IsInf(value, 0)
}

func addLogo(pdf *fpdf.Fpdf, path string) error {
	info, err := os.Stat(path)
	if err != nil {
		return fmt.Errorf("stat company logo: %w", err)
	}
	if info.IsDir() {
		return errors.New("company logo path is a directory")
	}
	pdf.ImageOptions(path, margin, 17, 30, 0, false, fpdf.ImageOptions{}, 0, "")
	if err := pdf.Error(); err != nil {
		return fmt.Errorf("add company logo: %w", err)
	}
	return nil
}

func drawHeader(pdf *fpdf.Fpdf, document Document) {
	pdf.SetY(17)
	pdf.SetX(50)
	pdf.SetFont("Helvetica", "B", 16)
	pdf.SetTextColor(brandBlue, brandBlue, brandBlue)
	pdf.CellFormat(0, 8, strings.TrimSpace(document.Issuer.BusinessName), "", 1, "R", false, 0, "")

	pdf.SetFont("Helvetica", "", 9)
	pdf.SetTextColor(75, 75, 75)
	issuerDetails := compactLines(document.Issuer.TaxID, document.Issuer.Phone, document.Issuer.Address)
	for _, line := range issuerDetails {
		pdf.SetX(50)
		pdf.CellFormat(0, 4.5, line, "", 1, "R", false, 0, "")
	}

	pdf.SetY(43)
	pdf.SetFont("Helvetica", "B", 22)
	pdf.SetTextColor(brandBlue, brandBlue, brandBlue)
	pdf.CellFormat(0, 10, "QUOTATION", "", 1, "L", false, 0, "")
	pdf.SetFont("Helvetica", "", 9)
	pdf.SetTextColor(95, 95, 95)
	pdf.CellFormat(0, 5, "No. "+document.Number, "", 1, "L", false, 0, "")
	pdf.SetDrawColor(brandBlue, brandBlue, brandBlue)
	pdf.SetLineWidth(0.5)
	pdf.Line(margin, 62, pageWidth-margin, 62)
}

func drawClient(pdf *fpdf.Fpdf, client Client) {
	pdf.SetY(70)
	pdf.SetFillColor(245, 247, 250)
	pdf.RoundedRect(margin, 68, pageWidth-2*margin, 27, 2, "1234", "F")
	pdf.SetXY(margin+5, 72)
	pdf.SetFont("Helvetica", "B", 9)
	pdf.SetTextColor(headerColor, headerColor, headerColor)
	pdf.CellFormat(0, 5, "BILL TO", "", 1, "L", false, 0, "")
	pdf.SetX(margin + 5)
	pdf.SetFont("Helvetica", "B", 10)
	pdf.CellFormat(0, 5, client.BusinessName, "", 1, "L", false, 0, "")
	pdf.SetX(margin + 5)
	pdf.SetFont("Helvetica", "", 8.5)
	pdf.SetTextColor(85, 85, 85)
	pdf.CellFormat(0, 4, strings.Join(compactLines(client.TaxID, client.Phone, client.Address), "  ·  "), "", 1, "L", false, 0, "")
}

func drawItems(pdf *fpdf.Fpdf, items []Item) {
	pdf.SetY(104)
	drawTableHeader(pdf)
	for _, item := range items {
		if pdf.GetY() > 265 {
			pdf.AddPage()
			drawTableHeader(pdf)
		}
		pdf.SetFont("Helvetica", "", 9)
		pdf.SetTextColor(45, 45, 45)
		pdf.CellFormat(91, 8, item.Description, "B", 0, "L", false, 0, "")
		pdf.CellFormat(25, 8, money(item.UnitPrice), "B", 0, "R", false, 0, "")
		pdf.CellFormat(18, 8, percent(item.VATRate), "B", 0, "R", false, 0, "")
		pdf.CellFormat(40, 8, money(item.Subtotal), "B", 1, "R", false, 0, "")
	}
}

func drawTableHeader(pdf *fpdf.Fpdf) {
	pdf.SetFillColor(headerColor, headerColor, headerColor)
	pdf.SetTextColor(255, 255, 255)
	pdf.SetFont("Helvetica", "B", 8.5)
	pdf.CellFormat(91, 8, "DESCRIPTION", "", 0, "L", true, 0, "")
	pdf.CellFormat(25, 8, "UNIT PRICE", "", 0, "R", true, 0, "")
	pdf.CellFormat(18, 8, "VAT", "", 0, "R", true, 0, "")
	pdf.CellFormat(40, 8, "SUBTOTAL", "", 1, "R", true, 0, "")
}

func drawTotals(pdf *fpdf.Fpdf, document Document) {
	pdf.Ln(8)
	x := 118.0
	pdf.SetX(x)
	pdf.SetFont("Helvetica", "", 9)
	pdf.SetTextColor(80, 80, 80)
	pdf.CellFormat(40, 6, "Subtotal", "", 0, "L", false, 0, "")
	pdf.CellFormat(34, 6, money(document.Subtotal), "", 1, "R", false, 0, "")
	pdf.SetX(x)
	pdf.CellFormat(40, 6, "Total VAT", "", 0, "L", false, 0, "")
	pdf.CellFormat(34, 6, money(document.TotalVAT), "", 1, "R", false, 0, "")
	pdf.SetDrawColor(brandBlue, brandBlue, brandBlue)
	pdf.Line(x, pdf.GetY()+1, pageWidth-margin, pdf.GetY()+1)
	pdf.SetX(x)
	pdf.SetFont("Helvetica", "B", 12)
	pdf.SetTextColor(brandBlue, brandBlue, brandBlue)
	pdf.CellFormat(40, 9, "GRAND TOTAL", "", 0, "L", false, 0, "")
	pdf.CellFormat(34, 9, money(document.GrandTotal), "", 1, "R", false, 0, "")
}

func drawNotes(pdf *fpdf.Fpdf, notes string) {
	pdf.Ln(5)
	pdf.SetFont("Helvetica", "B", 9)
	pdf.SetTextColor(headerColor, headerColor, headerColor)
	pdf.CellFormat(0, 5, "NOTES", "", 1, "L", false, 0, "")
	pdf.SetFont("Helvetica", "", 8.5)
	pdf.SetTextColor(90, 90, 90)
	pdf.MultiCell(0, 4.5, notes, "", "L", false)
}

func compactLines(values ...string) []string {
	lines := make([]string, 0, len(values))
	for _, value := range values {
		if value = strings.TrimSpace(value); value != "" {
			lines = append(lines, value)
		}
	}
	return lines
}
