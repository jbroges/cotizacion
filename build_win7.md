# Compilar x57Quote para Windows 7

## Requisitos (máquina de compilación)
- Go **1.20.14** (último que genera binarios para Windows 7)
- Node **18.x** (LTS)
- Wails CLI compatible: `go install github.com/wailsapp/wails/v2/cmd/wails@v2.8.0`

## Pasos
```bat
go mod tidy
cd frontend && npm install && cd ..
wails build -platform windows/amd64 -webview2 error -clean
```
(`-webview2 error` evita que intente instalar el runtime Evergreen, que no funciona en Win7.)

## Distribución (carpeta final)
```
x57Quote.exe
webview2\            <- WebView2 Fixed Version Runtime 109.0.1518.140 (x64) descomprimido
data\                <- se crea sola
```
Descarga el "Fixed Version" 109.0.1518.140 desde la página oficial de WebView2 (es el último que soporta Win 7/8/8.1) y extrae el contenido dentro de `webview2\`.

## En el equipo Windows 7
- Service Pack 1 + actualizaciones KB4474419 y KB4490628 (soporte SHA-2).
- Visual C++ Redistributable 2015-2019 si el runtime lo pide.