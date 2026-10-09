package pdf

import (
	"bytes"
	"encoding/base64"
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
	tr := pdf.UnicodeTranslatorFromDescriptor("")
	pdf.SetTitle(tr("Cotización "+document.Number), true)
	pdf.SetAuthor(tr(document.Issuer.BusinessName), true)
	pdf.SetMargins(margin, 16, margin)
	pdf.SetAutoPageBreak(true, 18)
	pdf.SetHeaderFunc(func() {})
	pdf.SetFooterFunc(func() {
		pdf.SetY(-13)
		pdf.SetFont("Helvetica", "", 8)
		pdf.SetTextColor(130, 130, 130)
		pdf.CellFormat(0, 5, fmt.Sprintf(tr("Cotización %s"), document.Number), "", 0, "C", false, 0, "")
	})
	pdf.AddPage()

	var logoBottom float64 = 16.0
	if document.Issuer.LogoPath != "" {
		bottom, err := addLogo(pdf, document.Issuer.LogoPath)
		if err != nil {
			return err
		}
		logoBottom = bottom
	}
	nextY := drawHeader(pdf, document, logoBottom)
	clientBottom := drawClient(pdf, document.Client, nextY)
	drawItems(pdf, document.Items, clientBottom)
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

func addLogo(pdf *fpdf.Fpdf, path string) (float64, error) {
	const logoX = margin
	const logoY = 16.0
	const maxW = 38.0
	const maxH = 26.0

	var info *fpdf.ImageInfoType
	var imageName string

	if strings.HasPrefix(path, "data:") {
		commaIdx := strings.Index(path, ",")
		if commaIdx == -1 {
			return 0, errors.New("invalid logo data URL format")
		}
		header := path[:commaIdx]
		base64Data := path[commaIdx+1:]

		var imageType string
		if strings.Contains(header, "image/png") {
			imageType = "PNG"
		} else if strings.Contains(header, "image/jpeg") || strings.Contains(header, "image/jpg") {
			imageType = "JPG"
		} else if strings.Contains(header, "image/gif") {
			imageType = "GIF"
		} else {
			return 0, errors.New("unsupported logo image format (must be PNG, JPG, or GIF)")
		}

		decoded, err := base64.StdEncoding.DecodeString(base64Data)
		if err != nil {
			return 0, fmt.Errorf("decode logo base64: %w", err)
		}

		reader := bytes.NewReader(decoded)
		imageName = "logo_embedded"
		info = pdf.RegisterImageOptionsReader(imageName, fpdf.ImageOptions{ImageType: imageType}, reader)
		if info == nil || pdf.Error() != nil {
			return 0, fmt.Errorf("register logo image: %w", pdf.Error())
		}
	} else {
		fileInfo, err := os.Stat(path)
		if err != nil {
			return 0, fmt.Errorf("stat company logo: %w", err)
		}
		if fileInfo.IsDir() {
			return 0, errors.New("company logo path is a directory")
		}
		imageName = path
		info = pdf.RegisterImageOptions(imageName, fpdf.ImageOptions{})
		if info == nil || pdf.Error() != nil {
			return 0, fmt.Errorf("register logo image file: %w", pdf.Error())
		}
	}

	w := maxW
	h := maxH
	origW, origH := info.Extent()
	if origW > 0 && origH > 0 {
		aspect := origW / origH
		if aspect >= (maxW / maxH) {
			w = maxW
			h = w / aspect
		} else {
			h = maxH
			w = h * aspect
		}
	}

	pdf.ImageOptions(imageName, logoX, logoY, w, h, false, fpdf.ImageOptions{}, 0, "")
	if err := pdf.Error(); err != nil {
		return 0, fmt.Errorf("add company logo: %w", err)
	}

	return logoY + h, nil
}

func drawHeader(pdf *fpdf.Fpdf, document Document, logoBottom float64) float64 {
	tr := pdf.UnicodeTranslatorFromDescriptor("")
	pdf.SetY(16)
	pdf.SetX(60)
	pdf.SetFont("Helvetica", "B", 14)
	pdf.SetTextColor(brandBlue, brandBlue, brandBlue)
	pdf.CellFormat(0, 6.5, tr(strings.TrimSpace(document.Issuer.BusinessName)), "", 1, "R", false, 0, "")

	pdf.SetFont("Helvetica", "", 8.5)
	pdf.SetTextColor(75, 75, 75)
	issuerDetails := compactLines(document.Issuer.TaxID, document.Issuer.Phone, document.Issuer.Address)
	for _, line := range issuerDetails {
		pdf.SetX(60)
		pdf.CellFormat(0, 4.2, tr(line), "", 1, "R", false, 0, "")
	}
	companyBottom := pdf.GetY()

	headerBottom := logoBottom
	if companyBottom > headerBottom {
		headerBottom = companyBottom
	}

	startY := headerBottom + 6.0
	pdf.SetY(startY)
	pdf.SetFont("Helvetica", "B", 18)
	pdf.SetTextColor(brandBlue, brandBlue, brandBlue)
	pdf.CellFormat(0, 8.5, tr("COTIZACIÓN"), "", 1, "L", false, 0, "")

	pdf.SetFont("Helvetica", "", 8.5)
	pdf.SetTextColor(95, 95, 95)
	pdf.CellFormat(0, 5, fmt.Sprintf(tr("Nº %s"), document.Number), "", 1, "L", false, 0, "")

	lineY := pdf.GetY() + 3.0
	pdf.SetDrawColor(brandBlue, brandBlue, brandBlue)
	pdf.SetLineWidth(0.4)
	pdf.Line(margin, lineY, pageWidth-margin, lineY)

	return lineY + 5.0
}

func drawClient(pdf *fpdf.Fpdf, client Client, startY float64) float64 {
	tr := pdf.UnicodeTranslatorFromDescriptor("")
	boxHeight := 25.0
	pdf.SetFillColor(245, 247, 250)
	pdf.RoundedRect(margin, startY, pageWidth-2*margin, boxHeight, 2, "1234", "F")
	pdf.SetXY(margin+5, startY+3.5)
	pdf.SetFont("Helvetica", "B", 8)
	pdf.SetTextColor(headerColor, headerColor, headerColor)
	pdf.CellFormat(0, 4.5, tr("FACTURAR A"), "", 1, "L", false, 0, "")
	pdf.SetX(margin + 5)
	pdf.SetFont("Helvetica", "B", 9.5)
	pdf.SetTextColor(30, 30, 30)
	pdf.CellFormat(0, 5, tr(client.BusinessName), "", 1, "L", false, 0, "")
	pdf.SetX(margin + 5)
	pdf.SetFont("Helvetica", "", 8)
	pdf.SetTextColor(85, 85, 85)
	pdf.CellFormat(0, 4, tr(strings.Join(compactLines(client.TaxID, client.Phone, client.Address), "  ·  ")), "", 1, "L", false, 0, "")

	return startY + boxHeight
}

func drawItems(pdf *fpdf.Fpdf, items []Item, startY float64) {
	tr := pdf.UnicodeTranslatorFromDescriptor("")
	pdf.SetY(startY + 6.0)
	drawTableHeader(pdf)
	for _, item := range items {
		if pdf.GetY() > 265 {
			pdf.AddPage()
			drawTableHeader(pdf)
		}
		pdf.SetFont("Helvetica", "", 9)
		pdf.SetTextColor(45, 45, 45)
		pdf.CellFormat(91, 8, tr(item.Description), "B", 0, "L", false, 0, "")
		pdf.CellFormat(25, 8, money(item.UnitPrice), "B", 0, "R", false, 0, "")
		pdf.CellFormat(18, 8, percent(item.VATRate), "B", 0, "R", false, 0, "")
		pdf.CellFormat(40, 8, money(item.Subtotal), "B", 1, "R", false, 0, "")
	}
}

func drawTableHeader(pdf *fpdf.Fpdf) {
	tr := pdf.UnicodeTranslatorFromDescriptor("")
	pdf.SetFillColor(headerColor, headerColor, headerColor)
	pdf.SetTextColor(255, 255, 255)
	pdf.SetFont("Helvetica", "B", 8.5)
	pdf.CellFormat(91, 8, tr("DESCRIPCIÓN"), "", 0, "L", true, 0, "")
	pdf.CellFormat(25, 8, tr("PRECIO UNITARIO"), "", 0, "R", true, 0, "")
	pdf.CellFormat(18, 8, tr("IVA"), "", 0, "R", true, 0, "")
	pdf.CellFormat(40, 8, tr("SUBTOTAL"), "", 1, "R", true, 0, "")
}

func drawTotals(pdf *fpdf.Fpdf, document Document) {
	tr := pdf.UnicodeTranslatorFromDescriptor("")
	pdf.Ln(8)
	x := 118.0
	pdf.SetX(x)
	pdf.SetFont("Helvetica", "", 9)
	pdf.SetTextColor(80, 80, 80)
	pdf.CellFormat(40, 6, tr("Subtotal"), "", 0, "L", false, 0, "")
	pdf.CellFormat(34, 6, money(document.Subtotal), "", 1, "R", false, 0, "")
	pdf.SetX(x)
	pdf.CellFormat(40, 6, tr("Total IVA"), "", 0, "L", false, 0, "")
	pdf.CellFormat(34, 6, money(document.TotalVAT), "", 1, "R", false, 0, "")
	pdf.SetDrawColor(brandBlue, brandBlue, brandBlue)
	pdf.Line(x, pdf.GetY()+1, pageWidth-margin, pdf.GetY()+1)
	pdf.SetX(x)
	pdf.SetFont("Helvetica", "B", 12)
	pdf.SetTextColor(brandBlue, brandBlue, brandBlue)
	pdf.CellFormat(40, 9, tr("TOTAL GENERAL"), "", 0, "L", false, 0, "")
	pdf.CellFormat(34, 9, money(document.GrandTotal), "", 1, "R", false, 0, "")
}

func drawNotes(pdf *fpdf.Fpdf, notes string) {
	tr := pdf.UnicodeTranslatorFromDescriptor("")
	pdf.Ln(5)
	pdf.SetFont("Helvetica", "B", 9)
	pdf.SetTextColor(headerColor, headerColor, headerColor)
	pdf.CellFormat(0, 5, tr("NOTAS"), "", 1, "L", false, 0, "")
	pdf.SetFont("Helvetica", "", 8.5)
	pdf.SetTextColor(90, 90, 90)
	pdf.MultiCell(0, 4.5, tr(notes), "", "L", false)
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
