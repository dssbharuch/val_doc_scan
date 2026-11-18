import { ProductRecord } from '../types/product.ts';
import { InvoiceItem, InvoiceRecord, CustomerDetails } from '../types/invoice.ts';

const DRAFT_STORAGE_KEY = 'fourx_invoice_draft_v1';
const HISTORY_STORAGE_KEY = 'fourx_invoice_history_v1';

export function resolveProductPrice(product: ProductRecord): {
  unitPrice?: number;
  priceType: 'verified_net' | 'verified_with_gst' | 'requires_verification' | 'unavailable';
  priceLabel: string;
} {
  // 1. Plates with printed net rate or with GST
  if (product.net_rate_as_printed !== undefined && product.net_rate_as_printed > 0) {
    return {
      unitPrice: product.net_rate_as_printed,
      priceType: 'verified_net',
      priceLabel: `₹${product.net_rate_as_printed.toFixed(2)} (Net Printed)`,
    };
  }

  if (product.with_gst_as_printed !== undefined && product.with_gst_as_printed > 0) {
    return {
      unitPrice: product.with_gst_as_printed,
      priceType: 'verified_with_gst',
      priceLabel: `₹${product.with_gst_as_printed.toFixed(2)} (Incl. GST Printed)`,
    };
  }

  // 2. Check if product requires header review (per Section 11)
  if (product.needs_review || product.price_column_mapping === 'requires_header_review') {
    return {
      unitPrice: undefined,
      priceType: 'requires_verification',
      priceLabel: 'Price requires verification',
    };
  }

  // 3. Fallback if price is unavailable
  return {
    unitPrice: undefined,
    priceType: 'unavailable',
    priceLabel: 'Price unavailable',
  };
}

export function createDefaultCustomerDetails(): CustomerDetails {
  const dateStr = new Date().toISOString().split('T')[0];
  const randNum = Math.floor(1000 + Math.random() * 9000);
  return {
    name: 'Walk-in Customer',
    phone: '',
    invoiceNumber: `FX-INV-${dateStr.replace(/-/g, '')}-${randNum}`,
    date: dateStr,
  };
}

export function calculateInvoiceTotals(items: InvoiceItem[]): {
  totalQuantity: number;
  verifiedSubtotal: number;
  verifiedGstTotal: number;
  verifiedGrandTotal: number;
  unverifiedItemsCount: number;
} {
  let totalQuantity = 0;
  let verifiedSubtotal = 0;
  let unverifiedItemsCount = 0;

  for (const item of items) {
    totalQuantity += item.quantity;
    if (item.unitPrice !== undefined && item.unitPrice > 0) {
      verifiedSubtotal += item.unitPrice * item.quantity;
    } else {
      unverifiedItemsCount++;
    }
  }

  // Round to 2 decimal places
  const subtotalRounded = Math.round(verifiedSubtotal * 100) / 100;
  const grandTotalRounded = subtotalRounded; // If prices are net, grand total is verified subtotal without inventing arbitrary tax rates

  return {
    totalQuantity,
    verifiedSubtotal: subtotalRounded,
    verifiedGstTotal: 0,
    verifiedGrandTotal: grandTotalRounded,
    unverifiedItemsCount,
  };
}

