import React from 'react';
import { ActiveModuleId } from '../../types';
import { Mic, ScanLine, Layers, LayoutDashboard } from 'lucide-react';

interface HeaderProps {
  activeModule: ActiveModuleId;
  onSelectModule: (module: ActiveModuleId) => void;
}

export const Header: React.FC<HeaderProps> = ({ activeModule, onSelectModule }) => {
  return (
    <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-sm sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-8">
          {/* Zone 1: Brand Title */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => onSelectModule('dashboard')}
              className="text-left group cursor-pointer focus:outline-none"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold text-sm tracking-wider">
                  1R
                </div>
                <div>
                  <h1 className="text-base font-bold tracking-tight text-white group-hover:text-emerald-400 transition-colors">
                    ONE RETAIL AI
                  </h1>
                </div>
              </div>
            </button>
            <span className="hidden sm:inline-block text-xs text-slate-500 border-l border-slate-800 pl-3">
              FOUR-X & OCR Core
            </span>
          </div>

          {/* Zone 2: 4 single-line navigation links */}
          <nav className="hidden md:flex items-center gap-1">
            <button
              onClick={() => onSelectModule('dashboard')}
              className={`flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                activeModule === 'dashboard'
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>Dashboard</span>
            </button>

            <button
              onClick={() => onSelectModule('voice-billing')}
              className={`flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                activeModule === 'voice-billing'
                  ? 'bg-slate-800 text-emerald-400 font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Mic className="w-3.5 h-3.5" />
              <span>Voice Billing</span>
            </button>

            <button
              onClick={() => onSelectModule('ocr-billing')}
              className={`flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                activeModule === 'ocr-billing'
                  ? 'bg-slate-800 text-cyan-400 font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <ScanLine className="w-3.5 h-3.5" />
              <span>Camera / OCR</span>
            </button>

            <button
              onClick={() => onSelectModule('rack-counting')}
              className={`flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                activeModule === 'rack-counting'
                  ? 'bg-slate-800 text-amber-400 font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Rack Counting</span>
            </button>
          </nav>

          {/* Zone 3: Primary Action / State */}
          <div className="flex items-center gap-3 shrink-0">
            <span className="hidden lg:inline text-xs text-slate-400">
              Scaffold Phase <span aria-hidden="true">·</span> Ready for Code Drop
            </span>
            <div className="text-xs font-mono font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded">
              v0.1.0-scaffold
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
