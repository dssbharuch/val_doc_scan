import React from 'react';
import { Layers, ArrowLeft, Image as ImageIcon, Box, Calculator, CheckCircle2 } from 'lucide-react';
import { ActiveModuleId } from '../../types';

interface RackCountingModuleProps {
  onBackToDashboard: () => void;
  onSwitchModule: (module: ActiveModuleId) => void;
}

export const RackCountingModule: React.FC<RackCountingModuleProps> = ({
  onBackToDashboard,
  onSwitchModule,
}) => {
  return (
    <div className="space-y-6">
      {/* Navigation & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToDashboard}
            className="p-2 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 hover:text-white transition-colors"
            title="Back to Dashboard"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span>ONE RETAIL AI</span>
              <span aria-hidden="true">·</span>
              <span className="text-amber-400">Module 03</span>
              <span aria-hidden="true">·</span>
              <span>Shelf & Inventory Vision</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight mt-0.5">
              Rack Photo Product Counting
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">Jump to:</span>
          <button
            onClick={() => onSwitchModule('voice-billing')}
            className="px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-900 border border-slate-800 rounded-lg hover:bg-slate-800 hover:text-white transition-colors"
          >
            Voice Billing →
          </button>
        </div>
      </div>

      {/* Main Scaffold Showcase */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Module Interface Scaffold Area */}
        <div className="lg:col-span-2 border border-slate-800 bg-slate-900/40 rounded-xl p-6 flex flex-col justify-between min-h-[360px]">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-800/80 mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">Rack Counting Terminal Scaffold</h3>
                  <p className="text-xs text-slate-400">Shelf photography analysis & visual stock verification</p>
                </div>
              </div>
              <span className="text-xs font-mono text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded">
                RACK VISION SLOT
              </span>
            </div>

            {/* Waiting for integration notice box */}
            <div className="border border-dashed border-slate-800 rounded-xl p-8 text-center bg-slate-950/40 my-6">
              <div className="w-12 h-12 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 mx-auto mb-4">
                <Box className="w-6 h-6 text-amber-400" />
              </div>
              <h4 className="text-base font-semibold text-white">
                Awaiting Rack Counting Pipeline Logic
              </h4>
              <p className="text-xs text-slate-400 mt-2 max-w-md mx-auto leading-relaxed">
                This workspace is reserved for shelf image capture, object bounding, product unit counting, and stock level reconciliation against your inventory.
              </p>
              <div className="mt-5 inline-flex items-center gap-2 text-xs font-mono text-slate-400 bg-slate-900 px-3 py-1.5 rounded-md border border-slate-800">
                <span>Target hook: `src/components/modules/RackCountingModule.tsx`</span>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between text-xs text-slate-400 gap-2">
            <span>Clean state: No fake shelf counts or artificial stock levels</span>
            <span className="font-mono text-slate-500">Status: Ready for source code insertion</span>
          </div>
        </div>

        {/* Technical Specification & Integration Boundaries */}
        <div className="space-y-4">
          <div className="border border-slate-800 bg-slate-900/40 rounded-xl p-5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-4">
              Module Architecture & Inputs
            </h3>
            
            <div className="space-y-3.5">
              <div className="flex items-start gap-3">
                <ImageIcon className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-medium text-slate-200">High-Resolution Shelf Imagery</div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    Rack and display shelf photos uploaded by store staff or captured via mobile camera.
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Calculator className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-medium text-slate-200">Instance Segmentation & Count</div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    Detects visual unit clusters, facings, empty voids, and total item quantities per rack.
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-medium text-slate-200">Stock Discrepancy Flagging</div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    Compares counted units with master catalogue listings to identify low stock.
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="border border-slate-800 bg-slate-900/40 rounded-xl p-5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Next Step Guidance
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              When ready, share your shelf counting algorithm or vision prompts. We will integrate the image input handlers and count summary cards here.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
