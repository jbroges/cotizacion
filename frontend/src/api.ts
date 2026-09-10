export interface CompanySettings {
  businessName: string;
  taxId: string;
  phone: string;
  address: string;
  logoPath: string;
  defaultVatRate: number;
}

export interface Client {
  id: string;
  businessName: string;
  taxId: string;
  phone: string;
  address: string;
  createdAt: string;
}

export interface QuotationItem {
  id: string;
  description: string;
  unitPrice: number;
  vatRate: number;
  subtotal: number;
}

export interface CreateQuotationRequest {
  clientId: string;
  items: QuotationItem[];
  footerNotes: string;
}

export interface Quotation {
  id: string;
  clientId: string;
  subtotal: number;
  totalVat: number;
  grandTotal: number;
  footerNotes: string;
  items: QuotationItem[];
}

interface BackendAPI {
  GetSettings(): Promise<CompanySettings>;
  SaveSettings(settings: CompanySettings): Promise<void>;
  GetClients(): Promise<Client[]>;
  CreateClient(client: Omit<Client, "id" | "createdAt">): Promise<Client>;
  UpdateClient(client: Client): Promise<void>;
  DeleteClient(id: string): Promise<void>;
  CreateQuotation(request: CreateQuotationRequest): Promise<Quotation>;
}

declare global {
  interface Window {
    go?: { app?: { App?: BackendAPI } };
  }
}

function backend(): BackendAPI {
  const api = window.go?.app?.App;
  if (!api) throw new Error("The Wails backend is not available.");
  return api;
}

export const appAPI = {
  getSettings: () => backend().GetSettings(),
  saveSettings: (settings: CompanySettings) => backend().SaveSettings(settings),
  getClients: () => backend().GetClients(),
  createClient: (client: Omit<Client, "id" | "createdAt">) => backend().CreateClient(client),
  updateClient: (client: Client) => backend().UpdateClient(client),
  deleteClient: (id: string) => backend().DeleteClient(id),
  createQuotation: (request: CreateQuotationRequest) => backend().CreateQuotation(request),
};
