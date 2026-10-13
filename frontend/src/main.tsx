import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Calendar,
  DollarSign,
  Download,
  Eye,
  FileText,
  Key,
  LayoutDashboard,
  Menu,
  Plus,
  Settings,
  Users,
  X,
} from "lucide-react";
import { appAPI, type Client, type LicenseStatus, type Quotation, type QuotationSummary } from "./api";
import { Button } from "./components/Button";
import { DataTable, type DataTableColumn } from "./components/DataTable";
import { Input } from "./components/Input";
import { Modal } from "./components/Modal";
import { ClientsView } from "./modules/ClientsView";
import { QuotationBuilder } from "./modules/QuotationBuilder";
import { QuotationsView } from "./modules/QuotationsView";
import { SettingsView } from "./modules/SettingsView";
import { downloadPDF, money } from "./utils";
import "./styles.css";

type Section = "Panel" | "Clientes" | "Cotizaciones" | "Configuración";

const navigation = [
  { label: "Panel", icon: LayoutDashboard },
  { label: "Clientes", icon: Users },
  { label: "Cotizaciones", icon: FileText },
  { label: "Configuración", icon: Settings },
] as const;

function App() {
  const [section, setSection] = useState<Section>("Panel");
  const [creatingQuotation, setCreatingQuotation] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [licensed, setLicensed] = useState<boolean | null>(null);
  const [hwid, setHwid] = useState("");
  const [keyInput, setKeyInput] = useState("");
  const [licenseError, setLicenseError] = useState("");
  const [licenseLoading, setLicenseLoading] = useState(false);

  useEffect(() => {
    appAPI.checkLicense()
      .then((res) => {
        setLicensed(res.valid);
        setHwid(res.hwid);
      })
      .catch(() => setLicensed(false));
  }, []);

  async function handleActivate() {
    setLicenseError("");
    setLicenseLoading(true);
    try {
      await appAPI.activateLicense(keyInput);
      setLicensed(true);
    } catch (err) {
      setLicenseError(err instanceof Error ? err.message : "Clave inválida");
    } finally {
      setLicenseLoading(false);
    }
  }

  // Show loading while checking license
  if (licensed === null) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-3 border-brand-600 border-t-transparent mx-auto"></div>
          <p className="mt-4 text-sm text-muted">Verificando licencia del equipo...</p>
        </div>
      </div>
    );
  }

  // Show activation screen if not licensed
  if (!licensed) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-900 p-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl space-y-6">
          <div className="text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-brand-100">
              <Key className="h-7 w-7 text-brand-600" />
            </div>
            <h2 className="mt-4 text-xl font-bold text-ink">Activación de Software</h2>
            <p className="mt-2 text-sm text-muted">Este equipo no está autorizado o el programa fue cambiado de PC.</p>
          </div>

          <div className="rounded-lg bg-slate-50 p-3 text-xs">
            <span className="font-semibold text-slate-700">Hardware ID de este equipo:</span>
            <code className="mt-1 block select-all font-mono text-brand-600 break-all">{hwid}</code>
          </div>

          <div className="space-y-4">
            <Input
              label="Clave de producto"
              type="password"
              placeholder="Ingrese la clave..."
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
            />
            {licenseError && <p className="text-xs text-red-600 text-center">{licenseError}</p>}
            <Button className="w-full" onClick={() => void handleActivate()} disabled={licenseLoading}>
              {licenseLoading ? "Validando..." : "Activar Licencia"}
            </Button>
          </div>

          <p className="text-center text-xs text-muted">
            Clave de activación: <code className="font-mono">Asd15140..</code>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <aside
        className={`fixed inset-y-0 left-0 z-30 flex w-64 flex-col border-r border-slate-200 bg-white transition-transform lg:static lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-20 items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <img src="/logo.png" className="h-10 w-10 rounded-lg object-contain shadow-sm" alt="Logo" />
            <div>
              <p className="text-lg font-bold tracking-tight text-ink">
                x57<span className="text-brand-600">Quote</span>
              </p>
              <p className="text-xs text-slate-400">Gestión de cotizaciones</p>
            </div>
          </div>
          <button
            className="text-slate-400 lg:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-label="Cerrar navegación"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-5" aria-label="Navegación principal">
          {navigation.map(({ label, icon: Icon }) => (
            <button
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                section === label
                  ? "bg-brand-50 text-brand-700"
                  : "text-slate-600 hover:bg-slate-50 hover:text-ink"
              }`}
              key={label}
              onClick={() => {
                setSection(label as Section);
                setCreatingQuotation(false);
                setSidebarOpen(false);
              }}
            >
              <Icon size={18} strokeWidth={section === label ? 2.5 : 2} />
              {label}
            </button>
          ))}
        </nav>

        <div className="border-t border-slate-100 p-4 text-xs text-slate-400">
          Espacio de trabajo local
        </div>
      </aside>

      {sidebarOpen && (
        <button
          className="fixed inset-0 z-20 bg-slate-950/20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-label="Cerrar superposición de navegación"
        />
      )}

      <main className="min-w-0 flex-1">
        <header className="flex h-20 items-center justify-between border-b border-slate-200 bg-white px-5 sm:px-8">
          <div className="flex items-center gap-3">
            <button
              className="text-slate-500 lg:hidden"
              onClick={() => setSidebarOpen(true)}
              aria-label="Abrir navegación"
            >
              <Menu size={22} />
            </button>
            <div>
              <p className="text-sm text-slate-500">Espacio de trabajo</p>
              <h1 className="text-xl font-semibold text-ink">
                {creatingQuotation ? "Nueva cotización" : section}
              </h1>
            </div>
          </div>
          <Button
            variant="primary"
            onClick={() => {
              setSection("Cotizaciones");
              setCreatingQuotation(true);
            }}
          >
            <Plus size={16} /> Nueva cotización
          </Button>
        </header>

        <div className="mx-auto max-w-7xl p-5 sm:p-8">
          {section === "Panel" ? (
            <Dashboard
              onNavigate={(s) => {
                setSection(s);
                setCreatingQuotation(false);
              }}
              onNewQuotation={() => {
                setSection("Cotizaciones");
                setCreatingQuotation(true);
              }}
            />
          ) : section === "Clientes" ? (
            <ClientsView />
          ) : section === "Configuración" ? (
            <SettingsView />
          ) : creatingQuotation ? (
            <QuotationBuilder onSaved={() => setCreatingQuotation(false)} />
          ) : (
            <QuotationsView onNew={() => setCreatingQuotation(true)} />
          )}
        </div>
      </main>
    </div>
  );
}

