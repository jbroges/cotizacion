package main

import (
	"log"
	"os"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/mac"
	"github.com/wailsapp/wails/v2/pkg/options/windows"

	"x57quote/internal/app"
)

func main() {
	dataDir := os.Getenv("X57QUOTE_DATA_DIR")
	if dataDir == "" {
		dataDir = "data"
	}

	application, err := app.New(dataDir)
	if err != nil {
		log.Fatalf("initialize application: %v", err)
	}

	err = wails.Run(&options.App{
		Title:  "x57Quote",
		Width:  1280,
		Height: 800,
		Bind:   []interface{}{application},
		Mac: &mac.Options{
			TitleBar: mac.TitleBarHiddenInset(),
		},
		Windows: &windows.Options{
			WebviewIsTransparent: false,
		},
	})
	if closeErr := application.Close(); closeErr != nil {
		log.Printf("close database: %v", closeErr)
	}
	if err != nil {
		log.Fatalf("run application: %v", err)
	}
}
