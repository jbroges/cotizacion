import { useEffect, useState } from "react";
import { ImagePlus, Save } from "lucide-react";
import { appAPI, type CompanySettings } from "../api";
import { Button } from "../components/Button";
import { Input } from "../components/Input";

const emptySettings: CompanySettings = {
  businessName: "", taxId: "", phone: "", address: "", logoPath: "", defaultVatRate: 16,
};

export function SettingsView() {
  const [settings, setSettings] = useState(emptySettings);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    appAPI.getSettings().then(setSettings).catch((reason: Error) => setError(reason.message));
  }, []);

  const update = (field: keyof CompanySettings, value: string | number) =>
    setSettings((current) => ({ ...current, [field]: value }));

  async function save() {
    setError(""); setStatus("");
    try {
      await appAPI.saveSettings(settings);
      setStatus("Configuración guardada correctamente.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo guardar la configuración.");
    }
  }

  function selectLogo(file?: File) {
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Seleccione un archivo de imagen válido."); return; }
    const reader = new FileReader();
    reader.onload = () => update("logoPath", String(reader.result));
    reader.onerror = () => setError("No se pudo leer el archivo de logo.");
    reader.readAsDataURL(file);
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <p className="text-sm text-muted">Perfil del emisor</p>
        <h2 className="mt-1 text-2xl font-semibold">Datos de la empresa</h2>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-panel">
        <div className="grid gap-5 sm:grid-cols-2">
          <Input label="Razón Social / Nombre de la empresa *" value={settings.businessName} onChange={(event) => update("businessName", event.target.value)} />
          <Input label="Identificación Fiscal (RUT/NIF/RFC/CIF) *" value={settings.taxId} onChange={(event) => update("taxId", event.target.value)} />
          <Input label="Teléfono" value={settings.phone} onChange={(event) => update("phone", event.target.value)} />
          <Input label="Tasa de IVA por defecto (%)" type="number" min="0" max="100" step="0.01" value={settings.defaultVatRate} onChange={(event) => update("defaultVatRate", Number(event.target.value))} />
          <label className="space-y-1.5 sm:col-span-2">
            <span className="text-sm font-medium text-slate-700">Dirección</span>
            <textarea className="block min-h-24 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/15" placeholder="Dirección fiscal o comercial..." value={settings.address} onChange={(event) => update("address", event.target.value)} />
          </label>
        </div>
        <div className="mt-6 rounded-lg border border-dashed border-slate-300 p-5">
          <div className="flex items-center gap-4">
            {settings.logoPath ? (
              <img className="h-16 w-16 rounded-lg object-contain" src={settings.logoPath} alt="Vista previa del logo" />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
                <ImagePlus size={24} />
              </div>
            )}
            <div>
              <p className="text-sm font-medium">Logo de la empresa</p>
              <p className="mt-1 text-xs text-muted">Formatos compatibles: PNG, JPG o GIF</p>
              <label className="mt-3 inline-flex cursor-pointer text-sm font-semibold text-brand-600 hover:text-brand-700">
                Seleccionar archivo
                <input className="sr-only" type="file" accept="image/*" onChange={(event) => selectLogo(event.target.files?.[0])} />
              </label>
            </div>
          </div>
        </div>
        {(error || status) && (
          <p className={`mt-4 text-sm ${error ? "text-red-600" : "text-emerald-600"}`}>{error || status}</p>
        )}
        <div className="mt-6 flex justify-end">
          <Button onClick={save}>
            <Save size={16} />Guardar configuración
          </Button>
        </div>
      </div>
    </div>
  );
}
