import { useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { appAPI, type Client } from "../api";
import { Button } from "../components/Button";
import { DataTable, type DataTableColumn } from "../components/DataTable";
import { Input } from "../components/Input";
import { Modal } from "../components/Modal";

type ClientForm = Omit<Client, "id" | "createdAt">;
const emptyClient: ClientForm = { businessName: "", taxId: "", phone: "", address: "" };

export function ClientsView() {
  const [clients, setClients] = useState<Client[]>([]);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Client | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<ClientForm>(emptyClient);
  const [error, setError] = useState("");

  function reload() { return appAPI.getClients().then(setClients).catch((reason: Error) => setError(reason.message)); }
  useEffect(() => { void reload(); }, []);
  const visible = useMemo(() => clients.filter((client) => `${client.businessName} ${client.taxId} ${client.phone}`.toLowerCase().includes(query.toLowerCase())), [clients, query]);
  const update = (field: keyof ClientForm, value: string) => setForm((current) => ({ ...current, [field]: value }));
  function openNew() { setError(""); setForm(emptyClient); setEditing(null); setModalOpen(true); }
  function openEdit(client: Client) { setError(""); setForm(client); setEditing(client); setModalOpen(true); }
  async function save() {
    try {
      if (editing) await appAPI.updateClient({ ...editing, ...form });
      else await appAPI.createClient(form);
      setEditing(null); setModalOpen(false); await reload();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to save client."); }
  }
  async function remove(client: Client) {
    if (!window.confirm(`Delete ${client.businessName}?`)) return;
    try { await appAPI.deleteClient(client.id); await reload(); } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to delete client."); }
  }
  const columns: DataTableColumn<Client>[] = [
    { key: "businessName", header: "Business name", render: (client) => <span className="font-semibold text-ink">{client.businessName}</span> },
    { key: "taxId", header: "Tax ID", render: (client) => client.taxId },
    { key: "phone", header: "Phone", render: (client) => client.phone || "—" },
    { key: "address", header: "Address", render: (client) => client.address || "—" },
    { key: "actions", header: "Actions", className: "text-right", render: (client) => <span className="inline-flex gap-1"><Button variant="ghost" aria-label={`Edit ${client.businessName}`} onClick={() => openEdit(client)}><Pencil size={16} /></Button><Button variant="danger" aria-label={`Delete ${client.businessName}`} onClick={() => void remove(client)}><Trash2 size={16} /></Button></span> },
  ];
  return <div className="space-y-6">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm text-muted">Customer directory</p><h2 className="mt-1 text-2xl font-semibold">Clients</h2></div><Button onClick={openNew}><Plus size={17} />New client</Button></div>
    <div className="relative max-w-md"><Search className="absolute left-3 top-2.5 text-slate-400" size={18} /><Input className="pl-10" placeholder="Search clients..." value={query} onChange={(event) => setQuery(event.target.value)} /></div>
    {error && <p className="text-sm text-red-600">{error}</p>}
    <DataTable columns={columns} rows={visible} rowKey={(client) => client.id} emptyMessage="No clients found." />
    <Modal open={modalOpen} onOpenChange={(open) => { setModalOpen(open); if (!open) setEditing(null); }} title={editing ? "Edit client" : "New client"} description="Keep the billing details up to date.">
      <div className="space-y-4"><Input label="Business name *" value={form.businessName} onChange={(event) => update("businessName", event.target.value)} /><Input label="Tax ID *" value={form.taxId} onChange={(event) => update("taxId", event.target.value)} /><div className="grid gap-4 sm:grid-cols-2"><Input label="Phone" value={form.phone} onChange={(event) => update("phone", event.target.value)} /><Input label="Address" value={form.address} onChange={(event) => update("address", event.target.value)} /></div><div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button><Button onClick={() => void save()}>Save client</Button></div></div>
    </Modal>
  </div>;
}