export class InvoiceService {
  public static loadDraft(): InvoiceRecord {
    try {
      const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(DRAFT_STORAGE_KEY) : null;
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && Array.isArray(parsed.items)) {
          const totals = calculateInvoiceTotals(parsed.items);
          return {
            ...parsed,
            ...totals,
          };
        }
      }
    } catch (e) {
      console.warn('Failed to load invoice draft from localStorage:', e);
    }

    const defaultCustomer = createDefaultCustomerDetails();
    return {
      id: `inv_${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      customer: defaultCustomer,
      items: [],
      totalQuantity: 0,
      verifiedSubtotal: 0,
      verifiedGstTotal: 0,
      verifiedGrandTotal: 0,
      unverifiedItemsCount: 0,
      status: 'draft',
    };
  }

  public static saveDraft(invoice: InvoiceRecord): void {
    try {
      if (typeof localStorage === 'undefined') return;
      const totals = calculateInvoiceTotals(invoice.items);
      const updated: InvoiceRecord = {
        ...invoice,
        ...totals,
        updatedAt: new Date().toISOString(),
      };
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn('Failed to save invoice draft to localStorage:', e);
    }
  }

  public static addItem(
    invoice: InvoiceRecord,
    product: ProductRecord,
    quantity: number,
    allowSeparateLine = false
  ): { invoice: InvoiceRecord; addedItem: InvoiceItem; isUpdate: boolean } {
    const qty = Math.max(1, Math.round(quantity));
    const items = [...invoice.items];
    const existingIndex = items.findIndex((i) => i.sku === product.sku);

    let isUpdate = false;
    let targetItem: InvoiceItem;

    if (existingIndex >= 0 && !allowSeparateLine) {
      // Rule 10: Repeated selection of same SKU updates quantity
      const existing = items[existingIndex];
      const newQty = existing.quantity + qty;
      const unitPrice = existing.unitPrice;
      const amount = unitPrice !== undefined ? Math.round(unitPrice * newQty * 100) / 100 : undefined;

      targetItem = {
        ...existing,
        quantity: newQty,
        amount,
      };
      items[existingIndex] = targetItem;
      isUpdate = true;
    } else {
      const pricing = resolveProductPrice(product);
      const amount = pricing.unitPrice !== undefined ? Math.round(pricing.unitPrice * qty * 100) / 100 : undefined;

      targetItem = {
        id: `item_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        product,
        serialNumber: items.length + 1,
        sku: product.sku,
        baseCode: product.base_code,
        itemName: product.item_name || product.description,
        description: product.description,
        category: product.current_group || product.product_group || product.category || 'General',
        series: product.series,
        variant: product.variant,
        colourCode: product.colour_code || product.original_alpha_code,
        module: product.description.match(/(^|\s)(\d+M(?:\s*\([^)]+\))?)/i)?.[2] || undefined,
        quantity: qty,
        unitPrice: pricing.unitPrice,
        amount,
        priceType: pricing.priceType,
        priceLabel: pricing.priceLabel,
      };
      items.push(targetItem);
    }

    // Renumber serial numbers
    const renumbered = items.map((it, idx) => ({ ...it, serialNumber: idx + 1 }));
    const totals = calculateInvoiceTotals(renumbered);
    const updatedInvoice: InvoiceRecord = {
      ...invoice,
      items: renumbered,
      ...totals,
      updatedAt: new Date().toISOString(),
    };

    InvoiceService.saveDraft(updatedInvoice);
    return { invoice: updatedInvoice, addedItem: targetItem, isUpdate };
  }

  public static updateQuantity(invoice: InvoiceRecord, itemId: string, newQuantity: number): InvoiceRecord {
    const qty = Math.max(1, Math.round(newQuantity));
    const items = invoice.items.map((it) => {
      if (it.id === itemId) {
        const amount = it.unitPrice !== undefined ? Math.round(it.unitPrice * qty * 100) / 100 : undefined;
        return { ...it, quantity: qty, amount };
      }
      return it;
    });

    const totals = calculateInvoiceTotals(items);
    const updatedInvoice: InvoiceRecord = {
      ...invoice,
      items,
      ...totals,
      updatedAt: new Date().toISOString(),
    };

    InvoiceService.saveDraft(updatedInvoice);
    return updatedInvoice;
  }

  public static removeItem(invoice: InvoiceRecord, itemId: string): InvoiceRecord {
    const items = invoice.items
      .filter((it) => it.id !== itemId)
      .map((it, idx) => ({ ...it, serialNumber: idx + 1 }));

    const totals = calculateInvoiceTotals(items);
    const updatedInvoice: InvoiceRecord = {
      ...invoice,
      items,
      ...totals,
      updatedAt: new Date().toISOString(),
    };

    InvoiceService.saveDraft(updatedInvoice);
    return updatedInvoice;
  }

  public static clearInvoice(): InvoiceRecord {
    const defaultCustomer = createDefaultCustomerDetails();
    const freshInvoice: InvoiceRecord = {
      id: `inv_${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      customer: defaultCustomer,
      items: [],
      totalQuantity: 0,
      verifiedSubtotal: 0,
      verifiedGstTotal: 0,
      verifiedGrandTotal: 0,
      unverifiedItemsCount: 0,
      status: 'draft',
    };
    InvoiceService.saveDraft(freshInvoice);
    return freshInvoice;
  }

  public static saveToHistory(invoice: InvoiceRecord): void {
    try {
      const historyStr = localStorage.getItem(HISTORY_STORAGE_KEY);
      const list: InvoiceRecord[] = historyStr ? JSON.parse(historyStr) : [];
      list.unshift(invoice);
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(list.slice(0, 50)));
    } catch (e) {
      console.warn('Failed to save invoice to history:', e);
    }
  }
}
