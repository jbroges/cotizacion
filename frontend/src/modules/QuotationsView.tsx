import { useEffect, useState } from "react";
import { Download, Eye } from "lucide-react";
import { appAPI, type QuotationSummary } from "../api";
import { Button } from "../components/Button";
import { DataTable, type DataTableColumn } from "../components/DataTable";

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

function downloadPDF(id: string, bytes: number[]) {
  const blob = new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `quotation-${id}.pdf`;
  link.click();
  URL.revokeObjectURL(url);
}

export function QuotationsView({ onNew }: { onNew: () => void }) {
  const [quotations, setQuotations] = useState<QuotationSummary[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    appAPI.getQuotations()
      .then(setQuotations)
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Unable to load quotations."))
      .finally(() => setLoading(false));
  }, []);

  async function exportPDF(id: string) {
    setError("");
    try {
      downloadPDF(id, await appAPI.downloadQuotation(id));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to generate PDF.");
    }
  }

  const columns: DataTableColumn<QuotationSummary>[] = [
    { key: "id", header: "Quotation ID", render: (row) => <span className="font-semibold text-ink">{row.id}</span> },
    { key: "clientName", header: "Client", render: (row) => row.clientName },
    { key: "createdAt", header: "Date", render: (row) => new Date(row.createdAt).toLocaleDateString() },
    { key: "grandTotal", header: "Total", className: "text-right", render: (row) => <span className="font-semibold text-ink">{money.format(row.grandTotal)}</span> },
    { key: "actions", header: "Actions", render: (row) => <div className="flex justify-end gap-2"><Button variant="ghost" aria-label={`View ${row.id}`}><Eye size={16} /></Button><Button variant="secondary" aria-label={`Download ${row.id}`} onClick={() => void exportPDF(row.id)}><Download size={16} /></Button></div> },
  ];

  if (loading) return <p className="text-sm text-muted">Loading quotations...</p>;
  return <div className="space-y-6"><div className="flex items-end justify-between"><div><p className="text-sm text-muted">Saved documents</p><h2 className="mt-1 text-2xl font-semibold">Quotations</h2></div><Button onClick={onNew}>New quotation</Button></div>{error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}<DataTable columns={columns} rows={quotations} rowKey={(row) => row.id} /></div>;
}
