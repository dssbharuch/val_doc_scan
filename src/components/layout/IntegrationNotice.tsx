import React from 'react';
import { Terminal, FileCode, CheckCircle2 } from 'lucide-react';

export const IntegrationNotice: React.FC = () => {
  return (
    <div className="border border-slate-800 bg-slate-900/50 rounded-xl p-4 sm:p-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white">
              ONE RETAIL AI Scaffold Ready
            </h2>
            <p className="text-xs text-slate-400 mt-0.5 max-w-2xl">
              Clean architecture initialized with strict module boundaries. No mock product catalogs or dummy billing records have been generated. Ready for FOUR-X Voice source code, OCR engine logic, and real product catalog injection.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0 text-xs font-mono text-slate-400 bg-slate-950/60 border border-slate-800 px-3 py-1.5 rounded-lg">
          <FileCode className="w-3.5 h-3.5 text-emerald-400" />
          <span>awaiting: code & catalogue</span>
        </div>
      </div>
    </div>
  );
};
