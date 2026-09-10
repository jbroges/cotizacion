import { useEffect, useMemo, useState } from "react";
import { Check, Plus, Search, Trash2, UserRound } from "lucide-react";
import { appAPI, type Client, type CompanySettings, type QuotationItem } from "../api";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { Modal } from "../components/Modal";

type DraftItem = Omit<QuotationItem, "id" | "subtotal">;
const newItem = (vatRate: number): DraftItem => ({ description: "", unitPrice: 0, vatRate });

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

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
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Unable to load quotation data."))
      .finally(() => setLoading(false));
  }, []);

  const visibleClients = useMemo(() => {
    const query = clientSearch.trim().toLowerCase();
    if (!query) return clients;
    return clients.filter((candidate) =>
      `${candidate.businessName} ${candidate.taxId} ${candidate.phone}`.toLowerCase().includes(query),
    );
  }, [clients, clientSearch]);

  const subtotal = items.reduce((sum, item) => sum + item.unitPrice, 0);
  const totalVat = items.reduce((sum, item) => sum + item.unitPrice * item.vatRate / 100, 0);
  const grandTotal = subtotal + totalVat;

  function updateItem(index: number, field: keyof DraftItem, value: string) {
    setItems((current) => current.map((item, itemIndex) => itemIndex === index
      ? { ...item, [field]: field === "description" ? value : Number(value) }
      : item));
  }

  function addItem() {
    setItems((current) => [...current, newItem(settings?.defaultVatRate ?? 16)]);
  }

  function removeItem(index: number) {
    setItems((current) => current.length === 1 ? current : current.filter((_, itemIndex) => itemIndex !== index));
  }

  async function save() {
    setError("");
    if (!client) return setError("Select a client before saving.");
    if (items.some((item) => !item.description.trim())) return setError("Every item needs a description.");
    if (items.some((item) => !Number.isFinite(item.unitPrice) || item.unitPrice < 0)) return setError("Unit prices must be zero or greater.");
    if (items.some((item) => !Number.isFinite(item.vatRate) || item.vatRate < 0 || item.vatRate > 100)) return setError("VAT rates must be between 0 and 100.");

    setSaving(true);
    try {
      await appAPI.createQuotation({
        clientId: client.id,
        footerNotes,
        items: items.map((item) => ({ ...item, id: "", subtotal: item.unitPrice })),
      });
      onSaved?.();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to save quotation.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-sm text-muted">Loading quotation builder...</p>;

  return <div className="space-y-6">
    <div><p className="text-sm text-muted">New quotation</p><h2 className="mt-1 text-2xl font-semibold">Quotation builder</h2></div>
    {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-panel">
      <div className="flex items-center justify-between gap-4"><div><p className="text-sm font-semibold text-ink">Bill to</p><p className="text-xs text-muted">Choose a customer from your directory.</p></div><Button variant="secondary" onClick={() => { setClientSearch(""); setClientModalOpen(true); }}><Search size={16} />{client ? "Change client" : "Select client"}</Button></div>
      {client ? <div className="mt-4 flex items-start gap-3 rounded-lg bg-slate-50 p-4"><UserRound className="mt-0.5 text-brand-600" size={19} /><div><p className="font-semibold">{client.businessName}</p><p className="text-sm text-muted">{client.taxId}{client.phone ? ` · ${client.phone}` : ""}</p><p className="text-sm text-muted">{client.address || "No address provided"}</p></div></div> : <p className="mt-4 text-sm text-muted">No client selected.</p>}
    </section>
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-panel">
      <div className="mb-4 flex items-center justify-between"><h3 className="font-semibold">Items</h3><Button variant="secondary" onClick={addItem}><Plus size={16} />Add item</Button></div>
      <div className="space-y-3">
        {items.map((item, index) => <div className="grid gap-3 rounded-lg border border-slate-100 p-3 md:grid-cols-[minmax(0,1fr)_9rem_7rem_8rem_auto]" key={index}>
          <Input aria-label={`Item ${index + 1} description`} placeholder="Description" value={item.description} onChange={(event) => updateItem(index, "description", event.target.value)} />
          <Input aria-label={`Item ${index + 1} unit price`} type="number" min="0" step="0.01" placeholder="Unit price" value={item.unitPrice} onChange={(event) => updateItem(index, "unitPrice", event.target.value)} />
          <Input aria-label={`Item ${index + 1} VAT rate`} type="number" min="0" max="100" step="0.01" placeholder="VAT %" value={item.vatRate} onChange={(event) => updateItem(index, "vatRate", event.target.value)} />
          <div className="flex items-center justify-end text-sm font-semibold text-ink">{money.format(item.unitPrice)}</div>
          <Button variant="danger" aria-label={`Remove item ${index + 1}`} onClick={() => removeItem(index)} disabled={items.length === 1}><Trash2 size={16} /></Button>
        </div>)}
      </div>
      <div className="mt-6 ml-auto max-w-xs space-y-2 border-t border-slate-100 pt-4 text-sm"><div className="flex justify-between"><span className="text-muted">Subtotal</span><span>{money.format(subtotal)}</span></div><div className="flex justify-between"><span className="text-muted">Total VAT</span><span>{money.format(totalVat)}</span></div><div className="flex justify-between text-base font-semibold"><span>Grand total</span><span>{money.format(grandTotal)}</span></div></div>
    </section>
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-panel"><label className="block text-sm font-semibold" htmlFor="footer-notes">Footer notes</label><textarea id="footer-notes" className="mt-2 block min-h-24 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/15" placeholder="Guarantees, delivery times, or offer validity..." value={footerNotes} onChange={(event) => setFooterNotes(event.target.value)} /></section>
    <div className="flex justify-end"><Button onClick={() => void save()} disabled={saving}><Check size={17} />{saving ? "Saving..." : "Save quotation"}</Button></div>
    <Modal open={clientModalOpen} onOpenChange={setClientModalOpen} title="Select client" description="Search by business name, tax ID, or phone.">
      <div className="space-y-3"><Input autoFocus placeholder="Search clients..." value={clientSearch} onChange={(event) => setClientSearch(event.target.value)} /><div className="max-h-64 overflow-y-auto">{visibleClients.length === 0 ? <p className="py-5 text-center text-sm text-muted">No clients found.</p> : visibleClients.map((candidate) => <button className="flex w-full items-center gap-3 rounded-lg p-3 text-left hover:bg-slate-50" key={candidate.id} onClick={() => { setClient(candidate); setClientModalOpen(false); }}><UserRound size={18} className="text-brand-600" /><span><span className="block text-sm font-semibold">{candidate.businessName}</span><span className="block text-xs text-muted">{candidate.taxId}</span></span></button>)}</div></div>
    </Modal>
  </div>;
}
