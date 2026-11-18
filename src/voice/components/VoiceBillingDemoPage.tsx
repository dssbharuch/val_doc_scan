import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Mic, MicOff, Plus, Trash2, Receipt, Volume2, CheckCircle2, AlertCircle, RotateCcw } from 'lucide-react';
import { getVoiceCatalogue } from '../services/voiceCatalogueAdapter.ts';
import type { ProductRecord } from '../types/product.ts';
import type { ParsedVoiceCommand } from '../types/invoice.ts';
import { speechService, type SupportedLanguage } from '../services/speechService.ts';
import { parseInvoiceVoiceCommand } from '../services/invoiceVoiceParser.ts';
import { resolveProductPrice } from '../services/invoiceService.ts';

type DemoLine = { id: string; product: ProductRecord; quantity: number; manualUnitPrice?: number };
type Activity = { id: string; spoken: string; normalized: string; outcome: string; tone: 'success' | 'warning' | 'error' };

const catalogue = getVoiceCatalogue();

// Conservative repairs for common English-mode Gujarati-accented ASR output.
// These repairs only normalize known attribute/quantity phrases; they never create products.
function normalizeDemoTranscript(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\bempier\b|\bempire\b|\bempear\b/g, 'ampere')
    .replace(/\bpanchnan\b/g, 'panch nang')
    .replace(/\bpanch\s*nan\b/g, 'panch nang')
    .replace(/\bpanchnang\b/g, 'panch nang')
    .replace(/\bpanchnum\b/g, 'panch nang')
    .replace(/\s+/g, ' ')
    .trim();
}


// Split a single merchant utterance into product-sized commands when multiple
// catalogue families are spoken in sequence (e.g. "grace ... glide ...").
// Each segment is still resolved by the existing invoice parser and catalogue.
function splitMultiProductCommands(raw: string): string[] {
  const familyPattern = /\b(grace|grase|glide|glid|glam|tesla|oro|orion|ovius|f\s*[- ]?touch)\b/gi;
  const starts: number[] = [];
  let match: RegExpExecArray | null;
  while ((match = familyPattern.exec(raw)) !== null) starts.push(match.index);
  if (starts.length < 2) return [raw.trim()];

  const segments: string[] = [];
  for (let i = 0; i < starts.length; i++) {
    const start = i === 0 ? 0 : starts[i];
    const end = i + 1 < starts.length ? starts[i + 1] : raw.length;
    const segment = raw.slice(start, end).trim();
    if (segment) segments.push(segment);
  }
  return segments.length > 1 ? segments : [raw.trim()];
}

function money(value?: number): string {
  return value === undefined ? 'Verify price' : `₹${value.toFixed(2)}`;
}

