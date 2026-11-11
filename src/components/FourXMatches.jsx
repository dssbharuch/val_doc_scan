import { useMemo } from "react";
import data from "../data/fourx.json";

export function extractFourXCode(raw) {
  const normalized = String(raw || "").toUpperCase().replace(/[\s\-_:]+/g, "");
  const found = normalized.match(/FX([0-9]{4,6})/);
  return found ? found[1] : "";
}

export default function FourXMatches({ text, onChoose, onReject }) {
  const code = extractFourXCode(text);
  const matches = useMemo(() => {
    if (!code) return [];
    return data.products.filter(p => String(p.base_code || "").toUpperCase().match(/^FX(\d+)/)?.[1] === code);
  }, [code]);
  return <div className="absolute left-[3%] right-[3%] top-[41%] z-30 max-h-[46vh] overflow-y-auto rounded-xl bg-white p-3 text-slate-900 shadow-2xl">
    <div className="flex items-center justify-between gap-2"><strong>FOUR-X {code ? `· FX${code}` : '· Code not detected'}</strong><button onClick={onReject} className="rounded bg-rose-100 px-3 py-1 font-bold text-rose-700">✕ Reject</button></div>
    {!code && <p className="mt-2 text-sm">FX પછીનો numeric code મળ્યો નથી. ફરી Scan દબાવો.</p>}
    {code && !matches.length && <p className="mt-2 text-sm">આ code JSON માં મળ્યો નથી. ફરી Scan દબાવો.</p>}
    {matches.map((p, i) => <button key={`${p.sku}-${i}`} type="button" onClick={() => onChoose(p)} className="mt-2 block w-full rounded-lg border border-slate-200 bg-slate-50 p-3 text-left active:bg-emerald-100">
      <div className="font-bold">{p.base_code} {p.variant ? `· ${p.variant}` : ''}</div>
      <div className="text-sm">{p.description}</div>
      <div className="mt-1 text-xs text-slate-600">SKU: {p.sku} · Pack: {p.package_qty ?? '—'} · Outer: {p.outer_qty ?? '—'}</div>
      <div className="mt-1 text-xs text-amber-700">Draft prices (unverified): {(p.source_price_columns || []).join(' / ') || '—'}</div>
    </button>)}
    {matches.length > 1 && <p className="mt-2 text-xs text-slate-500">એક product પસંદ કરો; પછી આગળનું scan કરી શકશો.</p>}
  </div>;
}
