import { useEffect, useMemo, useRef, useState } from 'react';
import Tesseract from 'tesseract.js';
import FourCornerCrop from './FourCornerCrop';
import { canvasToBlob, createEnhancedCanvas } from '../utils/imageProcessing';

function cleanOCRLines(text) {
  return String(text || '')
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

export default function ScanEditor({ page, onDone, onCancel }) {
  const imgRef = useRef(null);
  const workerRef = useRef(null);
  const workerLangRef = useRef(null);
  const [mode, setMode] = useState(null), [selection, setSelection] = useState(null), [dragging, setDragging] = useState(null);
  const initialText = page.editedText || page.ocrText || '';
  const [ocrText, setOcrText] = useState(initialText);
  const [ocrLines, setOcrLines] = useState(cleanOCRLines(initialText));
  const [status, setStatus] = useState('');
  const [progress, setProgress] = useState(0), [rotation, setRotation] = useState(page.rotation || 0), [zoom, setZoom] = useState(1);
  const [busy, setBusy] = useState(false), [showCorners, setShowCorners] = useState(false), [sourceUrl, setSourceUrl] = useState(page.imageUrl);
  // Keep the UI intentionally simple: exactly two OCR choices.
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
  useEffect(() => {
    onCancelRef.current = onCancel;
  }, [onCancel]);

  useEffect(() => {
    window.history.pushState({ scannerEditor: true }, "");
    const onBack = () => onCancelRef.current();
    window.addEventListener("popstate", onBack);

    return () => {
      window.removeEventListener("popstate", onBack);
    };
  }, []);

  function syncLines(lines) {
    const next = lines.filter((line) => String(line).trim() !== '');
    setOcrLines(next);
    setOcrText(next.join('\n'));
  }

  function updateLine(index, value) {
    const next = [...ocrLines];
    next[index] = value;
    syncLines(next);
  }

  function removeLine(index) {
    syncLines(ocrLines.filter((_, i) => i !== index));
  }

  function reset() { setRotation(0); setZoom(1); }
  function choose(m) { setMode(m); setSelection(null); setStatus(''); reset(); }

  useEffect(() => { if (mode === null) setMode(page.scanMode === 'full' ? 'full' : 'rectangle'); }, [mode, page.scanMode]);

  function pointerDown(e) {
    if (mode !== 'rectangle') return;
    const r = imgRef.current?.getBoundingClientRect();
    if (!r) return;
    const x = Math.max(0, Math.min(e.clientX - r.left, r.width));
    const y = Math.max(0, Math.min(e.clientY - r.top, r.height));
    setSelection({ x, y, w: 1, h: 1 });
    setDragging({ x, y });
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }

  function pointerMove(e) {
    if (!dragging) return;
    const r = imgRef.current?.getBoundingClientRect();
    if (!r) return;
    const x = Math.max(0, Math.min(e.clientX - r.left, r.width));
    const y = Math.max(0, Math.min(e.clientY - r.top, r.height));
    setSelection({ x: Math.min(dragging.x, x), y: Math.min(dragging.y, y), w: Math.abs(x - dragging.x), h: Math.abs(y - dragging.y) });
  }

  function stop() { setDragging(null); }

  async function makeCanvas() {
    const img = imgRef.current;
    if (!img) throw Error('Image not ready');
    const sw = Number(img.naturalWidth), sh = Number(img.naturalHeight);
    if (!Number.isFinite(sw) || !Number.isFinite(sh) || sw < 1 || sh < 1) throw Error('Image is not ready. Please wait and try again.');
    let sx = 0, sy = 0, cw = sw, ch = sh;

    if (mode === 'rectangle' && selection) {
      const r = img.getBoundingClientRect();
      if (!r.width || !r.height) throw Error('Image display area is not ready.');
      const fx = sw / r.width, fy = sh / r.height;
      const x1 = Math.max(0, Math.min(r.width, selection.x));
      const y1 = Math.max(0, Math.min(r.height, selection.y));
      const x2 = Math.max(x1, Math.min(r.width, selection.x + selection.w));
      const y2 = Math.max(y1, Math.min(r.height, selection.y + selection.h));
      sx = Math.floor(x1 * fx); sy = Math.floor(y1 * fy);
      const ex = Math.ceil(x2 * fx), ey = Math.ceil(y2 * fy);
      cw = Math.max(2, Math.min(sw - sx, ex - sx));
      ch = Math.max(2, Math.min(sh - sy, ey - sy));
    }

    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(cw)); c.height = Math.max(1, Math.round(ch));
    const ctx = c.getContext('2d');
    if (!ctx) throw Error('Canvas is not available in this browser.');
    ctx.drawImage(img, sx, sy, cw, ch, 0, 0, c.width, c.height);

    if (rotation % 360) {
      const a = (((rotation % 360) + 360) % 360) * Math.PI / 180, r = document.createElement('canvas'), q = rotation % 180 !== 0;
      r.width = q ? c.height : c.width; r.height = q ? c.width : c.height;
      const rc = r.getContext('2d');
      if (!rc) throw Error('Canvas is not available in this browser.');
      rc.translate(r.width / 2, r.height / 2); rc.rotate(a); rc.drawImage(c, -c.width / 2, -c.height / 2);
      return r;
    }
    return c;
  }

  async function getOCRWorker() {
    if (workerRef.current && workerLangRef.current === ocrMode) return workerRef.current;

    if (workerRef.current) {
      await workerRef.current.terminate().catch(() => {});
      workerRef.current = null;
      workerLangRef.current = null;
    }

    setStatus(`Loading ${ocrMode === 'eng' ? 'English' : ocrMode === 'guj' ? 'Gujarati' : 'English + Gujarati'} OCR...`);
    const worker = await Tesseract.createWorker(ocrMode, 1, {
      logger: (m) => {
        if (typeof m.progress === 'number') setProgress(Math.round(m.progress * 100));
        if (m.status) setStatus(m.status);
      },
      errorHandler: (err) => console.error('Tesseract worker:', err)
    });

    await worker.setParameters({
      preserve_interword_spaces: '1',
      user_defined_dpi: '300'
    });

    workerRef.current = worker;
    workerLangRef.current = ocrMode;
    return worker;
  }

  async function runOCR() {
    setBusy(true); setProgress(0); setStatus('Preparing selected image...');
    try {
      let c = await makeCanvas();
      const isRectangle = mode === 'rectangle';
      const settings = preprocess === 'strong'
        ? { contrast: 1.55, brightness: 1.08, scale: 3 }
        : preprocess === 'enhanced'
          ? { contrast: 1.3, brightness: 1.03, scale: 2.5 }
          : { contrast: 1, brightness: 1, scale: 1 };

      // Tesseract works better when small text is upscaled before recognition.
      if (preprocess !== 'original') c = createEnhancedCanvas(c, settings);

      const worker = await getOCRWorker();
      const psm = isRectangle ? '6' : '3';
      await worker.setParameters({
        tessedit_pageseg_mode: psm,
        preserve_interword_spaces: '1',
        user_defined_dpi: '300'
      });

      setStatus(`Extracting ${ocrMode === 'eng' ? 'English' : ocrMode === 'guj' ? 'Gujarati' : 'English + Gujarati'} text...`);
      const result = await worker.recognize(c);
      const text = result?.data?.text || '';
      const lines = cleanOCRLines(text);
      syncLines(lines);

      if (!text.trim()) {
        setStatus('No text detected. Try Better OCR, move closer, improve lighting, or select the text more tightly.');
      } else {
        const confidence = Number.isFinite(result?.data?.confidence) ? Math.round(result.data.confidence) : null;
        setStatus(`OCR completed: ${lines.length} line${lines.length === 1 ? '' : 's'}${confidence !== null ? ` · confidence ${confidence}%` : ''}. You can edit or remove any line.`);
      }
    } catch (e) {
      console.error(e);
      setStatus(e?.message || 'OCR failed. Please try again.');
    } finally { setBusy(false); }
  }

  async function applyCorners(points) {
    setBusy(true); setStatus('Preparing document crop...');
    try {
      const img = new Image();
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = page.imageUrl; });
      const xs = points.map(p => p.x), ys = points.map(p => p.y);
      const minX = Math.max(0, Math.floor(Math.min(...xs))), minY = Math.max(0, Math.floor(Math.min(...ys)));
      const maxX = Math.min(img.naturalWidth, Math.ceil(Math.max(...xs))), maxY = Math.min(img.naturalHeight, Math.ceil(Math.max(...ys)));
      const c = document.createElement('canvas'); c.width = Math.max(1, maxX - minX); c.height = Math.max(1, maxY - minY);
      const ctx = c.getContext('2d'); if (!ctx) throw Error('Canvas unavailable');
      ctx.drawImage(img, minX, minY, c.width, c.height, 0, 0, c.width, c.height);
      const b = await canvasToBlob(c); const u = URL.createObjectURL(b);
      setSourceUrl(u); setMode('document'); setShowCorners(false); setStatus('Document area selected. Run OCR when ready.');
    } catch (e) { setStatus('Could not crop document.'); }
    finally { setBusy(false); }
  }

  function save() { onDone({ ...page, scanMode: mode, crop: selection, rotation, ocrText, editedText: ocrText }); }

  return <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950"><div className="mx-auto min-h-screen max-w-3xl bg-slate-100">
    <header className="sticky top-0 z-30 flex items-center justify-between bg-slate-900 px-4 py-3 text-white">
