import { useEffect, useMemo, useState } from "react";
import { Download, Eye, CheckCircle, XCircle, Ban, Edit, Search, Filter, Calendar, ChevronDown } from "lucide-react";
import { appAPI, type Quotation, type QuotationSummary } from "../api";
import { Button } from "../components/Button";
import { DataTable, type DataTableColumn } from "../components/DataTable";
import { Modal } from "../components/Modal";
import { downloadPDF, money } from "../utils";

type QuotationStatus = "pending" | "approved" | "rejected" | "cancelled" | "expired" | "all";

function renderStatusBadge(status: string) {
  const styles: Record<string, string> = {
    pending: "bg-amber-50 text-amber-700 border-amber-200",
    approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
    rejected: "bg-red-50 text-red-700 border-red-200",
    cancelled: "bg-slate-100 text-slate-600 border-slate-200",
    expired: "bg-zinc-100 text-zinc-500 border-zinc-200",
  };
  const labels: Record<string, string> = {
    pending: "Pendiente",
    approved: "Aprobada",
    rejected: "Rechazada",
    cancelled: "Cancelada",
    expired: "Expirada",
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${styles[status] || styles.pending}`}>
      {labels[status] || status}
    </span>
  );
}

export function QuotationsView({ onNew }: { onNew: () => void }) {
  const [quotations, setQuotations] = useState<QuotationSummary[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedQuotation, setSelectedQuotation] = useState<Quotation | null>(null);
  const [selectedSummary, setSelectedSummary] = useState<QuotationSummary | null>(null);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<QuotationStatus>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    appAPI.getQuotations()
      .then(setQuotations)
      .catch((reason) => setError(reason instanceof Error ? reason.message : "No se pudieron cargar las cotizaciones."))
      .finally(() => setLoading(false));
  }, []);

  // Filter quotations in real-time
  const filteredQuotations = useMemo(() => {
    return quotations.filter((q) => {
      // Text search: ID, client name, tax ID
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        const matchesId = String(q.id).toLowerCase().includes(query);
        const matchesClient = q.clientName.toLowerCase().includes(query);
        // We don't have client tax ID in summary, but we can check if needed
        if (!matchesId && !matchesClient) return false;
      }

      // Status filter
      if (statusFilter !== "all" && q.status !== statusFilter) {
        return false;
      }

      // Date range filter
      if (dateFrom || dateTo) {
        const createdDate = new Date(q.createdAt);
        if (dateFrom) {
          const fromDate = new Date(dateFrom);
          fromDate.setHours(0, 0, 0, 0);
          if (createdDate < fromDate) return false;
        }
        if (dateTo) {
          const toDate = new Date(dateTo);
          toDate.setHours(23, 59, 59, 999);
          if (createdDate > toDate) return false;
        }
      }

      return true;
    });
  }, [quotations, searchQuery, statusFilter, dateFrom, dateTo]);

  async function handleView(summary: QuotationSummary) {
    setError("");
    setSelectedSummary(summary);
    setLoadingDetails(true);
    setViewModalOpen(true);
    try {
      const details = await appAPI.getQuotation(summary.id);
      setSelectedQuotation(details);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudieron cargar los detalles de la cotización.");
      setViewModalOpen(false);
    } finally {
      setLoadingDetails(false);
    }
  }

  async function exportPDF(id: number) {
    setError("");
    try {
      downloadPDF(id, await appAPI.downloadQuotation(id));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo generar el archivo PDF.");
    }
  }

  async function updateStatus(id: number, status: string) {
    setError("");
    try {
      await appAPI.updateQuotationStatus(id, status);
      // Refresh the quotations list
      const updated = await appAPI.getQuotations();
      setQuotations(updated);
      // If we're viewing this quotation, refresh its details
      if (selectedQuotation?.id === id) {
        const details = await appAPI.getQuotation(id);
        setSelectedQuotation(details);
        setSelectedSummary(prev => prev ? { ...prev, status } : null);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo actualizar el estado.");
    }
  }

  const columns: DataTableColumn<QuotationSummary>[] = [
    { key: "id", header: "Nº Cotización", render: (row) => <span className="font-semibold text-ink">#{row.id}</span> },
    { key: "clientName", header: "Cliente", render: (row) => row.clientName },
    { key: "createdAt", header: "Fecha", render: (row) => new Date(row.createdAt).toLocaleDateString("es-ES") },
    { key: "grandTotal", header: "Total", className: "text-right", render: (row) => <span className="font-semibold text-ink">{money.format(row.grandTotal)}</span> },
    { key: "status", header: "Estado", render: (row) => renderStatusBadge(row.status) },
    { key: "actions", header: "Acciones", render: (row) => (
      <div className="flex justify-end gap-2">
        <Button variant="ghost" aria-label={`Ver cotización ${row.id}`} onClick={() => void handleView(row)}>
          <Eye size={16} />
        </Button>
        <Button variant="secondary" aria-label={`Descargar PDF ${row.id}`} onClick={() => void exportPDF(row.id)}>
          <Download size={16} />
        </Button>
      </div>
    ) },
  ];

  if (loading) return <p className="text-sm text-muted">Cargando cotizaciones...</p>;

  const statusOptions: { value: QuotationStatus; label: string }[] = [
    { value: "all", label: "Todos" },
    { value: "pending", label: "Pendientes" },
    { value: "approved", label: "Aprobadas" },
    { value: "rejected", label: "Rechazadas" },
    { value: "cancelled", label: "Canceladas" },
    { value: "expired", label: "Expiradas" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-sm text-muted">Documentos guardados</p>
          <h2 className="mt-1 text-2xl font-semibold">Cotizaciones</h2>
        </div>
        <Button onClick={onNew}>Nueva cotización</Button>
      </div>
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {/* Professional Filters Bar */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-panel">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Buscar por Nº, cliente..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm pl-10 text-ink outline-none transition placeholder:text-slate-400 focus:border-brand-600 focus:ring-2 focus:ring-brand-600/15"
            />
          </div>

          {/* Status Filter Dropdown */}
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as QuotationStatus)}
              className="block w-full sm:w-48 rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/15 bg-white appearance-none pr-8 cursor-pointer"
            >
              {statusOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18} />
          </div>

          {/* Date Range Filters */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted whitespace-nowrap">Desde:</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/15 w-40"
            />
            <label className="text-xs text-muted whitespace-nowrap">Hasta:</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/15 w-40"
            />
          </div>

          {/* Clear Filters Button */}
          {(searchQuery || statusFilter !== "all" || dateFrom || dateTo) && (
            <Button variant="ghost" className="px-2.5 py-1.5 text-xs" onClick={() => { setSearchQuery(""); setStatusFilter("all"); setDateFrom(""); setDateTo(""); }}>
              <Filter className="mr-1" size={14} /> Limpiar filtros
            </Button>
          )}
        </div>

        {/* Active Filters Summary */}
        {(searchQuery || statusFilter !== "all" || dateFrom || dateTo) && (
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            {searchQuery && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-brand-50 text-brand-700">
                <Search size={12} /> "{searchQuery}"
              </span>
            )}
            {statusFilter !== "all" && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-amber-50 text-amber-700">
                Estado: {statusOptions.find(o => o.value === statusFilter)?.label}
              </span>
            )}
            {dateFrom && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-50 text-emerald-700">
                <Calendar size={12} /> Desde: {new Date(dateFrom).toLocaleDateString("es-ES")}
              </span>
            )}
            {dateTo && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-50 text-emerald-700">
                <Calendar size={12} /> Hasta: {new Date(dateTo).toLocaleDateString("es-ES")}
              </span>
            )}
          </div>
        )}
      </div>

      <DataTable columns={columns} rows={filteredQuotations} rowKey={(row) => String(row.id)} emptyMessage="No se encontraron cotizaciones con los filtros aplicados." />

      <Modal
        open={viewModalOpen}
        onOpenChange={setViewModalOpen}
        title={`Cotización #${selectedSummary?.id ?? ""}`}
        description={`Cliente: ${selectedSummary?.clientName ?? ""}`}
      >
        {loadingDetails ? (
          <p className="py-4 text-sm text-muted">Cargando detalles...</p>
        ) : selectedQuotation ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <p className="text-xs text-muted">Estado actual:</p>
                <div className="mt-1">{renderStatusBadge(selectedQuotation.status)}</div>
              </div>
              <div className="flex flex-wrap gap-2">
                {selectedQuotation.status === "pending" && (
                  <>
                    <Button variant="success" onClick={() => void updateStatus(selectedQuotation.id, "approved")}>
                      <CheckCircle size={16} /> Aprobar
                    </Button>
                    <Button variant="danger" onClick={() => void updateStatus(selectedQuotation.id, "rejected")}>
                      <XCircle size={16} /> Rechazar
                    </Button>
                    <Button variant="ghost" onClick={() => void updateStatus(selectedQuotation.id, "cancelled")}>
                      <Ban size={16} /> Cancelar
                    </Button>
                  </>
                )}
                <Button variant="secondary" onClick={() => void exportPDF(selectedQuotation.id)}>
                  <Download size={16} /> PDF
                </Button>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 font-semibold text-muted border-b border-slate-200">
                  <tr>
                    <th className="p-2 text-center">Cant.</th>
                    <th className="p-2">Descripción</th>
                    <th className="p-2 text-right">Precio U.</th>
                    <th className="p-2 text-right">IVA</th>
                    <th className="p-2 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {selectedQuotation.items.map((item, index) => (
                    <tr key={item.id || index}>
                      <td className="p-2 text-center text-sm">{item.quantity.toFixed(2)}</td>
                      <td className="p-2 font-medium text-ink">{item.description}</td>
                      <td className="p-2 text-right">{money.format(item.unitPrice)}</td>
                      <td className="p-2 text-right">
                        {item.applyVat ? `${item.vatRate}%` : <span className="text-muted">Exento</span>}
                      </td>
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
                <p className="font-semibold text-ink mb-1">Notas:</p>
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
