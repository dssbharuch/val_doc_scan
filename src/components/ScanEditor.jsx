import { useEffect, useMemo, useRef, useState } from 'react';
import Tesseract from 'tesseract.js';
import FourCornerCrop from './FourCornerCrop';
import { canvasToBlob, createEnhancedCanvas } from '../utils/imageProcessing';
import { VALUATION_FIELDS, FIELD_LABELS } from './fieldDefinitions';

const KEEP_SHORT_LINES = new Set([
  'NA', 'N/A', 'NO', 'NO.', 'E', 'W', 'N', 'S',
  'GF', 'FF', 'SF', 'TF', 'TF2', 'BS', 'TR'
]);

function isUsefulOCRLine(line) {
  const value = String(line || '').trim();
  if (!value) return false;
  if (/^[.,;:|_~`'"\\-–—=+*()\[\]{}\/\\]+$/.test(value)) return false;
  const compact = value.replace(/\s+/g, '').toUpperCase();
  if (KEEP_SHORT_LINES.has(compact)) return true;
  if (/^\d{1,4}(?:[./-]\d{1,4})?$/.test(compact)) return true;
  if (compact.length <= 2) return false;
  const alnumCount = (value.match(/[A-Za-z0-9\u0A80-\u0AFF]/g) || []).length;
  if (value.length >= 3 && alnumCount === 0) return false;
  return true;
}

function splitOCRLines(text) {
  return String(text || '').replace(/\r/g, '').split('\n').map((line) => line.trim()).filter(Boolean);
}

export default function ScanEditor({ page, onDone, onCancel, onRetake }) {
  const imgRef = useRef(null);
  const workerRef = useRef(null);
  const workerLangRef = useRef(null);
  const [mode, setMode] = useState(null), [selection, setSelection] = useState(null), [dragging, setDragging] = useState(null);
  const initialText = page.editedText || page.ocrText || '';
  const initialAll = splitOCRLines(initialText);
  const [ocrText, setOcrText] = useState(initialText);
  const [ocrLines, setOcrLines] = useState(initialAll.filter(isUsefulOCRLine));
  const [hiddenOCRLines, setHiddenOCRLines] = useState(initialAll.filter((line) => !isUsefulOCRLine(line)));
  const [showHiddenLines, setShowHiddenLines] = useState(false);
  const [lineKeys, setLineKeys] = useState({});
  const [activeLine, setActiveLine] = useState(0);
  const [showKeyPicker, setShowKeyPicker] = useState(false);
  const [mergeHistory, setMergeHistory] = useState([]);
  const [lastMergeTarget, setLastMergeTarget] = useState(null);
  const [status, setStatus] = useState('');
  const [progress, setProgress] = useState(0), [rotation, setRotation] = useState(page.rotation || 0), [zoom, setZoom] = useState(1);
  const [busy, setBusy] = useState(false), [showCorners, setShowCorners] = useState(false), [sourceUrl, setSourceUrl] = useState(page.imageUrl);
  const [ocrMode, setOcrMode] = useState('eng'), [preprocess, setPreprocess] = useState('enhanced');
  const imageStyle = useMemo(() => ({ transform: `rotate(${rotation}deg) scale(${zoom})`, transformOrigin: 'center center' }), [rotation, zoom]);

  useEffect(() => () => {
    if (sourceUrl && sourceUrl !== page.imageUrl) URL.revokeObjectURL(sourceUrl);
    if (workerRef.current) {
      workerRef.current.terminate().catch(() => {});
      workerRef.current = null;
      workerLangRef.current = null;
    }
  }, [sourceUrl, page.imageUrl]);

  const onCancelRef = useRef(onCancel);
  const onRetakeRef = useRef(onRetake);
  useEffect(() => { onCancelRef.current = onCancel; onRetakeRef.current = onRetake; }, [onCancel, onRetake]);

  useEffect(() => {
    window.history.pushState({ scannerEditor: true }, '');
    const onBack = () => (onRetakeRef.current ? onRetakeRef.current() : onCancelRef.current());
    window.addEventListener('popstate', onBack);
    return () => window.removeEventListener('popstate', onBack);
  }, []);

  function replaceLines(nextLines, nextKeys = lineKeys) {
    const clean = nextLines.filter((line) => String(line).trim() !== '');
    const filteredKeys = {};
    clean.forEach((_, i) => { if (nextKeys[i]) filteredKeys[i] = nextKeys[i]; });
    setOcrLines(clean);
    setLineKeys(filteredKeys);
    setOcrText(clean.join('\n'));
    setActiveLine((i) => Math.max(0, Math.min(i, clean.length - 1)));
  }

  function syncOCRResult(text) {
    const all = splitOCRLines(text);
    const visible = all.filter(isUsefulOCRLine);
    setOcrLines(visible);
    setHiddenOCRLines(all.filter((line) => !isUsefulOCRLine(line)));
    setShowHiddenLines(false);
    setOcrText(all.join('\n'));
    setLineKeys({});
    setMergeHistory([]);
    setLastMergeTarget(null);
    setActiveLine(0);
    return { visible, hidden: all.filter((line) => !isUsefulOCRLine(line)) };
  }

  function updateLine(index, value) {
    const next = [...ocrLines];
    next[index] = value;
    setOcrLines(next);
    setOcrText(next.join('\n'));
  }

  function removeLine(index) {
    const nextLines = ocrLines.filter((_, i) => i !== index);
    const nextKeys = {};
    nextLines.forEach((_, newIndex) => {
      const oldIndex = newIndex >= index ? newIndex + 1 : newIndex;
      if (lineKeys[oldIndex]) nextKeys[newIndex] = lineKeys[oldIndex];
    });
    replaceLines(nextLines, nextKeys);
    setMergeHistory([]);
    setLastMergeTarget(null);
  }

  function clearAllLines() {
    setOcrLines([]); setHiddenOCRLines([]); setOcrText(''); setLineKeys({});
    setActiveLine(0); setMergeHistory([]); setLastMergeTarget(null); setShowHiddenLines(false);
  }

  function restoreHiddenLine(line) {
    const next = [...ocrLines, line];
    setOcrLines(next); setOcrText(next.join('\n'));
    setHiddenOCRLines((prev) => prev.filter((item) => item !== line));
  }

  function selectKey(key) {
    if (activeLine < 0 || activeLine >= ocrLines.length) return;
    setLineKeys((prev) => ({ ...prev, [activeLine]: key }));
    setShowKeyPicker(false);
    if (activeLine < ocrLines.length - 1) setActiveLine(activeLine + 1);
  }

  function clearLineKey(index) {
    setLineKeys((prev) => { const next = { ...prev }; delete next[index]; return next; });
  }

  function mergeWithAbove(index) {
    if (index <= 0 || index >= ocrLines.length) return;
    const snapshot = { lines: [...ocrLines], keys: { ...lineKeys }, active: activeLine, target: index - 1 };
    const nextLines = [...ocrLines];
    nextLines[index - 1] = `${String(nextLines[index - 1]).trim()} ${String(nextLines[index]).trim()}`.trim();
    nextLines.splice(index, 1);
    const nextKeys = {};
    nextLines.forEach((_, newIndex) => {
      const oldIndex = newIndex < index ? newIndex : newIndex + 1;
      if (lineKeys[oldIndex]) nextKeys[newIndex] = lineKeys[oldIndex];
    });
    setMergeHistory((prev) => [...prev, snapshot]);
    setOcrLines(nextLines); setLineKeys(nextKeys); setOcrText(nextLines.join('\n'));
    setActiveLine(index - 1); setLastMergeTarget(index - 1);
  }

  function undoLastMerge() {
    if (!mergeHistory.length) return;
    const history = [...mergeHistory];
    const snapshot = history.pop();
    setMergeHistory(history);
    setOcrLines(snapshot.lines); setLineKeys(snapshot.keys); setOcrText(snapshot.lines.join('\n'));
    setActiveLine(snapshot.active);
    setLastMergeTarget(history.length ? history[history.length - 1].target : null);
  }

  const usedKeys = new Set(Object.values(lineKeys));
  const availableFields = VALUATION_FIELDS.filter(([key]) => !usedKeys.has(key) || key === lineKeys[activeLine]);

  function reset() { setRotation(0); setZoom(1); }
  useEffect(() => { if (mode === null) setMode(page.scanMode === 'full' ? 'full' : 'rectangle'); }, [mode, page.scanMode]);

  function pointerDown(e) {
    if (mode !== 'rectangle') return;
    const r = imgRef.current?.getBoundingClientRect(); if (!r) return;
    const x = Math.max(0, Math.min(e.clientX - r.left, r.width));
    const y = Math.max(0, Math.min(e.clientY - r.top, r.height));
    setSelection({ x, y, w: 1, h: 1 }); setDragging({ x, y }); e.currentTarget.setPointerCapture?.(e.pointerId);
  }
  function pointerMove(e) {
    if (!dragging) return;
    const r = imgRef.current?.getBoundingClientRect(); if (!r) return;
    const x = Math.max(0, Math.min(e.clientX - r.left, r.width));
    const y = Math.max(0, Math.min(e.clientY - r.top, r.height));
    setSelection({ x: Math.min(dragging.x, x), y: Math.min(dragging.y, y), w: Math.abs(x - dragging.x), h: Math.abs(y - dragging.y) });
  }
  function stop() { setDragging(null); }

  async function makeCanvas() {
    const img = imgRef.current; if (!img) throw Error('Image not ready');
    const sw = Number(img.naturalWidth), sh = Number(img.naturalHeight);
    if (!Number.isFinite(sw) || !Number.isFinite(sh) || sw < 1 || sh < 1) throw Error('Image is not ready. Please wait and try again.');
    let sx = 0, sy = 0, cw = sw, ch = sh;
    if (mode === 'rectangle' && selection) {
      const r = img.getBoundingClientRect(); if (!r.width || !r.height) throw Error('Image display area is not ready.');
      const fx = sw / r.width, fy = sh / r.height;
      const x1 = Math.max(0, Math.min(r.width, selection.x)), y1 = Math.max(0, Math.min(r.height, selection.y));
      const x2 = Math.max(x1, Math.min(r.width, selection.x + selection.w)), y2 = Math.max(y1, Math.min(r.height, selection.y + selection.h));
      sx = Math.floor(x1 * fx); sy = Math.floor(y1 * fy);
      const ex = Math.ceil(x2 * fx), ey = Math.ceil(y2 * fy);
      cw = Math.max(2, Math.min(sw - sx, ex - sx)); ch = Math.max(2, Math.min(sh - sy, ey - sy));
    }
    const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(cw)); c.height = Math.max(1, Math.round(ch));
    const ctx = c.getContext('2d'); if (!ctx) throw Error('Canvas is not available in this browser.');
    ctx.drawImage(img, sx, sy, cw, ch, 0, 0, c.width, c.height);
    if (rotation % 360) {
      const a = (((rotation % 360) + 360) % 360) * Math.PI / 180, r = document.createElement('canvas'), q = rotation % 180 !== 0;
      r.width = q ? c.height : c.width; r.height = q ? c.width : c.height; const rc = r.getContext('2d');
      if (!rc) throw Error('Canvas is not available in this browser.');
      rc.translate(r.width / 2, r.height / 2); rc.rotate(a); rc.drawImage(c, -c.width / 2, -c.height / 2); return r;
    }
    return c;
  }

  async function getOCRWorker() {
    if (workerRef.current && workerLangRef.current === ocrMode) return workerRef.current;
    if (workerRef.current) { await workerRef.current.terminate().catch(() => {}); workerRef.current = null; workerLangRef.current = null; }
    setStatus(`Loading ${ocrMode === 'eng' ? 'English' : ocrMode === 'guj' ? 'Gujarati' : 'English + Gujarati'} OCR...`);
    const worker = await Tesseract.createWorker(ocrMode, 1, { logger: (m) => { if (typeof m.progress === 'number') setProgress(Math.round(m.progress * 100)); if (m.status) setStatus(m.status); }, errorHandler: (err) => console.error('Tesseract worker:', err) });
    await worker.setParameters({ preserve_interword_spaces: '1', user_defined_dpi: '300' });
    workerRef.current = worker; workerLangRef.current = ocrMode; return worker;
  }

  async function runOCR() {
    setBusy(true); setProgress(0); setStatus('Preparing selected image...');
    try {
      let c = await makeCanvas(); const isRectangle = mode === 'rectangle';
      const settings = preprocess === 'strong' ? { contrast: 1.55, brightness: 1.08, scale: 3 } : preprocess === 'enhanced' ? { contrast: 1.3, brightness: 1.03, scale: 2.5 } : { contrast: 1, brightness: 1, scale: 1 };
      if (preprocess !== 'original') c = createEnhancedCanvas(c, settings);
      const worker = await getOCRWorker(); const psm = isRectangle ? '6' : '3';
      await worker.setParameters({ tessedit_pageseg_mode: psm, preserve_interword_spaces: '1', user_defined_dpi: '300' });
      setStatus(`Extracting ${ocrMode === 'eng' ? 'English' : ocrMode === 'guj' ? 'Gujarati' : 'English + Gujarati'} text...`);
      const result = await worker.recognize(c); const text = result?.data?.text || ''; const { visible, hidden } = syncOCRResult(text);
      if (!text.trim()) setStatus('No text detected. Try Better OCR, move closer, improve lighting, or select the text more tightly.');
      else { const confidence = Number.isFinite(result?.data?.confidence) ? Math.round(result.data.confidence) : null; setStatus(`OCR completed: ${visible.length} useful line${visible.length === 1 ? '' : 's'}${hidden.length ? ` · ${hidden.length} noise line${hidden.length === 1 ? '' : 's'} hidden` : ''}${confidence !== null ? ` · confidence ${confidence}%` : ''}.`); }
    } catch (e) { console.error(e); setStatus(e?.message || 'OCR failed. Please try again.'); }
    finally { setBusy(false); }
  }

  async function applyCorners(points) {
    setBusy(true); setStatus('Preparing document crop...');
    try {
      const img = new Image(); await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = page.imageUrl; });
      const xs = points.map(p => p.x), ys = points.map(p => p.y); const minX = Math.max(0, Math.floor(Math.min(...xs))), minY = Math.max(0, Math.floor(Math.min(...ys)));
      const maxX = Math.min(img.naturalWidth, Math.ceil(Math.max(...xs))), maxY = Math.min(img.naturalHeight, Math.ceil(Math.max(...ys)));
      const c = document.createElement('canvas'); c.width = Math.max(1, maxX - minX); c.height = Math.max(1, maxY - minY); const ctx = c.getContext('2d'); if (!ctx) throw Error('Canvas unavailable');
      ctx.drawImage(img, minX, minY, c.width, c.height, 0, 0, c.width, c.height); const b = await canvasToBlob(c); const u = URL.createObjectURL(b);
      setSourceUrl(u); setMode('document'); setShowCorners(false); setStatus('Document area selected. Run OCR when ready.');
    } catch (e) { setStatus('Could not crop document.'); } finally { setBusy(false); }
  }

  function save() {
    const keyValues = {};
    ocrLines.forEach((line, index) => { const key = lineKeys[index]; if (key && String(line).trim()) keyValues[key] = String(line).trim(); });
    onDone({ ...page, scanMode: mode, crop: selection, rotation, ocrText, editedText: ocrText, keyValues });
  }

  return <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950"><div className="mx-auto min-h-screen max-w-3xl bg-slate-100">
    <header className="sticky top-0 z-30 flex items-center justify-between bg-slate-900 px-4 py-3 text-white">
      <button onClick={() => (onRetake ? onRetake() : onCancel())} className="rounded-lg bg-white/10 px-3 py-2 text-sm">← Back</button>
      <div className="text-center"><div className="text-xs text-slate-300">Page {page.pageNumber}</div><h2 className="font-semibold">Scan & Improve OCR</h2></div><div className="w-16"/>
    </header>
    <div className="p-4">
      <div className="overflow-hidden rounded-2xl bg-black"><div className="relative flex min-h-[45vh] items-center justify-center overflow-auto select-none touch-none" onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={stop} onPointerCancel={stop} style={{ touchAction: 'none' }}>
        <img ref={imgRef} src={sourceUrl} onLoad={(e)=>{if(page.scanMode!=="full"&&!selection){const r=e.currentTarget.getBoundingClientRect();setSelection({x:0,y:0,w:r.width,h:r.height});}}} className="block max-h-[65vh] max-w-full object-contain" style={imageStyle} draggable="false" />
        {mode === 'rectangle' && selection && <div className="pointer-events-none absolute border-2 border-blue-400 bg-blue-500/10" style={{ left: imgRef.current ? imgRef.current.offsetLeft + selection.x : selection.x, top: imgRef.current ? imgRef.current.offsetTop + selection.y : selection.y, width: selection.w, height: selection.h }} />}
      </div></div>
      <div className="mt-3 rounded-2xl bg-white p-3 shadow"><div className="flex flex-wrap gap-2"><button onClick={() => setRotation(v => (v + 90) % 360)} className="rounded-lg bg-slate-100 px-3 py-2 text-sm">↻ Rotate</button><button onClick={() => setZoom(v => Math.min(2.5, v + .25))} className="rounded-lg bg-slate-100 px-3 py-2 text-sm">＋ Zoom</button><button onClick={() => setZoom(v => Math.max(.75, v - .25))} className="rounded-lg bg-slate-100 px-3 py-2 text-sm">－ Zoom</button><button onClick={reset} className="rounded-lg bg-slate-100 px-3 py-2 text-sm">Reset</button>{mode === 'document' && <button onClick={() => setShowCorners(true)} className="rounded-lg bg-blue-100 px-3 py-2 text-sm font-medium text-blue-800">📐 Adjust Corners</button>}</div><div className="mt-2 text-xs text-slate-500">Rotation {rotation}° · Zoom {Math.round(zoom * 100)}%</div></div>
      <div className="mt-3 rounded-2xl bg-white p-4 shadow"><div className="grid gap-3 sm:grid-cols-2"><div className="text-xs font-medium text-slate-500">OCR language<div className="mt-1 grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1">{[["eng","Eng"],["guj","Guj"],["eng+guj","Both"]].map(([value,label])=><button key={value} type="button" onClick={()=>setOcrMode(value)} className={`rounded-md px-2 py-2 text-xs font-semibold ${ocrMode===value?"bg-white text-blue-700 shadow-sm":"text-slate-500"}`}>{label}</button>)}</div></div><label className="text-xs font-medium text-slate-500">Enhancement<select value={preprocess} onChange={e => setPreprocess(e.target.value)} className="mt-1 w-full rounded-lg border p-2 text-sm"><option value="original">Original</option><option value="enhanced">Enhanced</option><option value="strong">Strong</option></select></label></div><button onClick={runOCR} disabled={busy || (mode === 'rectangle' && !selection)} className="mt-4 w-full rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white disabled:opacity-40">{busy ? '🔎 Processing...' : '🔎 Extract Text'}</button><button onClick={() => { setPreprocess('strong'); setTimeout(runOCR, 50); }} disabled={busy} className="mt-2 w-full rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-800">🔄 Try Better OCR</button></div>
      {status && <div className="mt-3 rounded-xl bg-blue-50 p-3 text-sm text-blue-800">{status}</div>}{progress > 0 && progress < 100 && <div className="mt-3 rounded-xl bg-white p-3"><div className="text-xs text-slate-500">OCR progress {progress}%</div><div className="mt-1 h-2 rounded-full bg-slate-200"><div className="h-2 rounded-full bg-blue-600" style={{ width: `${progress}%` }} /></div></div>}
      <section className="mt-4 rounded-2xl bg-white p-4 shadow">
        <div className="mb-3 flex items-center justify-between gap-2"><h3 className="font-semibold">OCR Text</h3><button type="button" onClick={clearAllLines} disabled={!ocrLines.length} className="rounded-lg bg-red-50 px-2 py-1 text-xs font-semibold text-red-600 disabled:opacity-40">× Clear all</button></div>
        {ocrLines.length ? <>
          <div className="space-y-2">
            {ocrLines.map((line, index) => {
              const selectedKey = lineKeys[index];
              return <div key={`${index}-${line.slice(0, 12)}`} className={`rounded-xl border p-2 ${activeLine === index ? 'border-blue-400 bg-blue-50/40' : 'border-slate-200'}`}>
                <div className="mb-1 flex items-center gap-1.5">
                  <button type="button" onClick={() => { setActiveLine(index); setShowKeyPicker(true); }} className={`min-w-0 flex-1 truncate rounded-lg px-2 py-2 text-left text-xs font-semibold ${selectedKey ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-700'}`}>{selectedKey ? FIELD_LABELS[selectedKey] : `Line ${index + 1} · Select key`}</button>
                  {selectedKey && <button type="button" onClick={() => clearLineKey(index)} className="rounded-md px-2 py-2 text-xs text-slate-500">change</button>}
                  {index > 0 && <button type="button" onClick={() => mergeWithAbove(index)} className="rounded-lg bg-amber-50 px-2 py-2 text-[11px] font-semibold text-amber-700 whitespace-nowrap" title="Merge this line with the line above">Merge with above</button>}
                  {lastMergeTarget === index && mergeHistory.length > 0 && <button type="button" onClick={undoLastMerge} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-base text-slate-700" title="Undo merge" aria-label="Undo merge">↶</button>}
                  <button type="button" onClick={() => removeLine(index)} aria-label={`Remove line ${index + 1}`} title="Remove whole line" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-50 text-base font-bold text-red-600">×</button>
                </div>
                <textarea value={line} onChange={e => updateLine(index, e.target.value)} rows={Math.max(1, Math.ceil(line.length / 70))} className="w-full rounded-lg border p-2 text-sm leading-6 outline-none focus:border-blue-500" />
              </div>;
            })}
          </div>
          {hiddenOCRLines.length > 0 && <div className="mt-3"><button type="button" onClick={() => setShowHiddenLines(v => !v)} className="text-sm font-medium text-blue-700">{showHiddenLines ? 'Hide' : 'Show'} hidden OCR lines ({hiddenOCRLines.length})</button>{showHiddenLines && <div className="mt-2 space-y-2 rounded-xl bg-slate-50 p-2">{hiddenOCRLines.map((line, index) => <button type="button" key={`${index}-${line}`} onClick={() => restoreHiddenLine(line)} className="block w-full rounded-lg border bg-white px-3 py-2 text-left text-sm text-slate-700 hover:border-blue-400">＋ {line}</button>)}</div>}</div>}
          <div className="mt-3 text-xs text-slate-500">Tap the blue key button to select a field. Use “Merge with above” when OCR splits one value into two lines.</div>
        </> : <div className="rounded-xl border border-dashed p-4 text-sm text-slate-400">No extracted text yet. Select a scan area and press Extract Text.</div>}
        <button onClick={save} className="mt-4 w-full rounded-xl bg-emerald-600 px-4 py-3 font-semibold text-white">✓ Save Page Text</button>
      </section>
    </div>
  </div>{showKeyPicker && <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 p-3 sm:items-center" onMouseDown={() => setShowKeyPicker(false)}><div className="w-full max-w-md rounded-2xl bg-white p-4 shadow-2xl" onMouseDown={e => e.stopPropagation()}><div className="mb-3 flex items-center justify-between"><div><div className="text-xs text-slate-500">Select key</div><div className="font-semibold text-slate-900">Line {activeLine + 1}</div></div><button type="button" onClick={() => setShowKeyPicker(false)} className="h-8 w-8 rounded-full bg-slate-100 text-lg">×</button></div><div className="grid grid-cols-2 gap-2 max-h-[60vh] overflow-y-auto">{availableFields.map(([key, short]) => <button key={key} type="button" onClick={() => selectKey(key)} className="rounded-xl border bg-slate-50 px-3 py-3 text-left text-xs font-semibold text-slate-700 hover:border-blue-400 hover:bg-blue-50">{short}<span className="ml-1 text-[10px] font-normal text-slate-400">{key}</span></button>)}{!availableFields.length && <div className="col-span-2 rounded-xl bg-slate-50 p-4 text-xs text-slate-500">All predefined keys have been used.</div>}</div></div></div>}{showCorners && <FourCornerCrop imageUrl={page.imageUrl} onApply={applyCorners} onCancel={() => setShowCorners(false)} />}</div>;
}
