import React, { useMemo, useRef, useState } from 'react';
import { ScanLine, ArrowLeft, Camera, ImagePlus, Trash2, CheckCircle2, AlertCircle } from 'lucide-react';
import { ActiveModuleId } from '../../types';
import { getFourxCatalogue } from '../../services/productMasterService';
import type { FourxProductRecord } from '../../services/productMasterService';
import GuidedCamera from '../../scanner/components/GuidedCamera.jsx';
import GalleryScanner from '../../scanner/components/GalleryScanner.jsx';

interface OcrBillingModuleProps {
  onBackToDashboard: () => void;
  onSwitchModule: (module: ActiveModuleId) => void;
}
interface OcrBillLine { product: FourxProductRecord; quantity: number; }

export const OcrBillingModule: React.FC<OcrBillingModuleProps> = ({ onBackToDashboard, onSwitchModule }) => {
  const catalogue = useMemo(() => getFourxCatalogue(), []);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [galleryImageUrl, setGalleryImageUrl] = useState<string | null>(null);
  const [bill, setBill] = useState<OcrBillLine[]>([]);
  const [notice, setNotice] = useState('Ready to scan a FOUR-X product label.');
  const [lastScanned, setLastScanned] = useState<FourxProductRecord | null>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const addScannedProduct = (product: FourxProductRecord) => {
    const rawQuantity = window.prompt(`Quantity for ${product.item_name || product.description} (${product.sku})`, '1');
    if (rawQuantity === null) return;
    const quantity = Number(rawQuantity.trim());
    if (!Number.isInteger(quantity) || quantity <= 0) {
      setNotice('Please enter a valid whole-number quantity. Product was not added.');
      return;
    }
    setBill((current) => {
      const existing = current.find((line) => line.product.sku === product.sku);
      if (existing) return current.map((line) => line.product.sku === product.sku ? { ...line, quantity: line.quantity + quantity } : line);
      return [...current, { product, quantity }];
    });
    setLastScanned(product);
    setNotice(`Added ${product.sku} — ${quantity} pieces to the OCR bill.`);
  };

  const removeLine = (sku: string) => setBill((current) => current.filter((line) => line.product.sku !== sku));
  const totalQuantity = bill.reduce((sum, line) => sum + line.quantity, 0);

  const handleGalleryFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (galleryImageUrl) URL.revokeObjectURL(galleryImageUrl);
    setGalleryImageUrl(URL.createObjectURL(file));
  };

  const closeScanner = () => setScannerOpen(false);
  const closeGallery = () => {
    if (galleryImageUrl) URL.revokeObjectURL(galleryImageUrl);
    setGalleryImageUrl(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <button onClick={onBackToDashboard} className="p-2 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300" title="Back to Dashboard"><ArrowLeft className="w-4 h-4" /></button>
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-400"><span>ONE RETAIL AI</span><span>·</span><span className="text-cyan-400">Module 02</span><span>·</span><span>Original Scanner OCR Components</span></div>
            <h1 className="text-xl sm:text-2xl font-bold text-white mt-0.5">Camera / OCR Product Billing</h1>
            <p className="text-xs text-slate-400 mt-1">Original FOUR-X line scanner and Tesseract OCR connected to the canonical 531-product master.</p>
          </div>
        </div>
        <button onClick={() => onSwitchModule('rack-counting')} className="px-3 py-2 text-xs font-medium text-slate-300 bg-slate-900 border border-slate-800 rounded-lg hover:bg-slate-800">Rack Counting →</button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[0.9fr_1.1fr] gap-6">
        <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
          <div className="flex items-center gap-3"><div className="w-10 h-10 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400"><ScanLine className="w-5 h-5" /></div><div><h2 className="font-semibold text-white">Scan product code</h2><p className="text-xs text-slate-400">Position the FX numeric code inside the horizontal scan line.</p></div></div>
          <button onClick={() => setScannerOpen(true)} className="w-full flex items-center justify-center gap-3 rounded-xl bg-cyan-500 px-5 py-4 text-base font-bold text-slate-950 hover:bg-cyan-400"><Camera className="w-5 h-5" /> Start Live Line Scanner</button>
          <button onClick={() => galleryInputRef.current?.click()} className="w-full flex items-center justify-center gap-3 rounded-xl border border-slate-700 bg-slate-950 px-5 py-4 text-sm font-semibold text-slate-200 hover:bg-slate-800"><ImagePlus className="w-5 h-5" /> Scan Photo from Gallery</button>
          <input ref={galleryInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/*" className="hidden" onChange={handleGalleryFile} />
          <div className="rounded-lg border border-slate-700 bg-slate-950 p-3 text-sm text-slate-300 flex gap-2"><AlertCircle className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />{notice}</div>
          {lastScanned && <div className="rounded-lg border border-emerald-800 bg-emerald-950/30 p-3"><div className="flex items-center gap-2 text-emerald-300 text-sm font-semibold"><CheckCircle2 className="w-4 h-4" /> Last matched product</div><p className="mt-2 text-sm text-white">{lastScanned.item_name || lastScanned.description}</p><p className="text-xs text-emerald-300">{lastScanned.sku} · {lastScanned.base_code}</p></div>}
          <div className="text-xs text-slate-500">OCR reads the FX numeric code, then resolves all variants from <code>src/data/fourx.json</code>. Select the exact catalogue variant before adding it.</div>
        </section>

        <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
          <div className="flex items-center justify-between gap-3"><div><h2 className="font-semibold text-white">Customer bill · OCR</h2><p className="text-xs text-slate-400">{bill.length} product line(s) · {totalQuantity} pieces</p></div><button onClick={() => { setBill([]); setLastScanned(null); setNotice('OCR bill cleared.'); }} disabled={!bill.length} className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-40">Clear bill</button></div>
          {bill.length ? <div className="space-y-2">{bill.map((line) => <div key={line.product.sku} className="rounded-lg border border-slate-700 bg-slate-950 p-3 flex items-start justify-between gap-3"><div className="min-w-0"><div className="text-sm font-semibold text-white">{line.product.item_name || line.product.description}</div><div className="text-xs text-cyan-300 mt-1">{line.product.sku} · {line.product.base_code}</div><div className="text-xs text-slate-400 mt-1">Qty: {line.quantity} · Pack: {line.product.package_qty ?? '—'} · Outer: {line.product.outer_qty ?? '—'}</div></div><button onClick={() => removeLine(line.product.sku)} className="p-2 text-rose-400 hover:bg-rose-950/40 rounded-lg" title="Remove"><Trash2 className="w-4 h-4" /></button></div>)}</div> : <div className="rounded-lg border border-dashed border-slate-700 p-8 text-center text-sm text-slate-500">Your OCR bill is empty. Scan a product code to begin.</div>}
          <div className="border-t border-slate-800 pt-3 flex justify-between text-sm"><span className="text-slate-400">Total product lines</span><span className="text-white font-semibold">{bill.length}</span></div>
          <div className="flex justify-between text-sm"><span className="text-slate-400">Total quantity</span><span className="text-white font-semibold">{totalQuantity} pieces</span></div>
          <p className="text-xs text-amber-400">Rate calculation is intentionally deferred. This OCR bill currently tracks confirmed catalogue SKU and quantity only.</p>
        </section>
      </div>

      {scannerOpen && <GuidedCamera fourXMode products={catalogue} onProductSelect={addScannedProduct} onFinish={() => undefined} onClose={closeScanner} />}
      {galleryImageUrl && <GalleryScanner imageUrl={galleryImageUrl} fourXMode products={catalogue} onProductSelect={addScannedProduct} onFinish={() => undefined} onClose={closeGallery} />}
    </div>
  );
};
