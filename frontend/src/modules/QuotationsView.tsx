import { useEffect, useState } from "react";
import { Download, Eye } from "lucide-react";
import { appAPI, type Quotation, type QuotationSummary } from "../api";
import { Button } from "../components/Button";
import { DataTable, type DataTableColumn } from "../components/DataTable";
import { Modal } from "../components/Modal";
import { downloadPDF, money } from "../utils";

export function QuotationsView({ onNew }: { onNew: () => void }) {
  const [quotations, setQuotations] = useState<QuotationSummary[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedQuotation, setSelectedQuotation] = useState<Quotation | null>(null);
  const [selectedSummary, setSelectedSummary] = useState<QuotationSummary | null>(null);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);

  useEffect(() => {
    appAPI.getQuotations()
      .then(setQuotations)
      .catch((reason) => setError(reason instanceof Error ? reason.message : "No se pudieron cargar las cotizaciones."))
      .finally(() => setLoading(false));
  }, []);

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

  async function exportPDF(id: string) {
    setError("");
    try {
      downloadPDF(id, await appAPI.downloadQuotation(id));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo generar el archivo PDF.");
    }
  }

  const columns: DataTableColumn<QuotationSummary>[] = [
    { key: "id", header: "Nº Cotización", render: (row) => <span className="font-semibold text-ink">{row.id}</span> },
    { key: "clientName", header: "Cliente", render: (row) => row.clientName },
    { key: "createdAt", header: "Fecha", render: (row) => new Date(row.createdAt).toLocaleDateString("es-ES") },
    { key: "grandTotal", header: "Total", className: "text-right", render: (row) => <span className="font-semibold text-ink">{money.format(row.grandTotal)}</span> },
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
      <DataTable columns={columns} rows={quotations} rowKey={(row) => row.id} emptyMessage="No hay cotizaciones registradas aún." />

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
            <div className="rounded-lg border border-slate-200 overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 font-semibold text-muted border-b border-slate-200">
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
