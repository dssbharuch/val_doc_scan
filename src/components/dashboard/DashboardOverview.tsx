import React, { useState } from 'react';
import { Mic, ScanLine, Layers, ArrowRight, Sparkles, FolderGit2, Check, ArrowUpRight, Search, CheckCircle2, ShieldCheck, Database } from 'lucide-react';
import { ActiveModuleId } from '../../types';
import { ProductSearch } from '../ProductSearch.tsx';
import { type FourxProductRecord } from '../../services/productMasterService.ts';

interface DashboardOverviewProps {
  onSelectModule: (module: ActiveModuleId) => void;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({ onSelectModule }) => {
  const modules = [
    {
      id: 'voice-billing' as const,
      number: '01',
      name: 'Voice Product Billing',
      origin: 'FOUR-X Voice Billing',
      colorClass: 'emerald',
      icon: Mic,
      tagline: 'Speech-driven fast billing and item selection',
      description:
        'Continuous speech-to-text recognition and natural language parsing to draft bills and add retail items via voice commands.',
      inputs: ['Microphone stream', 'Speech tokenization', 'Multilingual utterances'],
      outputs: ['Parsed product names', 'Itemized bill drafting', 'Quantity tallies'],
      accentBg: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
      actionText: 'Launch Voice Module',
    },
    {
      id: 'ocr-billing' as const,
      number: '02',
      name: 'Camera / OCR Product Billing',
      origin: 'Scanner OCR Billing',
      colorClass: 'cyan',
      icon: ScanLine,
      tagline: 'Visual scanner for barcodes, labels, and receipts',
      description:
        'High-speed optical recognition to identify product packaging labels, barcode sequences, MRP tags, and printed bills instantly.',
      inputs: ['Camera feed / still snapshot', 'Barcode/QR decode', 'Packaging OCR text'],
      outputs: ['SKU identification', 'Automated bill entry', 'Price matching'],
      accentBg: 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400',
      actionText: 'Launch OCR Module',
    },
    {
      id: 'rack-counting' as const,
      number: '03',
      name: 'Rack Photo Product Counting',
      origin: 'Shelf & Inventory Vision',
      colorClass: 'amber',
      icon: Layers,
      tagline: 'Shelf photography analysis for automated stock audits',
      description:
        'Analyzes retail rack photos to count facings and individual item units, detecting empty slots and tracking physical stock on displays.',
      inputs: ['Rack display photo', 'Shelf boundary detection', 'Unit segmentation'],
      outputs: ['Total unit count', 'Facing counts by shelf', 'Void/gap identification'],
      accentBg: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
      actionText: 'Launch Rack Module',
    },
  ];

  const [selectedProduct, setSelectedProduct] = useState<FourxProductRecord | null>(null);

  return (
    <div className="space-y-10">
      {/* Hero / Executive Summary */}
      <div>
        <div className="flex items-center gap-2 text-xs text-slate-400 mb-2">
          <span>Unified Retail Intelligence Platform</span>
          <span aria-hidden="true">·</span>
          <span>Stage 2 Engine Ready</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white text-balance max-w-3xl">
          ONE RETAIL AI
        </h1>
        <p className="text-sm sm:text-base text-slate-400 mt-2 max-w-2xl leading-relaxed">
          Unified multi-modal retail terminal bringing together <span className="text-slate-200 font-medium">FOUR-X Voice Billing</span>, <span className="text-slate-200 font-medium">Scanner OCR Billing</span>, and visual <span className="text-slate-200 font-medium">Rack Photo Product Counting</span> into a single, cohesive workflow.
        </p>
      </div>

      {/* The 3 Core Modules Grid */}
      <div>
        <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-6">
          <div>
            <h2 className="text-base font-semibold text-white">Core Application Modules</h2>
            <p className="text-xs text-slate-400">The three dedicated operating pillars of ONE RETAIL AI</p>
          </div>
          <span className="text-xs font-mono text-slate-500">3 modules initialized</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {modules.map((mod) => {
            const Icon = mod.icon;
            return (
              <div
                key={mod.id}
                className="group border border-slate-800 bg-slate-900/40 hover:bg-slate-900/70 hover:border-slate-700 transition-all rounded-xl p-6 flex flex-col justify-between"
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-center justify-between mb-4">
                    <div className={`w-11 h-11 rounded-lg border flex items-center justify-center ${mod.accentBg}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-mono text-slate-500">{mod.number}</span>
                  </div>

                  {/* Title & Origin */}
                  <div className="text-xs text-slate-400 mb-1">
                    Origin: <span className="text-slate-300 font-medium">{mod.origin}</span>
                  </div>
                  <h3 className="text-lg font-bold text-white group-hover:text-emerald-400 transition-colors">
                    {mod.name}
                  </h3>
                  <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                    {mod.description}
                  </p>

                  {/* Input / Output Specs */}
                  <div className="mt-5 pt-4 border-t border-slate-800/80 space-y-2.5">
                    <div>
                      <div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-1">
                        Input Modality
                      </div>
                      <div className="text-xs text-slate-300">
                        {mod.inputs.join(' · ')}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-1">
                        Target Output
                      </div>
                      <div className="text-xs text-slate-300">
                        {mod.outputs.join(' · ')}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer Action */}
                <div className="pt-6 mt-6 border-t border-slate-800/60 flex items-center justify-between">
                  <div className="text-xs text-slate-400">
                    Status: <span className="text-emerald-400 font-mono">Ready for Code</span>
                  </div>
                  <button
                    onClick={() => onSelectModule(mod.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                  >
                    <span>{mod.actionText}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Stage 2 Live Search Engine Testbed */}
      <div className="border border-slate-800 bg-slate-900/40 rounded-xl p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mb-1.5">
              <Sparkles className="w-3 h-3" />
              <span>STAGE 2 DELIVERABLE</span>
            </div>
            <h2 className="text-lg font-bold text-white">
              Product Matching & Search Engine Testbed
            </h2>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
              Test real-time matching across all 531 canonical FOUR-X catalogue records. Supports exact SKU lookups, OCR-style text extraction, multi-word attributes in any order, and fuzzy typo tolerance.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0 text-xs">
            <div className="flex items-center gap-1.5 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 text-slate-300 font-mono">
              <Database className="w-3.5 h-3.5 text-emerald-400" />
              <span>531 Records</span>
            </div>
            <div className="flex items-center gap-1.5 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 text-emerald-400 font-mono">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Offline</span>
            </div>
          </div>
        </div>

        {/* Live Search Component */}
        <ProductSearch
          placeholder="Try 'FX1101WH', '10 amp white switch', 'glamm 32', or '18M frame'..."
          onSelectProduct={(p) => setSelectedProduct(p)}
        />

        {/* Selected Product Inspector */}
        {selectedProduct && (
          <div className="mt-4 p-4 rounded-xl bg-slate-950/70 border border-emerald-500/30 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                  Selected Product Record (Read-Only)
                </span>
              </div>
              <button
                onClick={() => setSelectedProduct(null)}
                className="text-xs text-slate-400 hover:text-white"
              >
                Dismiss
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-1">
              <div>
                <span className="text-slate-500 block text-[11px]">SKU:</span>
                <span className="font-mono font-bold text-white">{selectedProduct.sku}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Base Code:</span>
                <span className="font-mono text-slate-300">{selectedProduct.base_code}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Brand:</span>
                <span className="text-slate-300">{selectedProduct.brand}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Variant:</span>
                <span className="text-slate-300">{selectedProduct.variant || 'N/A'}</span>
              </div>
              <div className="col-span-2">
                <span className="text-slate-500 block text-[11px]">Description:</span>
                <span className="text-white font-medium">{selectedProduct.description}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Pack / Outer Qty:</span>
                <span className="text-slate-300">{selectedProduct.package_qty} / {selectedProduct.outer_qty}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Category:</span>
                <span className="text-slate-300">{selectedProduct.category}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Integration Roadmap & Project Consolidation Map */}
      <div className="border border-slate-800 bg-slate-900/30 rounded-xl p-6 sm:p-8">
        <div className="max-w-3xl">
          <div className="text-xs font-semibold uppercase tracking-wider text-emerald-400 mb-1">
            Consolidation Roadmap
          </div>
          <h2 className="text-lg sm:text-xl font-bold text-white">
            From Two Standalone Repositories to ONE RETAIL AI
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1.5 leading-relaxed">
            This scaffold establishes clean, decoupled module boundaries so that your existing components and real product catalogue can be merged without mutual interference.
          </p>
        </div>

        {/* 3 Step Integration Progression */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          <div className="border border-emerald-500/30 bg-emerald-950/10 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-mono text-emerald-400 font-medium">STAGE 1</span>
              <span className="text-[11px] text-emerald-400 font-medium">Approved</span>
            </div>
            <h4 className="text-sm font-semibold text-white">Product Master Integration</h4>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Canonical 531-record catalogue loaded with zero mutations, strict immutability, and 8/8 tests verified.
            </p>
          </div>

          <div className="border border-cyan-500/30 bg-cyan-950/10 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-mono text-cyan-400 font-medium">STAGE 2</span>
              <span className="text-[11px] text-cyan-400 font-medium">Complete</span>
            </div>
            <h4 className="text-sm font-semibold text-white">Product Matching & Search</h4>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Deterministic 5-tier local matching engine with scoring (0-100), word-order tolerance, OCR code extraction, and offline index.
            </p>
          </div>

          <div className="border border-slate-800/80 bg-slate-950/40 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-mono text-slate-400 font-medium">STAGE 3+</span>
              <span className="text-[11px] text-slate-400">Next</span>
            </div>
            <h4 className="text-sm font-semibold text-white">Voice & OCR Ingestion</h4>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Wire FOUR-X speech recognition stream and Camera OCR pipelines into the matching engine.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
