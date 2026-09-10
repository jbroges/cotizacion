specs.md — Especificación Técnica: Desktop Quote Generator (Go + Wails + React)
1. Visión General del Proyecto
x57Quote es una aplicación de escritorio nativa de alto rendimiento construida para la gestión, emisión y exportación en PDF de cotizaciones profesionales.
El sistema operará completamente offline o en redes locales, almacenando la información en una base de datos SQLite incrustada, y aprovechando el poder de React para interfaces dinámicas y Go para el procesamiento pesado (como la generación del documento PDF).

1.1. Principios de Diseño
Velocidad Wails: Tiempos de apertura casi instantáneos.

English First: Al igual que el resto de los proyectos, todo el código fuente, la base de datos, los bindings de Wails y las interfaces de React estarán estrictamente en inglés.

UX B2B Profesional: Interfaz limpia, navegación lateral, modales interceptores fluidos, tablas de datos escaneables con atajos de teclado y enfoque rápido en la carga de rubros.

2. Arquitectura del Sistema
Backend / Core: Go 1.21+

Frontend: React 18 + Vite + TypeScript.

UI Framework: Tailwind CSS + Radix UI (sin estilos predeterminados intrusivos) + Lucide Icons.

Base de Datos: SQLite incrustada (driver mattn/go-sqlite3 o glebarez/go-sqlite puro en Go).

Generador PDF: Biblioteca Go nativa como maroto o gofpdf para construir PDFs vectoriales ultra-ligeros y perfectamente formateados, evitando la inestabilidad de convertir HTML a PDF en el cliente.

Intercomunicación: Wails IPC (Inter-Process Communication) para conectar los endpoints de Go con el frontend en React a través de promesas asíncronas.

3. Modelo de Datos (SQLite)
El esquema de la base de datos local garantiza la integridad transaccional de cada cotización.

SQL

-- Table: company_settingsCREATE TABLE company_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1), -- Asegura un solo registro
    business_name TEXT NOT NULL,
    tax_id TEXT NOT NULL, -- RIF
    phone TEXT,
    address TEXT,
    logo_path TEXT, -- Ruta local del archivo o base64
    default_vat_rate REAL DEFAULT 16.00,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);-- Table: clientsCREATE TABLE clients (
    id TEXT PRIMARY KEY, -- UUID
    business_name TEXT NOT NULL,
    tax_id TEXT UNIQUE NOT NULL, -- RIF
    phone TEXT,
    address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);-- Table: quotationsCREATE TABLE quotations (
    id TEXT PRIMARY KEY, -- UUID / o un secuencial visible ej: COT-0001
    client_id TEXT NOT NULL,
    subtotal REAL NOT NULL,
    total_vat REAL NOT NULL,
    grand_total REAL NOT NULL,
    footer_notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(client_id) REFERENCES clients(id)
);-- Table: quotation_itemsCREATE TABLE quotation_items (
    id TEXT PRIMARY KEY,
    quotation_id TEXT NOT NULL,
    description TEXT NOT NULL,
    unit_price REAL NOT NULL,
    vat_rate REAL NOT NULL,
    subtotal REAL NOT NULL,
    FOREIGN KEY(quotation_id) REFERENCES quotations(id) ON DELETE CASCADE
);
4. UI/UX y Flujos de Pantallas
La aplicación tendrá una barra lateral (Sidebar) con 3 módulos principales.

4.1. Settings (Configuración)
Propósito: Definir los datos emisores que saldrán en el membrete del PDF.

Formulario: businessName, taxId, phone, address, defaultVatRate.

Logo: Componente de arrastrar y soltar (drag & drop) que toma la imagen del sistema de archivos, la optimiza en Go y la guarda codificada de forma segura o copiándola a un directorio local de la app de Wails.

4.2. Clients (Directorio de Clientes)
Propósito: CRUD rápido de clientes.

UI: DataTable con barra de búsqueda superior. Columnas alineadas lógicamente. Botón "New Client" que abre un Slide-over o Modal para captura de datos rápida.

4.3. Quotations (Panel de Cotizaciones)
Vista de Lista:

Tabla profesional mostrando: Quotation ID, Client Name, Date, Total, y columna de Actions.

Acciones: Botón de ojo (View) y botón de descarga (Download PDF).

Alineación derecha (text-right) para la columna de Totales monetarios.

Vista de Creación (New Quotation):

Paso 1: Selector de Cliente. Un input que al hacer clic/escribir despliega un Search Modal de clientes con filtrado instantáneo.

Paso 2: Editor de Líneas (Items Table). Una tabla interactiva donde el usuario agrega filas (rubros).

Columnas editables: Description (Texto largo), Unit Price (Numérico), VAT % (Pre-llenado por el setting global), Subtotal (Calculado automáticamente).

Paso 3: Panel de Resumen. Abajo a la derecha, sumatorias dinámicas: Global Subtotal, Total VAT, Grand Total.

Paso 4: Notas. Un textarea al pie (Footer Notes) para garantías, tiempos de entrega o vigencia de la oferta.

Acción Final: Botón Save & Generate PDF. Llama al método de Go que guarda en SQLite y dispara la generación del documento.

5. El Generador de PDF (Go Engine)
La generación del PDF no recaerá en el navegador, sino en el backend Go para asegurar precisión milimétrica (márgenes, fuentes corporativas, alineación).

Header: Logo alineado a la izquierda. Datos de la empresa a la derecha. Etiqueta grande de "COTIZACIÓN" con el número correlativo.

Bill To: Datos del cliente en una caja gris clara (estilo Stripe).

Table: Tabla estilizada con bordes sutiles, cabeceras en gris oscuro y filas intercaladas. Columnas de montos estrictamente alineadas a la derecha.

Footer: Desglose de totales de forma escalonada, seguido de la nota de pie de página centrada.

Output: El archivo se guarda localmente (invocando un diálogo nativo de "Guardar como..." desde Go) y se abre automáticamente en el visor del sistema operativo.

6. Plan de Ejecución (Roadmap)
- [x] Phase 1: Wails Initialization & SQLite Setup
Inicializar el proyecto wails init -n x57Quote -t react-ts. Configurar la conexión a SQLite en Go y ejecutar las migraciones iniciales de las tablas.

- [x] Phase 2: Go Backend Bindings
Crear los structs y métodos exportables en Go (SaveSettings, GetClients, CreateQuotation) para que Wails genere automáticamente los tipos de TypeScript en el frontend.

- [x] Phase 3: React UI Foundation
Configurar Tailwind CSS, layout principal (Sidebar + Main Content Area) y crear componentes atómicos reusables (Button, Input, Modal, DataTable).

- [ ] Phase 4: Settings & Clients Modules
Desarrollar el formulario de configuración empresarial (con soporte para subida de logo) y el CRUD completo del directorio de clientes en el frontend.

- [ ] Phase 5: Quotation Builder Form
Construir el formulario de creación de cotización: integración del modal de búsqueda de clientes, lógica matemática de la tabla de rubros (cálculo de subtotales e IVA en tiempo real) y validaciones de estado.

- [ ] Phase 6: PDF Generation Engine (Go)
Implementar la lógica de diseño del PDF utilizando una librería vectorial en Go (ej. gofpdf). Ajustar márgenes, membretes profesionales y desglose de la tabla.

- [ ] Phase 7: System Integration & Export
Conectar el botón "Download PDF" en las vistas de tabla, implementar el diálogo nativo de guardado de archivos de Wails y compilar los binarios finales para Windows/macOS.
