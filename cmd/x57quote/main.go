package main

import (
	"log"
	"os"

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
	defer application.Close()

	log.Printf("x57Quote initialized with database at %s", application.DatabasePath())
}
