import { useState } from 'react';
import { ActiveModuleId } from './types';
import { Header } from './components/layout/Header';
import { IntegrationNotice } from './components/layout/IntegrationNotice';
import { DashboardOverview } from './components/dashboard/DashboardOverview';
import { VoiceBillingModule } from './components/modules/VoiceBillingModule';
import { OcrBillingModule } from './components/modules/OcrBillingModule';
import { RackCountingModule } from './components/modules/RackCountingModule';

export default function App() {
  const [activeModule, setActiveModule] = useState<ActiveModuleId>('dashboard');

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Bar Navigation */}
      <Header activeModule={activeModule} onSelectModule={setActiveModule} />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Notice of Ready State */}
        <IntegrationNotice />

        {/* Dynamic Module View */}
        {activeModule === 'dashboard' && (
          <DashboardOverview onSelectModule={setActiveModule} />
        )}

        {activeModule === 'voice-billing' && (
          <VoiceBillingModule
            onBackToDashboard={() => setActiveModule('dashboard')}
            onSwitchModule={setActiveModule}
          />
        )}

        {activeModule === 'ocr-billing' && (
          <OcrBillingModule
            onBackToDashboard={() => setActiveModule('dashboard')}
            onSwitchModule={setActiveModule}
          />
        )}

        {activeModule === 'rack-counting' && (
          <RackCountingModule
            onBackToDashboard={() => setActiveModule('dashboard')}
            onSwitchModule={setActiveModule}
          />
        )}
      </main>

      {/* Clean System Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-6 text-xs text-slate-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-400">ONE RETAIL AI</span>
            <span aria-hidden="true">·</span>
            <span>Consolidated Retail Architecture</span>
          </div>
          <div className="flex items-center gap-4 text-slate-400">
            <span>Voice Billing</span>
            <span>·</span>
            <span>Camera/OCR Billing</span>
            <span>·</span>
            <span>Rack Product Counting</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
