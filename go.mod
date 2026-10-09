module x57quote

go 1.20

// Direct dependencies pinned to versions compatible with Go 1.20 (last Go release that runs on Windows 7).
// Run `go mod tidy` afterwards (with Go 1.20 and network access) to regenerate the indirect block and go.sum.
require (
	github.com/go-pdf/fpdf v0.9.0
	github.com/google/uuid v1.3.1
	github.com/wailsapp/wails/v2 v2.8.0
	modernc.org/sqlite v1.23.1
)