function Dashboard({
  onNavigate,
  onNewQuotation,
}: {
  onNavigate: (section: Section) => void;
  onNewQuotation: () => void;
}) {
  const [quotations, setQuotations] = useState<QuotationSummary[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedQuotation, setSelectedQuotation] = useState<Quotation | null>(null);
  const [selectedSummary, setSelectedSummary] = useState<QuotationSummary | null>(null);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);

  useEffect(() => {
    Promise.all([appAPI.getQuotations(), appAPI.getClients()])
      .then(([qList, cList]) => {
        setQuotations(qList);
        setClients(cList);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Error al cargar datos del panel.");
      })
      .finally(() => setLoading(false));
  }, []);

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const thisMonthQuotations = quotations.filter((q) => {
    const d = new Date(q.createdAt);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });

  const totalBilled = quotations.reduce((sum, q) => sum + (q.grandTotal || 0), 0);
  const thisMonthBilled = thisMonthQuotations.reduce((sum, q) => sum + (q.grandTotal || 0), 0);

  const recentQuotations = quotations.slice(0, 5);

  async function handleView(summary: QuotationSummary) {
    setSelectedSummary(summary);
    setLoadingDetails(true);
    setViewModalOpen(true);
    try {
      const details = await appAPI.getQuotation(summary.id);
      setSelectedQuotation(details);
    } catch {
      setViewModalOpen(false);
    } finally {
      setLoadingDetails(false);
    }
  }

  async function exportPDF(id: string) {
    try {
      downloadPDF(id, await appAPI.downloadQuotation(id));
    } catch (reason) {
      alert(reason instanceof Error ? reason.message : "No se pudo generar el archivo PDF.");
    }
  }

  const columns: DataTableColumn<QuotationSummary>[] = [
    { key: "id", header: "Nº Cotización", render: (row) => <span className="font-semibold text-ink">{row.id}</span> },
    { key: "clientName", header: "Cliente", render: (row) => row.clientName },
    { key: "createdAt", header: "Fecha", render: (row) => new Date(row.createdAt).toLocaleDateString("es-ES") },
    { key: "grandTotal", header: "Total", className: "text-right", render: (row) => <span className="font-semibold text-ink">{money.format(row.grandTotal)}</span> },
    { key: "actions", header: "Acciones", render: (row) => (
      <div className="flex justify-end gap-2">
        <Button variant="ghost" aria-label={`Ver ${row.id}`} onClick={() => void handleView(row)}>
          <Eye size={16} />
        </Button>
        <Button variant="secondary" aria-label={`Descargar ${row.id}`} onClick={() => void exportPDF(row.id)}>
          <Download size={16} />
        </Button>
      </div>
    ) },
  ];

  if (loading) return <p className="text-sm text-muted">Cargando panel de control...</p>;

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm text-muted">Bienvenido al sistema</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight">Resumen General</h2>
      </div>

      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-panel">
          <div className="flex items-center justify-between text-muted">
            <span className="text-sm font-medium">Total Cotizaciones</span>
            <FileText className="text-brand-600" size={20} />
          </div>
          <p className="mt-3 text-3xl font-bold text-ink">{quotations.length}</p>
          <p className="mt-1 text-xs text-muted">Documentos registrados</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-panel">
          <div className="flex items-center justify-between text-muted">
            <span className="text-sm font-medium">Este Mes</span>
            <Calendar className="text-emerald-600" size={20} />
          </div>
          <p className="mt-3 text-3xl font-bold text-emerald-600">{thisMonthQuotations.length}</p>
          <p className="mt-1 text-xs text-muted">{money.format(thisMonthBilled)} este mes</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-panel">
          <div className="flex items-center justify-between text-muted">
            <span className="text-sm font-medium">Monto Total Cotizado</span>
            <DollarSign className="text-blue-600" size={20} />
          </div>
          <p className="mt-3 text-3xl font-bold text-ink">{money.format(totalBilled)}</p>
          <p className="mt-1 text-xs text-muted">Acumulado histórico</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-panel">
          <div className="flex items-center justify-between text-muted">
            <span className="text-sm font-medium">Clientes Registrados</span>
            <Users className="text-purple-600" size={20} />
          </div>
          <p className="mt-3 text-3xl font-bold text-ink">{clients.length}</p>
          <p className="mt-1 text-xs text-muted">Directorio comercial</p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-ink">Cotizaciones recientes</h3>
            <p className="text-xs text-muted">Últimos documentos creados en el sistema</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => onNavigate("Cotizaciones")}>
              Ver todas ({quotations.length})
            </Button>
            <Button onClick={onNewQuotation}>
              <Plus size={16} /> Nueva cotización
            </Button>
          </div>
        </div>

        {recentQuotations.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-white p-12 text-center">
            <FileText className="mx-auto text-slate-300" size={40} />
            <h4 className="mt-3 font-semibold text-ink">No hay cotizaciones aún</h4>
            <p className="mt-1 text-sm text-muted">Comience emitiendo su primera cotización para sus clientes.</p>
            <Button className="mt-4" onClick={onNewQuotation}>
              <Plus size={16} /> Crear primera cotización
            </Button>
          </div>
        ) : (
          <DataTable columns={columns} rows={recentQuotations} rowKey={(row) => row.id} />
        )}
      </div>

      <Modal
        open={viewModalOpen}
        onOpenChange={setViewModalOpen}
        title={`Cotización ${selectedSummary?.id ?? ""}`}
        description={`Cliente: ${selectedSummary?.clientName ?? ""}`}
      >
        {loadingDetails ? (
          <p className="py-4 text-sm text-muted">Cargando detalles...</p>
        ) : selectedQuotation ? (
          <div className="space-y-4">
            <div className="overflow-hidden rounded-lg border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 font-semibold text-muted">
                  <tr>
                    <th className="p-2">Descripción</th>
                    <th className="p-2 text-right">Precio</th>
                    <th className="p-2 text-right">% IVA</th>
                    <th className="p-2 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {selectedQuotation.items.map((item, index) => (
                    <tr key={item.id || index}>
                      <td className="p-2 font-medium text-ink">{item.description}</td>
                      <td className="p-2 text-right">{money.format(item.unitPrice)}</td>
                      <td className="p-2 text-right">{item.vatRate}%</td>
                      <td className="p-2 text-right font-medium">{money.format(item.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-1 text-right text-xs">
              <p className="text-muted">Subtotal: <span className="font-semibold text-ink">{money.format(selectedQuotation.subtotal)}</span></p>
              <p className="text-muted">Total IVA: <span className="font-semibold text-ink">{money.format(selectedQuotation.totalVat)}</span></p>
              <p className="text-sm font-semibold text-brand-600">Total General: {money.format(selectedQuotation.grandTotal)}</p>
            </div>

            {selectedQuotation.footerNotes && (
              <div className="rounded-md bg-slate-50 p-3 text-xs text-muted">
                <p className="mb-1 font-semibold text-ink">Notas:</p>
                <p>{selectedQuotation.footerNotes}</p>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setViewModalOpen(false)}>Cerrar</Button>
              <Button onClick={() => void exportPDF(selectedQuotation.id)}>
                <Download size={16} /> Descargar PDF
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
