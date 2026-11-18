import { ProductRecord } from './product.ts';

export interface InvoiceItem {
  id: string;
  product: ProductRecord;
  serialNumber: number;
  sku: string;
  baseCode: string;
  itemName: string;
  description: string;
  category: string;
  series?: string;
  variant?: string;
  colourCode?: string;
  module?: string;
  quantity: number;
  unitPrice?: number;
  amount?: number;
  priceType: 'verified_net' | 'verified_with_gst' | 'requires_verification' | 'unavailable';
  priceLabel: string;
  gstRate?: number;
}

export interface CustomerDetails {
  name: string;
  phone: string;
  companyName?: string;
  address?: string;
  invoiceNumber: string;
  date: string;
}

export interface InvoiceRecord {
  id: string;
  createdAt: string;
  updatedAt: string;
  customer: CustomerDetails;
  items: InvoiceItem[];
  totalQuantity: number;
  verifiedSubtotal: number;
  verifiedGstTotal: number;
  verifiedGrandTotal: number;
  unverifiedItemsCount: number;
  status: 'draft' | 'completed' | 'printed';
}

export interface ParsedVoiceCommand {
  rawTranscript: string;
  normalizedTranscript?: string;
  detectedLanguage?: 'gujarati' | 'hindi' | 'english' | 'mixed';
  intent?: 'category_switch' | 'select_series' | 'select_number' | 'add_product' | 'clear' | 'unknown';
  targetCategory?: 'SWITCH' | 'PLATES' | 'OTHER';
  selectedNumber?: number;
  series?: string;
  subGroup?: string;
  colour?: string;
  module?: string;
  ampere?: string;
  switchType?: string;
  variant?: string;
  indicator?: boolean;
  productType?: string;
  quantity?: number;
  missingAttributes?: string[];
  exactMatch?: ProductRecord;
  multipleMatches?: ProductRecord[];
  confidence: number;
  feedbackMessage?: string;
}