<button onClick={onCancel} className="rounded-lg bg-white/10 px-3 py-2 text-sm">← Back</button>
<div className="text-center"><div className="text-xs text-slate-300">Page {page.pageNumber}</div><h2 className="font-semibold">Scan & Improve OCR</h2></div><div className="w-16"/>
</header>
    <div className="p-4">
      <>
        <div className="overflow-hidden rounded-2xl bg-black"><div className="relative flex min-h-[45vh] items-center justify-center overflow-auto select-none touch-none" onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={stop} onPointerCancel={stop} style={{ touchAction: 'none' }}>
          <img ref={imgRef} src={sourceUrl} onLoad={(e)=>{if(page.scanMode!=="full"&&!selection){const r=e.currentTarget.getBoundingClientRect();setSelection({x:0,y:0,w:r.width,h:r.height});}}} className="block max-h-[65vh] max-w-full object-contain" style={imageStyle} draggable="false" />
          {mode === 'rectangle' && selection && <div className="pointer-events-none absolute border-2 border-blue-400 bg-blue-500/10" style={{ left: imgRef.current ? imgRef.current.offsetLeft + selection.x : selection.x, top: imgRef.current ? imgRef.current.offsetTop + selection.y : selection.y, width: selection.w, height: selection.h }} />}
        </div></div>
        <div className="mt-3 rounded-2xl bg-white p-3 shadow"><div className="flex flex-wrap gap-2"><button onClick={() => setRotation(v => (v + 90) % 360)} className="rounded-lg bg-slate-100 px-3 py-2 text-sm">↻ Rotate</button><button onClick={() => setZoom(v => Math.min(2.5, v + .25))} className="rounded-lg bg-slate-100 px-3 py-2 text-sm">＋ Zoom</button><button onClick={() => setZoom(v => Math.max(.75, v - .25))} className="rounded-lg bg-slate-100 px-3 py-2 text-sm">－ Zoom</button><button onClick={reset} className="rounded-lg bg-slate-100 px-3 py-2 text-sm">Reset</button>{mode === 'document' && <button onClick={() => setShowCorners(true)} className="rounded-lg bg-blue-100 px-3 py-2 text-sm font-medium text-blue-800">📐 Adjust Corners</button>}</div><div className="mt-2 text-xs text-slate-500">Rotation {rotation}° · Zoom {Math.round(zoom * 100)}%</div></div>
        <div className="mt-3 rounded-2xl bg-white p-4 shadow"><div className="grid gap-3 sm:grid-cols-2"><div className="text-xs font-medium text-slate-500">OCR language
