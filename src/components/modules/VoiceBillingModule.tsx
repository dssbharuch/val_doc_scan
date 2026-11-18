import React, { useState } from 'react';
import { Mic, ArrowLeft, Radio, Cpu, Database, AudioWaveform, GraduationCap } from 'lucide-react';
import { VoiceBillingDemoPage } from '../../voice/components/VoiceBillingDemoPage';
import { VoiceTrainingTestingPage } from '../../voice/components/VoiceTrainingTestingPage';
import { ActiveModuleId } from '../../types';

interface VoiceBillingModuleProps {
  onBackToDashboard: () => void;
  onSwitchModule: (module: ActiveModuleId) => void;
}

export const VoiceBillingModule: React.FC<VoiceBillingModuleProps> = ({
  onBackToDashboard,
  onSwitchModule,
}) => {
  const [voiceTab, setVoiceTab] = useState<'billing' | 'training'>('billing');
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
              <span className="text-emerald-400">Module 01</span>
              <span aria-hidden="true">·</span>
              <span>Project Origin: FOUR-X Voice Billing</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight mt-0.5">
              Voice Product Billing
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">Next module:</span>
          <button
            onClick={() => onSwitchModule('ocr-billing')}
            className="px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-900 border border-slate-800 rounded-lg hover:bg-slate-800 hover:text-white transition-colors"
          >
            Camera / OCR Billing →
          </button>
        </div>
      </div>

      {/* Integrated FOUR-X voice workflows */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-3">
        <button
          type="button"
          onClick={() => setVoiceTab('billing')}
          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${voiceTab === 'billing' ? 'bg-emerald-500 text-slate-950' : 'border border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800'}`}
        >
          <Mic className="h-4 w-4" /> Voice Billing
        </button>
        <button
          type="button"
          onClick={() => setVoiceTab('training')}
          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${voiceTab === 'training' ? 'bg-emerald-500 text-slate-950' : 'border border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800'}`}
        >
          <GraduationCap className="h-4 w-4" /> Voice Training & Testing
        </button>
      </div>

      {voiceTab === 'billing' ? (
        <VoiceBillingDemoPage onBack={onBackToDashboard} />
      ) : (
        <VoiceTrainingTestingPage onBack={() => setVoiceTab('billing')} />
      )}

    </div>
  );
};