export const VoiceBillingDemoPage: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [language, setLanguage] = useState<SupportedLanguage>('en-IN');
  const [listening, setListening] = useState(false);
  const [spokenInput, setSpokenInput] = useState('');
  const [manualInput, setManualInput] = useState('');
  const [lastParsed, setLastParsed] = useState<ParsedVoiceCommand | null>(null);
  const [lines, setLines] = useState<DemoLine[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [pendingMatches, setPendingMatches] = useState<ProductRecord[]>([]);
  const [pendingQuantity, setPendingQuantity] = useState<number | undefined>();
  const [quantityText, setQuantityText] = useState('');
  const [status, setStatus] = useState('Ready. Speak one product and quantity at a time.');
  const [customer, setCustomer] = useState('Walk-in Customer');
  const lastCommandRef = useRef('');

  const stopMic = useCallback(() => {
    speechService.stopListening();
    setListening(false);
  }, []);

  useEffect(() => () => speechService.stopListening(), []);

  const addProduct = useCallback((product: ProductRecord, quantity: number, spoken: string, normalized: string) => {
    const qty = Math.max(1, Math.floor(quantity));
    setLines((current) => {
      const existing = current.find((line) => line.product.sku === product.sku);
      if (existing) return current.map((line) => line.product.sku === product.sku ? { ...line, quantity: line.quantity + qty } : line);
      return [...current, { id: `${product.sku}-${Date.now()}`, product, quantity: qty }];
    });
    setActivity((current) => [{
      id: `${Date.now()}-${Math.random()}`,
      spoken,
      normalized,
      outcome: `Added ${qty} × ${product.item_name || product.description} (${product.sku})`,
      tone: 'success' as const,
    }, ...current].slice(0, 8));
    setPendingMatches([]);
    setPendingQuantity(undefined);
    setQuantityText('');
    setLastParsed(null);
    setStatus(`Added ${product.sku} — ${qty} nang.`);
  }, []);

  const processCommand = useCallback((raw: string) => {
    const spoken = raw.trim();
    if (!spoken) {
      setStatus('Please type or speak a product command before processing.');
      return;
    }
    if (spoken === lastCommandRef.current) return;
    lastCommandRef.current = spoken;
    const normalized = normalizeDemoTranscript(spoken);
    setSpokenInput(spoken);
    setManualInput(normalized);

    const commands = splitMultiProductCommands(normalized);
    if (commands.length > 1) {
      let addedCount = 0;
      let unresolvedCount = 0;
      let lastResult: ParsedVoiceCommand | null = null;
      const normalizedSegments: string[] = [];

      for (const command of commands) {
        const parsed = parseInvoiceVoiceCommand(command, catalogue, 'SWITCH');
        lastResult = parsed;
        if (parsed.normalizedTranscript) normalizedSegments.push(parsed.normalizedTranscript);
        else normalizedSegments.push(command);

        if (parsed.exactMatch && parsed.quantity && parsed.quantity > 0) {
          addProduct(parsed.exactMatch, parsed.quantity, spoken, command);
          addedCount++;
          continue;
        }

        if (parsed.exactMatch || parsed.multipleMatches?.length) {
          unresolvedCount++;
          setPendingMatches(parsed.multipleMatches?.slice(0, 12) || [parsed.exactMatch!]);
          setPendingQuantity(parsed.quantity);
          setQuantityText('');
          setStatus(parsed.feedbackMessage || 'Please confirm the remaining product and quantity.');
          setActivity((current) => [{
            id: `${Date.now()}-${Math.random()}`, spoken: command, normalized: command,
            outcome: parsed.multipleMatches?.length
              ? `Needs clarification: ${parsed.multipleMatches.length} catalogue matches.`
              : `Found ${parsed.exactMatch?.sku}; please enter quantity.`,
            tone: 'warning' as const,
          }, ...current].slice(0, 8));
          continue;
        }

        unresolvedCount++;
        setActivity((current) => [{
          id: `${Date.now()}-${Math.random()}`, spoken: command, normalized: command,
          outcome: parsed.feedbackMessage || 'No catalogue match.', tone: 'error' as const,
        }, ...current].slice(0, 8));
      }

      setLastParsed(lastResult ? { ...lastResult, normalizedTranscript: normalizedSegments.join('  |  ') } : null);
      if (unresolvedCount > 0) {
        setStatus(`${addedCount} product(s) added. ${unresolvedCount} product(s) need clarification or could not be matched.`);
      } else {
        setPendingMatches([]);
        setPendingQuantity(undefined);
        setQuantityText('');
        setStatus(`Successfully added ${addedCount} products to the bill.`);
      }
      return;
    }

    const parsed = parseInvoiceVoiceCommand(normalized, catalogue, 'SWITCH');
    setLastParsed(parsed);

    if (parsed.exactMatch) {
      if (parsed.quantity && parsed.quantity > 0) {
        addProduct(parsed.exactMatch, parsed.quantity, spoken, normalized);
      } else {
        setPendingMatches([parsed.exactMatch]);
        setPendingQuantity(undefined);
        setStatus('Product found. Quantity is still required.');
        setActivity((current) => [{ id: `${Date.now()}`, spoken, normalized, outcome: `Found ${parsed.exactMatch?.sku}; please enter quantity.`, tone: 'warning' as const }, ...current].slice(0, 8));
      }
      return;
    }

    if (parsed.multipleMatches?.length) {
      setPendingMatches(parsed.multipleMatches.slice(0, 12));
      setPendingQuantity(parsed.quantity);
      setStatus(parsed.feedbackMessage || 'More than one product matches. Choose the exact product.');
      setActivity((current) => [{ id: `${Date.now()}`, spoken, normalized, outcome: `Needs clarification: ${parsed.multipleMatches?.length} catalogue matches.`, tone: 'warning' as const }, ...current].slice(0, 8));
      return;
    }

    setPendingMatches([]);
    setStatus(parsed.feedbackMessage || 'No exact catalogue product was found. Please say it again or edit the recognized words.');
    setActivity((current) => [{ id: `${Date.now()}`, spoken, normalized, outcome: parsed.feedbackMessage || 'No catalogue match.', tone: 'error' as const }, ...current].slice(0, 8));
  }, [addProduct]);

  const toggleMic = () => {
    if (listening) {
      stopMic();
      setStatus('Microphone stopped.');
      return;
    }
    lastCommandRef.current = '';
    const started = speechService.startListening(language, {
      onStart: () => { setListening(true); setStatus('Listening… speak one item with quantity.'); },
      onModeChange: (mode) => setListening(mode === 'listening'),
      onResult: (transcript) => processCommand(transcript),
      onError: (message) => { setListening(false); setStatus(message); },
      onEnd: () => setListening(false),
    }, 'listening');
    if (!started) setStatus('Speech recognition could not start. Use Chrome/Edge and allow microphone access.');
    else setListening(true);
  };

  const submitManual = () => {
    lastCommandRef.current = '';
    const command = manualInput.trim() || spokenInput.trim();
    processCommand(command);
  };

  const totalQuantity = lines.reduce((sum, line) => sum + line.quantity, 0);
  const pricedSubtotal = lines.reduce((sum, line) => {
    const cataloguePrice = resolveProductPrice(line.product).unitPrice;
    const price = cataloguePrice ?? line.manualUnitPrice;
    return sum + (price !== undefined ? price * line.quantity : 0);
  }, 0);
  const unpricedCount = lines.filter((line) => resolveProductPrice(line.product).unitPrice === undefined && line.manualUnitPrice === undefined).length;

  const updateManualPrice = (lineId: string, rawValue: string) => {
    const parsed = rawValue.trim() === '' ? undefined : Number(rawValue);
    setLines((current) => current.map((line) => line.id === lineId
      ? { ...line, manualUnitPrice: parsed !== undefined && Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * 100) / 100 : undefined }
      : line));
  };

  const addPending = (product: ProductRecord) => {
    const qty = pendingQuantity || Number(quantityText);
    if (!Number.isFinite(qty) || qty <= 0) {
      setStatus('Please enter a valid quantity before adding this product.');
      return;
    }
    addProduct(product, qty, spokenInput, manualInput);
  };

  const removeLine = (id: string) => setLines((current) => current.filter((line) => line.id !== id));
  const resetDemo = () => {
    stopMic(); setLines([]); setActivity([]); setPendingMatches([]); setPendingQuantity(undefined);
    setSpokenInput(''); setManualInput(''); setLastParsed(null); setQuantityText(''); setStatus('Demo bill cleared. Start speaking again.');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-400">FOUR-X · Merchant Demo</p>
            <h1 className="mt-1 text-2xl font-bold sm:text-3xl">બોલીને બિલ બનાવો <span className="text-slate-400 text-lg font-medium">/ Voice Billing Demo</span></h1>
            <p className="mt-1 text-sm text-slate-400">એક પછી એક વસ્તુ બોલો. બોલેલું લખાણ, સમજાયેલો માલ અને જથ્થો અહીં દેખાશે.</p>
          </div>
          <button onClick={onBack} className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800">← Back</button>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
          <section className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900 p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><h2 className="font-bold">1. Speak to add products</h2><p className="text-xs text-slate-400">Example: “Glide 10 ampere panch nang”</p></div>
              <select value={language} onChange={(e) => { stopMic(); setLanguage(e.target.value as SupportedLanguage); }} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm">
                <option value="en-IN">English</option><option value="gu-IN">Gujarati</option><option value="hi-IN">Hindi</option>
              </select>
            </div>
            <button onClick={toggleMic} className={`flex w-full items-center justify-center gap-3 rounded-xl px-5 py-5 text-lg font-bold shadow-lg transition ${listening ? 'bg-red-600 text-white' : 'bg-amber-500 text-slate-950 hover:bg-amber-400'}`}>
              {listening ? <MicOff className="h-6 w-6"/> : <Mic className="h-6 w-6"/>}
              {listening ? 'Stop Listening' : 'Start Speaking'}
            </button>
            <div className={`rounded-lg border px-3 py-2 text-sm ${listening ? 'border-emerald-700 bg-emerald-950/40 text-emerald-300' : 'border-slate-700 bg-slate-950 text-slate-300'}`}>
              <span className="mr-2 inline-block h-2 w-2 rounded-full bg-current" />{status}
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">What the microphone heard</label>
              <textarea
                id="voice-heard-transcript"
                name="voice-heard-transcript"
                rows={2}
                value={spokenInput}
                readOnly={false}
                disabled={false}
                autoComplete="off"
                spellCheck={false}
                onChange={(e) => {
                  const value = e.currentTarget.value;
                  setSpokenInput(value);
                  setManualInput(value);
                  lastCommandRef.current = '';
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    submitManual();
                  }
                }}
                placeholder="Speak into the microphone or type the words here…"
                aria-label="What the microphone heard (editable transcript)"
                className="relative z-10 block w-full resize-y cursor-text select-text rounded-lg border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-white outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                style={{ pointerEvents: 'auto', userSelect: 'text', WebkitUserSelect: 'text' }}
              />
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Corrected / editable words</label>
              <div className="flex gap-2">
                <input value={manualInput} onChange={(e) => setManualInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submitManual()} placeholder="Type or correct the recognized words" className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-3 text-sm outline-none focus:border-amber-500" />
                <button onClick={submitManual} className="rounded-lg bg-slate-700 px-4 text-sm font-semibold hover:bg-slate-600">Process</button>
              </div>
              {lastParsed?.normalizedTranscript && <p className="text-xs text-slate-400">Normalized: <span className="font-mono text-amber-300">{lastParsed.normalizedTranscript}</span></p>}
            </div>

            {pendingMatches.length > 0 && <div className="space-y-3 rounded-xl border border-amber-700/60 bg-amber-950/20 p-3">
              <div><h3 className="font-semibold text-amber-300">Please confirm the product</h3><p className="text-xs text-slate-400">Choose the correct catalogue item. Nothing is added until you confirm.</p></div>
              <div className="grid gap-2 sm:grid-cols-2">{pendingMatches.map((product) => <button key={product.sku} onClick={() => addPending(product)} className="rounded-lg border border-slate-700 bg-slate-950 p-3 text-left hover:border-amber-500"><span className="block text-sm font-semibold">{product.item_name || product.description}</span><span className="mt-1 block font-mono text-xs text-amber-300">{product.sku}</span></button>)}</div>
              {!pendingQuantity && <div className="flex gap-2"><input type="number" min="1" value={quantityText} onChange={(e) => setQuantityText(e.target.value)} placeholder="Quantity (nang)" className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"/><span className="self-center text-xs text-slate-400">Nang</span></div>}
            </div>}

            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
              <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold"><Volume2 className="h-4 w-4 text-amber-400"/> Try these sample commands</h3>
              <div className="flex flex-wrap gap-2">{['Glide 10 ampere panch nang','Grace 20 ampere das nang','Glide two way be nang','Glide chrome tran nang','Glide indicator char nang'].map((sample) => <button key={sample} onClick={() => { lastCommandRef.current = ''; processCommand(sample); }} className="rounded-full border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:border-amber-500 hover:text-white">{sample}</button>)}</div>
              <p className="mt-2 text-[11px] text-slate-500">Sample buttons demonstrate the flow without microphone access. The product still must match a real catalogue record.</p>
            </div>
          </section>

          <section className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900 p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="flex items-center gap-2 font-bold"><Receipt className="h-5 w-5 text-amber-400"/> 2. Customer bill</h2><p className="text-xs text-slate-400">Live demo cart · {lines.length} product line(s)</p></div><button onClick={resetDemo} className="flex items-center gap-1 rounded-lg border border-slate-700 px-3 py-2 text-xs hover:bg-slate-800"><RotateCcw className="h-3.5 w-3.5"/> Clear demo</button></div>
            <div className="grid gap-2 sm:grid-cols-2"><label className="text-xs text-slate-400">Customer name<input value={customer} onChange={(e) => setCustomer(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"/></label><div className="text-xs text-slate-400">Invoice date<div className="mt-1 rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-200">{new Date().toLocaleDateString('en-IN')}</div></div></div>
            <div className="overflow-hidden rounded-xl border border-slate-800">
              <div className="grid grid-cols-[1fr_55px_85px] gap-2 bg-slate-950 px-3 py-2 text-[11px] font-semibold uppercase text-slate-500"><span>Product / SKU</span><span className="text-right">Qty</span><span className="text-right">Rate</span></div>
              {lines.length === 0 ? <div className="p-8 text-center text-sm text-slate-500">Your bill is empty. Speak your first product to begin.</div> : lines.map((line, index) => {
                const pricing = resolveProductPrice(line.product);
                const effectivePrice = pricing.unitPrice ?? line.manualUnitPrice;
                return <div key={line.id} className="grid grid-cols-[1fr_55px_110px] items-center gap-2 border-t border-slate-800 px-3 py-3"><div className="min-w-0"><p className="text-sm font-semibold">{index + 1}. {line.product.item_name || line.product.description}</p><p className="font-mono text-[10px] text-slate-500">{line.product.sku}</p>{pricing.unitPrice !== undefined ? <p className="mt-1 text-[10px] text-emerald-400">Catalogue price available</p> : <label className="mt-2 block text-[10px] text-amber-400">Enter confirmed rate (₹)<input type="number" min="0.01" step="0.01" value={line.manualUnitPrice ?? ''} onChange={(e) => updateManualPrice(line.id, e.target.value)} placeholder="Check original catalogue" className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-white outline-none focus:border-amber-500" /></label>}</div><span className="text-right text-sm tabular-nums">{line.quantity}</span><div className="text-right"><p className="text-xs">{money(effectivePrice)}</p>{line.manualUnitPrice !== undefined && pricing.unitPrice === undefined && <p className="text-[9px] text-amber-300">Manual rate</p>}<button onClick={() => removeLine(line.id)} className="mt-1 text-[10px] text-red-400 hover:text-red-300">Remove</button></div></div>;
              })}
            </div>
            <div className="space-y-2 rounded-xl bg-slate-950 p-4"><div className="flex justify-between text-sm text-slate-400"><span>Total product lines</span><span>{lines.length}</span></div><div className="flex justify-between text-sm text-slate-400"><span>Total quantity</span><span>{totalQuantity} nang</span></div><div className="flex justify-between border-t border-slate-800 pt-3 text-base font-bold"><span>Subtotal of entered rates</span><span>₹{pricedSubtotal.toFixed(2)}</span></div>{unpricedCount > 0 && <p className="flex items-center gap-1 text-xs text-amber-400"><AlertCircle className="h-3.5 w-3.5"/>{unpricedCount} item(s) still need a confirmed rate; subtotal is incomplete.</p>}</div>
            <div className="rounded-lg border border-emerald-800/50 bg-emerald-950/20 p-3 text-xs text-emerald-200"><CheckCircle2 className="mr-1 inline h-4 w-4"/> Demo only: this bill stays on this page. Manually entered rates are for this demo only and are not written back to the catalogue or live invoice.</div>
          </section>
        </div>

        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4"><h2 className="mb-3 font-bold">3. Voice activity — what the merchant said and what FOUR-X understood</h2>{activity.length === 0 ? <p className="text-sm text-slate-500">Each command and its result will appear here.</p> : <div className="space-y-2">{activity.map((entry) => <div key={entry.id} className="grid gap-1 rounded-lg border border-slate-800 bg-slate-950 p-3 sm:grid-cols-[1fr_1.2fr]"><div><p className="text-[10px] uppercase tracking-wide text-slate-500">Merchant said</p><p className="text-sm text-slate-200">“{entry.spoken}”</p><p className="mt-1 text-[10px] text-slate-500">Normalized: {entry.normalized}</p></div><div><p className="text-[10px] uppercase tracking-wide text-slate-500">FOUR-X response</p><p className={`text-sm ${entry.tone === 'success' ? 'text-emerald-300' : entry.tone === 'warning' ? 'text-amber-300' : 'text-red-300'}`}>{entry.outcome}</p></div></div>)}</div>}</section>
        <p className="text-center text-[11px] text-slate-600">Uses the local FOUR-X Product Master. No product is invented. Unverified catalogue prices are never presented as approved prices. Entered demo rates must be checked against the original price list.</p>
      </div>
    </div>
  );
};
