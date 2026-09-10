# x57Quote

Base del backend Go para una aplicación de escritorio de cotizaciones.

## Estructura

```text
.
├── cmd/x57quote/       # Punto de entrada de la aplicación
├── internal/app/       # Composición y ciclo de vida de la aplicación
├── internal/database/  # Conexión SQLite y migraciones
├── data/               # Base local creada al ejecutar (ignorado por Git)
└── go.mod
```

## Ejecutar

```bash
go run ./cmd/x57quote
```

La ruta de datos puede cambiarse con `X57QUOTE_DATA_DIR`:

```bash
X57QUOTE_DATA_DIR="$HOME/.local/share/x57quote" go run ./cmd/x57quote
```