<div className="mt-1 grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1">
{[["eng","Eng"],["guj","Guj"],["eng+guj","Both"]].map(([value,label])=>
<button key={value} type="button" onClick={()=>setOcrMode(value)} className={`rounded-md px-2 py-2 text-xs font-semibold ${ocrMode===value?"bg-white text-blue-700 shadow-sm":"text-slate-500"}`}>{label}</button>)}
</div></div><label className="text-xs font-medium text-slate-500">Enhancement<select value={preprocess} onChange={e => setPreprocess(e.target.value)} className="mt-1 w-full rounded-lg border p-2 text-sm"><option value="original">Original</option><option value="enhanced">Enhanced</option><option value="strong">Strong</option></select></label></div><button onClick={runOCR} disabled={busy || (mode === 'rectangle' && !selection)} className="mt-4 w-full rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white disabled:opacity-40">{busy ? '🔎 Processing...' : '🔎 Extract Text'}</button><button onClick={() => { setPreprocess('strong'); setTimeout(runOCR, 50); }} disabled={busy} className="mt-2 w-full rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-800">🔄 Try Better OCR</button></div>
        {status && <div className="mt-3 rounded-xl bg-blue-50 p-3 text-sm text-blue-800">{status}</div>}{progress > 0 && progress < 100 && <div className="mt-3 rounded-xl bg-white p-3"><div className="text-xs text-slate-500">OCR progress {progress}%</div><div className="mt-1 h-2 rounded-full bg-slate-200"><div className="h-2 rounded-full bg-blue-600" style={{ width: `${progress}%` }} /></div></div>}
        <section className="mt-4 rounded-2xl bg-white p-4 shadow"><div className="mb-2 flex items-center justify-between"><h3 className="font-semibold">OCR Text</h3><span className="text-xs text-slate-400">Edit or remove lines</span></div>
          {ocrLines.length ? <div className="space-y-2">{ocrLines.map((line, index) => <div key={`${index}-${line.slice(0, 12)}`} className="flex items-start gap-2"><textarea value={line} onChange={e => updateLine(index, e.target.value)} rows={Math.max(1, Math.ceil(line.length / 70))} className="min-w-0 flex-1 rounded-xl border p-3 text-sm leading-6 outline-none focus:border-blue-500"/><button type="button" onClick={() => removeLine(index)} aria-label={`Remove line ${index + 1}`} title="Remove whole line" className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50 text-lg font-bold text-red-600 hover:bg-red-100">×</button></div>)}</div> : <div className="rounded-xl border border-dashed p-4 text-sm text-slate-400">No extracted text yet. Select a scan area and press Extract Text.</div>}
          <div className="mt-3 text-xs text-slate-500">Deleted lines are not saved. Edit any line before saving.</div>
          <button onClick={save} className="mt-3 w-full rounded-xl bg-emerald-600 px-4 py-3 font-semibold text-white">✓ Save Page Text</button>
        </section>
      </>
    </div>
  </div>{showCorners && <FourCornerCrop imageUrl={page.imageUrl} onApply={applyCorners} onCancel={() => setShowCorners(false)} />}</div>;
}
