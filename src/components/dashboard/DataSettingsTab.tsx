import { useRef, useState } from 'react';
import { Play, Pause, RotateCcw, AlertTriangle, Upload, Download, Cpu, Wifi, BatteryCharging } from 'lucide-react';
import { usePulseGuard } from '../../context/PulseGuardContext';

export const DataSettingsTab = () => {
  const {
    isMonitoring,
    toggleMonitoring,
    injectScenario,
    activeScenario,
    backendConnected,
    backendModelLoaded,
    importCSVData,
    sampleCSVContent,
    dataSource,
  } = usePulseGuard();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        const success = importCSVData(content);
        if (success) {
          setImportStatus(`Successfully parsed ${file.name} — now replaying telemetry!`);
        } else {
          setImportStatus('Invalid CSV format. Check sample structure.');
        }
      }
    };
    reader.readAsText(file);
  };

  const handleDownloadSample = () => {
    const blob = new Blob([sampleCSVContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'pulseguard_sample_stream.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-8">
      {/* Simulation Controls Banner */}
      <div className="p-8 rounded-3xl bg-white border border-[#294638]/12 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-editorial text-2xl font-bold text-[#242923]">
              Data Engine & Simulation Sandbox Controls
            </h3>
            <p className="text-xs text-[#242923]/60 mt-1 max-w-xl">
              Control the real-time telemetry stream, inject Isolation Forest anomaly test scenarios, or upload your own recorded CSV stream.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 text-xs font-mono px-3 py-1 rounded-full font-medium ${
              backendConnected ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-amber-100 text-amber-800 border border-amber-300'
            }`}>
              <span className={`w-2 h-2 rounded-full ${backendConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
              {backendConnected ? (backendModelLoaded ? 'Backend: Connected (IF Trained)' : 'Backend: Connected (Warming)') : 'Backend: Offline (Demo Mode)'}
            </span>
          </div>
        </div>

        {/* Action Button Bar */}
        <div className="flex flex-wrap items-center gap-3 pt-2">
          {/* Pause / Resume Button */}
          <button
            onClick={toggleMonitoring}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer shadow-sm active:scale-95 ${
              isMonitoring
                ? 'bg-[#E6E8DC] text-[#294638] hover:bg-[#d8dbcb]'
                : 'bg-[#294638] text-white hover:bg-[#1f362b]'
            }`}
          >
            {isMonitoring ? (
              <>
                <Pause className="w-4 h-4" />
                <span>Pause Stream</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                <span>Resume Stream</span>
              </>
            )}
          </button>

          {/* Trigger Tachycardia Scenario */}
          <button
            onClick={() => injectScenario('tachycardia')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer shadow-sm active:scale-95 ${
              activeScenario === 'tachycardia'
                ? 'bg-[#E76F51] text-white ring-2 ring-[#E76F51]/50'
                : 'bg-[#E76F51]/15 text-[#E76F51] border border-[#E76F51]/30 hover:bg-[#E76F51] hover:text-white'
            }`}
          >
            <AlertTriangle className="w-4 h-4" />
            <span>Tachycardia (+46 BPM)</span>
          </button>

          {/* Trigger Hypoxia Scenario */}
          <button
            onClick={() => injectScenario('hypoxia')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer shadow-sm active:scale-95 ${
              activeScenario === 'hypoxia'
                ? 'bg-[#D9A441] text-white ring-2 ring-[#D9A441]/50'
                : 'bg-[#D9A441]/15 text-[#D9A441] border border-[#D9A441]/30 hover:bg-[#D9A441] hover:text-white'
            }`}
          >
            <AlertTriangle className="w-4 h-4" />
            <span>Hypoxia (91.5% SpO₂)</span>
          </button>

          {/* Trigger Pyrexia Scenario */}
          <button
            onClick={() => injectScenario('pyrexia')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer shadow-sm active:scale-95 ${
              activeScenario === 'pyrexia'
                ? 'bg-[#E76F51] text-white ring-2 ring-[#E76F51]/50'
                : 'bg-[#E76F51]/15 text-[#E76F51] border border-[#E76F51]/30 hover:bg-[#E76F51] hover:text-white'
            }`}
          >
            <AlertTriangle className="w-4 h-4" />
            <span>Pyrexia (38.8°C Temp)</span>
          </button>

          {/* Restore Normal Baseline */}
          <button
            onClick={() => injectScenario('normal')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer shadow-sm active:scale-95 ${
              activeScenario === 'normal'
                ? 'bg-[#294638] text-white'
                : 'bg-white border border-[#294638]/20 text-[#294638] hover:bg-[#F7F5EF]'
            }`}
          >
            <RotateCcw className="w-4 h-4" />
            <span>Restore Normal</span>
          </button>
        </div>
      </div>

      {/* CSV Import & Export Box */}
      <div className="p-8 rounded-3xl bg-white border border-[#294638]/12 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h4 className="font-editorial text-xl font-bold text-[#242923]">
              CSV Replay & Biometric Data Import
            </h4>
            <p className="text-xs text-[#242923]/60 mt-0.5">
              Replay recorded patient logs or synthetic sensor traces through the live PulseGuard radar.
            </p>
          </div>

          <button
            onClick={handleDownloadSample}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#F7F5EF] border border-[#294638]/15 text-xs font-mono text-[#294638] hover:bg-[#E6E8DC] transition-colors cursor-pointer w-fit"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download Sample CSV</span>
          </button>
        </div>

        <div className="p-6 rounded-2xl border-2 border-dashed border-[#294638]/20 bg-[#F7F5EF]/60 text-center space-y-3">
          <Upload className="w-8 h-8 text-[#294638] mx-auto opacity-70" />
          <div className="text-xs text-[#242923]/70 font-mono">
            Select a CSV containing columns: <code className="bg-white px-2 py-0.5 rounded border border-[#294638]/10 text-[#294638]">timestamp, heartRate, spO2, skinTemp, activity</code>
          </div>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".csv"
            className="hidden"
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-5 py-2.5 rounded-xl bg-[#294638] text-[#F7F5EF] text-xs font-semibold hover:bg-[#1f362b] transition-colors cursor-pointer active:scale-95 shadow-sm"
          >
            Browse & Upload CSV File
          </button>

          {importStatus && (
            <p className="text-xs font-mono font-medium text-[#294638] mt-2">
              {importStatus}
            </p>
          )}
        </div>
      </div>

      {/* Hardware Telemetry & Connection Status */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="p-6 rounded-3xl bg-white border border-[#294638]/12 space-y-2">
          <div className="flex items-center gap-2 text-xs font-mono text-[#242923]/60">
            <Wifi className="w-4 h-4 text-[#294638]" />
            <span>TELEMETRY STREAM</span>
          </div>
          <div className="font-editorial text-2xl font-bold text-[#242923]">
            {dataSource === 'simulated' ? 'Continuous Synthetic' : 'CSV Replay'}
          </div>
          <p className="text-xs text-[#242923]/60">Latency: 18ms · Zero packet loss</p>
        </div>

        <div className="p-6 rounded-3xl bg-white border border-[#294638]/12 space-y-2">
          <div className="flex items-center gap-2 text-xs font-mono text-[#242923]/60">
            <Cpu className="w-4 h-4 text-[#294638]" />
            <span>RADAR ENGINE STATUS</span>
          </div>
          <div className="font-editorial text-2xl font-bold text-[#294638]">
            {isMonitoring ? 'Active & Calibrated' : 'Stream Paused'}
          </div>
          <p className="text-xs text-[#242923]/60">Confidence score: 98.4%</p>
        </div>

        <div className="p-6 rounded-3xl bg-white border border-[#294638]/12 space-y-2">
          <div className="flex items-center gap-2 text-xs font-mono text-[#242923]/60">
            <BatteryCharging className="w-4 h-4 text-[#294638]" />
            <span>WEARABLE SENSOR STATE</span>
          </div>
          <div className="font-editorial text-2xl font-bold text-[#242923]">
            94% · Synced
          </div>
          <p className="text-xs text-[#242923]/60">Optic PPG dome nominal</p>
        </div>
      </div>

      {/* Ethical & Medical Prototype Disclaimer */}
      <div className="p-5 rounded-2xl bg-[#F7F5EF] border border-[#294638]/15 text-xs text-[#242923]/70 leading-relaxed space-y-1">
        <span className="font-bold text-[#294638] uppercase font-mono tracking-wider block">
          Ethical & Clinical Demonstration Disclaimer
        </span>
        <p>
          PulseGuard is a technological prototype developed for interactive demonstration, algorithmic exploration, and UI design verification. It is not an FDA-cleared diagnostic medical device. It does not replace professional clinical evaluation, electrocardiography, or acute emergency medical intervention.
        </p>
      </div>
    </div>
  );
};
