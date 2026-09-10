import { useState } from "react";
import { createRoot } from "react-dom/client";
import { FileText, LayoutDashboard, Menu, Settings, Users, X } from "lucide-react";
import { Button } from "./components/Button";
import { DataTable, type DataTableColumn } from "./components/DataTable";
import { Input } from "./components/Input";
import { ClientsView } from "./modules/ClientsView";
import { SettingsView } from "./modules/SettingsView";
import "./styles.css";

type Section = "Dashboard" | "Clients" | "Quotations" | "Settings";

const navigation = [
  { label: "Dashboard", icon: LayoutDashboard },
  { label: "Clients", icon: Users },
  { label: "Quotations", icon: FileText },
  { label: "Settings", icon: Settings },
] as const;

const sampleQuotations = [
  { id: "COT-0001", client: "Acme Industries", date: "Sep 10, 2026", total: "$1,450.00", status: "Draft" },
  { id: "COT-0002", client: "Northstar Labs", date: "Sep 08, 2026", total: "$820.00", status: "Sent" },
];

function App() {
  const [section, setSection] = useState<Section>("Dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      <aside className={`fixed inset-y-0 left-0 z-30 flex w-64 flex-col border-r border-slate-200 bg-white transition-transform lg:static lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex h-20 items-center justify-between px-6">
          <div><p className="text-lg font-bold tracking-tight text-ink">x57<span className="text-brand-600">Quote</span></p><p className="text-xs text-slate-400">Quote management</p></div>
          <button className="text-slate-400 lg:hidden" onClick={() => setSidebarOpen(false)} aria-label="Close navigation"><X size={20} /></button>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-5" aria-label="Main navigation">
          {navigation.map(({ label, icon: Icon }) => (
            <button className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${section === label ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-50 hover:text-ink"}`} key={label} onClick={() => { setSection(label); setSidebarOpen(false); }}>
              <Icon size={18} strokeWidth={section === label ? 2.5 : 2} />{label}
            </button>
          ))}
        </nav>
        <div className="border-t border-slate-100 p-4 text-xs text-slate-400">Offline workspace</div>
      </aside>
      {sidebarOpen && <button className="fixed inset-0 z-20 bg-slate-950/20 lg:hidden" onClick={() => setSidebarOpen(false)} aria-label="Close navigation overlay" />}
      <main className="min-w-0 flex-1">
        <header className="flex h-20 items-center justify-between border-b border-slate-200 bg-white px-5 sm:px-8">
          <div className="flex items-center gap-3"><button className="text-slate-500 lg:hidden" onClick={() => setSidebarOpen(true)} aria-label="Open navigation"><Menu size={22} /></button><div><p className="text-sm text-slate-500">Workspace</p><h1 className="text-xl font-semibold text-ink">{section}</h1></div></div>
          <Button variant="primary" onClick={() => setSection("Quotations")}>New quotation</Button>
        </header>
        <div className="mx-auto max-w-7xl p-5 sm:p-8">
          {section === "Dashboard" ? <Dashboard onNavigate={setSection} /> : section === "Clients" ? <ClientsView /> : section === "Settings" ? <SettingsView /> : <SectionPlaceholder section={section} />}
        </div>
      </main>
    </div>
  );
}

function Dashboard({ onNavigate }: { onNavigate: (section: Section) => void }) {
  const columns: DataTableColumn<(typeof sampleQuotations)[number]>[] = [
    { key: "id", header: "Quotation ID", render: (row) => <span className="font-semibold text-ink">{row.id}</span> },
    { key: "client", header: "Client", render: (row) => row.client },
    { key: "date", header: "Date", render: (row) => row.date },
    { key: "status", header: "Status", render: (row) => <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">{row.status}</span> },
    { key: "total", header: "Total", className: "text-right", render: (row) => <span className="font-semibold text-ink">{row.total}</span> },
  ];
  return <div className="space-y-8"><div><p className="text-sm text-muted">Welcome back</p><h2 className="mt-1 text-2xl font-semibold tracking-tight">Overview</h2></div>
    <div className="grid gap-4 sm:grid-cols-3">{[["Total quotations", "24"], ["This month", "8"], ["Total billed", "$12,840"]].map(([label, value]) => <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-panel" key={label}><p className="text-sm text-muted">{label}</p><p className="mt-3 text-2xl font-semibold">{value}</p></div>)}</div>
    <div className="flex items-center justify-between"><h3 className="text-lg font-semibold">Recent quotations</h3><Button variant="ghost" onClick={() => onNavigate("Quotations")}>View all</Button></div><DataTable columns={columns} rows={sampleQuotations} rowKey={(row) => row.id} /></div>;
}

function SectionPlaceholder({ section }: { section: Section }) {
  return <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center"><h2 className="text-xl font-semibold">{section}</h2><p className="mt-2 text-sm text-muted">This workspace is ready for the next module.</p><Input className="mx-auto mt-6 max-w-sm" placeholder={`Search ${section.toLowerCase()}...`} /></div>;
}

createRoot(document.getElementById("root")!).render(<App />);
