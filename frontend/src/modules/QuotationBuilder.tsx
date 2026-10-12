import { useEffect, useMemo, useState } from "react";
import { Check, Plus, Search, Trash2, UserRound } from "lucide-react";
import { appAPI, type Client, type CompanySettings, type QuotationItem } from "../api";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { Modal } from "../components/Modal";
import { money } from "../utils";

type DraftItem = Omit<QuotationItem, "id" | "subtotal">;
const newItem = (vatRate: number): DraftItem => ({ description: "", quantity: 1, unitPrice: 0, vatRate, applyVat: true });

export function QuotationBuilder({ onSaved }: { onSaved?: () => void }) {
  const [clients, setClients] = useState<Client[]>([]);
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [items, setItems] = useState<DraftItem[]>([]);
  const [footerNotes, setFooterNotes] = useState("");
  const [clientSearch, setClientSearch] = useState("");
  const [clientModalOpen, setClientModalOpen] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([appAPI.getClients(), appAPI.getSettings()])
      .then(([loadedClients, loadedSettings]) => {
        setClients(loadedClients);
        setSettings(loadedSettings);
        setItems([newItem(loadedSettings.defaultVatRate)]);
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "No se pudieron cargar los datos de cotización."))
      .finally(() => setLoading(false));
  }, []);

  const visibleClients = useMemo(() => {
    const query = clientSearch.trim().toLowerCase();
    if (!query) return clients;
    return clients.filter((candidate) =>
      `${candidate.businessName} ${candidate.taxId} ${candidate.phone}`.toLowerCase().includes(query),
    );
  }, [clients, clientSearch]);

  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const totalVat = items.reduce((sum, item) => {
    if (!item.applyVat) return sum;
    return sum + (item.quantity * item.unitPrice * item.vatRate) / 100;
  }, 0);
  const grandTotal = subtotal + totalVat;

  function updateItem(index: number, field: keyof DraftItem, value: string | number | boolean) {
    setItems((current) => current.map((item, itemIndex) => {
      if (itemIndex !== index) return item;
      if (field === "description") return { ...item, [field]: value as string };
      if (field === "applyVat") return { ...item, applyVat: Boolean(value) };
      return { ...item, [field]: Number(value) };
    }));
  }

  function addItem() {
    setItems((current) => [...current, newItem(settings?.defaultVatRate ?? 16)]);
  }

  function removeItem(index: number) {
    setItems((current) => current.length === 1 ? current : current.filter((_, itemIndex) => itemIndex !== index));
  }

  async function save() {
    setError("");
    if (!client) return setError("Seleccione un cliente antes de guardar.");
    if (items.some((item) => !item.description.trim())) return setError("Cada artículo o servicio requiere una descripción.");
    if (items.some((item) => !Number.isFinite(item.quantity) || item.quantity <= 0)) return setError("La cantidad debe ser mayor a cero.");
    if (items.some((item) => !Number.isFinite(item.unitPrice) || item.unitPrice < 0)) return setError("El precio unitario debe ser mayor o igual a cero.");
    if (items.some((item) => !Number.isFinite(item.vatRate) || item.vatRate < 0 || item.vatRate > 100)) return setError("La tasa de IVA debe estar entre 0 y 100.");

    setSaving(true);
    try {
      await appAPI.createQuotation({
        clientId: client.id,
        footerNotes,
        items: items.map((item) => ({ ...item, id: "", subtotal: item.quantity * item.unitPrice })),
      });
      onSaved?.();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo guardar la cotización.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-sm text-muted">Cargando creador de cotizaciones...</p>;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted">Nueva cotización</p>
        <h2 className="mt-1 text-2xl font-semibold">Generador de cotización</h2>
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-panel">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-ink">Facturar a</p>
            <p className="text-xs text-muted">Seleccione un cliente de su directorio.</p>
          </div>
          <Button variant="secondary" onClick={() => { setClientSearch(""); setClientModalOpen(true); }}>
            <Search size={16} />{client ? "Cambiar cliente" : "Seleccionar cliente"}
          </Button>
        </div>
        {client ? (
          <div className="mt-4 flex items-start gap-3 rounded-lg bg-slate-50 p-4">
            <UserRound className="mt-0.5 text-brand-600" size={19} />
            <div>
              <p className="font-semibold">{client.businessName}</p>
              <p className="text-sm text-muted">{client.taxId}{client.phone ? ` · ${client.phone}` : ""}</p>
              <p className="text-sm text-muted">{client.address || "Sin dirección registrada"}</p>
            </div>
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted">Ningún cliente seleccionado.</p>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-panel">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-semibold">Artículos y Servicios</h3>
          <Button variant="secondary" onClick={addItem}>
            <Plus size={16} />Agregar artículo
          </Button>
        </div>
        <div className="space-y-3">
          {items.map((item, index) => (
            <div className="grid gap-3 rounded-lg border border-slate-100 p-3 md:grid-cols-[5rem_minmax(0,1fr)_8rem_5rem_6rem_auto_auto]" key={index}>
              <Input aria-label={`Cantidad ${index + 1}`} type="number" min="0.1" step="1" value={item.quantity} onChange={(event) => updateItem(index, "quantity", event.target.value)} />
              <Input aria-label={`Descripción ${index + 1}`} placeholder="Descripción del producto o servicio" value={item.description} onChange={(event) => updateItem(index, "description", event.target.value)} />
              <Input aria-label={`Precio unitario ${index + 1}`} type="number" min="0" step="0.01" placeholder="Precio U." value={item.unitPrice} onChange={(event) => updateItem(index, "unitPrice", event.target.value)} />
              <Input aria-label={`% IVA ${index + 1}`} type="number" min="0" max="100" step="0.01" placeholder="% IVA" value={item.vatRate} onChange={(event) => updateItem(index, "vatRate", event.target.value)} />
              <label className="flex items-center gap-1 text-xs font-medium text-slate-600">
                <input type="checkbox" checked={item.applyVat} onChange={(e) => updateItem(index, "applyVat", e.target.checked)} />
                IVA
              </label>
              <div className="flex items-center justify-end text-sm font-semibold text-ink">
                {money.format(item.quantity * item.unitPrice)}
              </div>
              <Button variant="danger" onClick={() => removeItem(index)} disabled={items.length === 1}>
                <Trash2 size={16} />
              </Button>
            </div>
          ))}
        </div>
        <div className="mt-6 ml-auto max-w-xs space-y-2 border-t border-slate-100 pt-4 text-sm">
          <div className="flex justify-between">
            <span className="text-muted">Subtotal</span>
            <span>{money.format(subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Total IVA</span>
            <span>{money.format(totalVat)}</span>
          </div>
          <div className="flex justify-between text-base font-semibold">
            <span>Total general</span>
            <span>{money.format(grandTotal)}</span>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-panel">
        <label className="block text-sm font-semibold" htmlFor="footer-notes">Notas de pie de página</label>
        <textarea id="footer-notes" className="mt-2 block min-h-24 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/15" placeholder="Garantías, tiempos de entrega, validez de la oferta o condiciones de pago..." value={footerNotes} onChange={(event) => setFooterNotes(event.target.value)} />
      </section>

      <div className="flex justify-end">
        <Button onClick={() => void save()} disabled={saving}>
          <Check size={17} />{saving ? "Guardando..." : "Guardar cotización"}
        </Button>
      </div>

      <Modal open={clientModalOpen} onOpenChange={setClientModalOpen} title="Seleccionar cliente" description="Buscar por razón social, identificación fiscal o teléfono.">
        <div className="space-y-3">
          <Input autoFocus placeholder="Buscar clientes..." value={clientSearch} onChange={(event) => setClientSearch(event.target.value)} />
          <div className="max-h-64 overflow-y-auto">
            {visibleClients.length === 0 ? (
              <p className="py-5 text-center text-sm text-muted">No se encontraron clientes.</p>
            ) : (
              visibleClients.map((candidate) => (
                <button className="flex w-full items-center gap-3 rounded-lg p-3 text-left hover:bg-slate-50 transition-colors" key={candidate.id} onClick={() => { setClient(candidate); setClientModalOpen(false); }}>
                  <UserRound size={18} className="text-brand-600" />
                  <span>
                    <span className="block text-sm font-semibold">{candidate.businessName}</span>
                    <span className="block text-xs text-muted">{candidate.taxId}</span>
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
