package main

import (
	"embed"
	"log"
	"os"
	"path/filepath"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/windows"

	"x57quote/internal/app"
)

//go:embed all:frontend/dist
var assets embed.FS

// exeDir returns the folder that contains the executable, so data and the
// bundled WebView2 runtime do not depend on the current working directory.
func exeDir() string {
	exe, err := os.Executable()
	if err != nil {
		return "."
	}
	return filepath.Dir(exe)
}

func main() {
	base := exeDir()

	dataDir := os.Getenv("X57QUOTE_DATA_DIR")
	if dataDir == "" {
		dataDir = filepath.Join(base, "data")
	}

	application, err := app.New(dataDir)
	if err != nil {
		log.Fatalf("initialize application: %v", err)
	}

	// Windows 7 cannot install the Evergreen WebView2 runtime. The last
	// version that supports it is the Fixed Version 109.x; extract it to
	// <exe folder>\webview2 and it will be used automatically.
	winOpts := &windows.Options{
		WebviewIsTransparent: false,
		WindowIsTranslucent:  false,
	}
	fixedRuntime := filepath.Join(base, "webview2")
	if _, statErr := os.Stat(fixedRuntime); statErr == nil {
		winOpts.WebviewBrowserPath = fixedRuntime
	}

	err = wails.Run(&options.App{
		Title:  "x57Quote",
		Width:  1280,
		Height: 800,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		Bind: []interface{}{
			application,
		},
		Windows: winOpts,
	})
	if closeErr := application.Close(); closeErr != nil {
		log.Printf("close database: %v", closeErr)
	}
	if err != nil {
		log.Fatalf("run application: %v", err)
	}
}