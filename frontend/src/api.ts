export interface CompanySettings {
  businessName: string;
  taxId: string;
  phone: string;
  address: string;
  logoPath: string;
  defaultVatRate: number;
  quotationExpirationHours: number;
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
  quantity: number;
  unitPrice: number;
  vatRate: number;
  applyVat: boolean;
  subtotal: number;
}

export interface CreateQuotationRequest {
  clientId: string;
  items: QuotationItem[];
  footerNotes: string;
}

export interface Quotation {
  id: number;
  clientId: string;
  subtotal: number;
  totalVat: number;
  grandTotal: number;
  status: "pending" | "approved" | "rejected" | "cancelled" | "expired";
  footerNotes: string;
  items: QuotationItem[];
  createdAt: string;
}

export interface QuotationSummary {
  id: number;
  clientId: string;
  clientName: string;
  subtotal: number;
  totalVat: number;
  grandTotal: number;
  status: "pending" | "approved" | "rejected" | "cancelled" | "expired";
  createdAt: string;
}

interface BackendAPI {
  GetSettings(): Promise<CompanySettings>;
  SaveSettings(settings: CompanySettings): Promise<void>;
  GetClients(): Promise<Client[]>;
  CreateClient(client: Omit<Client, "id" | "createdAt">): Promise<Client>;
  UpdateClient(client: Client): Promise<void>;
  DeleteClient(id: string): Promise<void>;
  CreateQuotation(request: CreateQuotationRequest): Promise<Quotation>;
  GetQuotations(): Promise<QuotationSummary[]>;
  GetQuotation(id: number): Promise<Quotation>;
  DownloadQuotation(id: number): Promise<string | number[]>;
  UpdateQuotationStatus(id: number, status: string): Promise<void>;
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
  getQuotations: () => backend().GetQuotations(),
  getQuotation: (id: number) => backend().GetQuotation(id),
  downloadQuotation: (id: number) => backend().DownloadQuotation(id),
  updateQuotationStatus: (id: number, status: string) => backend().UpdateQuotationStatus(id, status),
};
