export namespace database {
	
	export class Client {
	    id: string;
	    businessName: string;
	    taxId: string;
	    phone: string;
	    address: string;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new Client(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.businessName = source["businessName"];
	        this.taxId = source["taxId"];
	        this.phone = source["phone"];
	        this.address = source["address"];
	        this.createdAt = source["createdAt"];
	    }
	}
	export class CompanySettings {
	    businessName: string;
	    taxId: string;
	    phone: string;
	    address: string;
	    logoPath: string;
	    defaultVatRate: number;
	
	    static createFrom(source: any = {}) {
	        return new CompanySettings(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.businessName = source["businessName"];
	        this.taxId = source["taxId"];
	        this.phone = source["phone"];
	        this.address = source["address"];
	        this.logoPath = source["logoPath"];
	        this.defaultVatRate = source["defaultVatRate"];
	    }
	}
	export class QuotationItem {
	    id: string;
	    description: string;
	    unitPrice: number;
	    vatRate: number;
	    subtotal: number;
	
	    static createFrom(source: any = {}) {
	        return new QuotationItem(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.description = source["description"];
	        this.unitPrice = source["unitPrice"];
	        this.vatRate = source["vatRate"];
	        this.subtotal = source["subtotal"];
	    }
	}
	export class CreateQuotationRequest {
	    clientId: string;
	    items: QuotationItem[];
	    footerNotes: string;
	
	    static createFrom(source: any = {}) {
	        return new CreateQuotationRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.clientId = source["clientId"];
	        this.items = this.convertValues(source["items"], QuotationItem);
	        this.footerNotes = source["footerNotes"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Quotation {
	    id: string;
	    clientId: string;
	    subtotal: number;
	    totalVat: number;
	    grandTotal: number;
	    footerNotes: string;
	    items: QuotationItem[];
	
	    static createFrom(source: any = {}) {
	        return new Quotation(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.clientId = source["clientId"];
	        this.subtotal = source["subtotal"];
	        this.totalVat = source["totalVat"];
	        this.grandTotal = source["grandTotal"];
	        this.footerNotes = source["footerNotes"];
	        this.items = this.convertValues(source["items"], QuotationItem);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	export class QuotationSummary {
	    id: string;
	    clientId: string;
	    clientName: string;
	    subtotal: number;
	    totalVat: number;
	    grandTotal: number;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new QuotationSummary(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.clientId = source["clientId"];
	        this.clientName = source["clientName"];
	        this.subtotal = source["subtotal"];
	        this.totalVat = source["totalVat"];
	        this.grandTotal = source["grandTotal"];
	        this.createdAt = source["createdAt"];
	    }
	}

}

