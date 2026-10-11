import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import type { TelemetryReading, BaselineRanges, AnomalyEvent, ActivityState } from '../types/pulseguard';
import { pulseguardApi } from '../services/pulseguardApi';

interface PulseGuardContextType {
  currentReading: TelemetryReading;
  readingsHistory: TelemetryReading[];
  baselineRanges: BaselineRanges;
  anomalyEvents: AnomalyEvent[];
  activeAnomaly: AnomalyEvent | null;
  isMonitoring: boolean;
  dataSource: 'simulated' | 'imported';
  backendConnected: boolean;
  backendModelLoaded: boolean;
  activeScenario: string;
  toggleMonitoring: () => void;
  triggerTestAnomaly: () => void;
  restoreNormalReadings: () => void;
  injectScenario: (scenario: 'normal' | 'tachycardia' | 'hypoxia' | 'pyrexia') => Promise<void>;
  acknowledgeEvent: (id: string) => void;
  importCSVData: (csvText: string) => boolean;
  sampleCSVContent: string;
}

const defaultBaseline: BaselineRanges = {
  heartRate: {
    restingMin: 58,
    restingMax: 76,
    activeMin: 95,
    activeMax: 145,
    typical: 68,
  },
  spO2: {
    min: 96.5,
    max: 99.5,
    typical: 98.2,
  },
  skinTemp: {
    min: 36.2,
    max: 36.9,
    typical: 36.6,
  },
  observationWindowDays: 14,
  totalDataPoints: 40320,
  confidenceScore: 98.4,
  hasSufficientData: true,
};

const initialEvents: AnomalyEvent[] = [
  {
    id: 'evt-101',
    timestamp: '09:42:15',
    severity: 'Moderate',
    title: 'Disproportionate Resting Tachycardia',
    contributingSignals: ['Heart Rate (+34 BPM)', 'Resting Inactivity', 'HRV Depletion'],
    explanation: 'Sustained elevated pulse (106 BPM) recorded while user remained stationary for > 240 seconds without ambient temperature stress.',
    heartRate: 106,
    spO2: 97.4,
    skinTemp: 36.7,
    activity: 'Resting',
    acknowledged: true,
    recovered: true,
    durationSeconds: 195,
  },
  {
    id: 'evt-102',
    timestamp: '06:18:04',
    severity: 'Low',
    title: 'Nocturnal Desaturation Dip',
    contributingSignals: ['SpO₂ (93.8%)', 'Sleep State'],
    explanation: 'Transient drop in oxygen saturation to 93.8% during Stage 3 NREM sleep, recovered autonomously within 45 seconds.',
    heartRate: 54,
    spO2: 93.8,
    skinTemp: 36.3,
    activity: 'Sleep',
    acknowledged: true,
    recovered: true,
    durationSeconds: 45,
  }
];

const sampleCSVContent = `timestamp,heartRate,spO2,skinTemp,activity
10:00:00,68,98.2,36.5,Resting
10:00:05,70,98.1,36.5,Resting
10:00:10,71,98.0,36.6,Resting
10:00:15,108,96.8,36.8,Resting
10:00:20,114,96.4,36.9,Resting
10:00:25,116,96.2,37.0,Resting
10:00:30,95,97.5,36.7,Resting
10:00:35,72,98.0,36.5,Resting`;

const PulseGuardContext = createContext<PulseGuardContextType | undefined>(undefined);

export const PulseGuardProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isMonitoring, setIsMonitoring] = useState<boolean>(true);
  const [dataSource, setDataSource] = useState<'simulated' | 'imported'>('simulated');
  const [backendConnected, setBackendConnected] = useState<boolean>(false);
  const [backendModelLoaded, setBackendModelLoaded] = useState<boolean>(false);
  const [activeScenario, setActiveScenario] = useState<string>('normal');
  const [anomalyMode, setAnomalyMode] = useState<boolean>(false);
  const [, setConsecutiveAnomalyTicks] = useState<number>(0);

  const [activeAnomaly, setActiveAnomaly] = useState<AnomalyEvent | null>(null);
  const [anomalyEvents, setAnomalyEvents] = useState<AnomalyEvent[]>(initialEvents);
  const [baselineRanges, setBaselineRanges] = useState<BaselineRanges>(defaultBaseline);

  // Generate initial seed readings
  const generateInitialReadings = (): TelemetryReading[] => {
    const list: TelemetryReading[] = [];
    const now = Date.now();
    for (let i = 24; i >= 0; i--) {
      const time = new Date(now - i * 1500);
      const timeStr = time.toTimeString().split(' ')[0];
      list.push({
        timestamp: timeStr,
        epoch: time.getTime(),
        heartRate: Math.round(68 + Math.sin(i * 0.4) * 3 + (Math.random() - 0.5) * 2),
        spO2: Number((98.2 + Math.cos(i * 0.2) * 0.4).toFixed(1)),
        skinTemp: Number((36.5 + Math.sin(i * 0.1) * 0.1).toFixed(1)),
        respiratoryRate: 16,
        activity: 'Resting',
        hrv: Math.round(52 + Math.sin(i * 0.5) * 6),
        isAnomaly: false,
        mlAnomalyScore: 0.18,
        isMlAnomaly: false,
        ruleStatus: 'normal',
        severity: 'normal',
      });
    }
    return list;
  };

  const [readingsHistory, setReadingsHistory] = useState<TelemetryReading[]>(generateInitialReadings);
  const [currentReading, setCurrentReading] = useState<TelemetryReading>(() => readingsHistory[readingsHistory.length - 1]);

  const importedQueueRef = useRef<TelemetryReading[]>([]);
  const activeEventRef = useRef<AnomalyEvent | null>(null);
  const backendConnectedRef = useRef<boolean>(false);

  // Sync ref with state
  useEffect(() => {
    backendConnectedRef.current = backendConnected;
  }, [backendConnected]);

  // Periodic Backend Health Check & Baseline sync
  useEffect(() => {
    let isMounted = true;

    const checkBackend = async () => {
      try {
        const health = await pulseguardApi.checkHealth();
        if (isMounted) {
          setBackendConnected(true);
          setBackendModelLoaded(health.model_loaded);

          // Fetch baseline and events on first connection or recovery
          if (!backendConnectedRef.current) {
            pulseguardApi.getBaseline()
              .then(base => {
                if (isMounted) setBaselineRanges(base);
              })
              .catch(() => {});
            
            pulseguardApi.getEvents()
              .then(evts => {
                if (isMounted && evts.length > 0) {
                  setAnomalyEvents(evts);
                  const active = evts.find(e => !e.recovered && !e.acknowledged);
                  if (active) setActiveAnomaly(active);
                }
              })
              .catch(() => {});
          }
        }
      } catch {
        if (isMounted) {
          setBackendConnected(false);
          setBackendModelLoaded(false);
        }
      }
    };

    // Immediate check
    checkBackend();
    const interval = setInterval(checkBackend, 4000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Anomaly trigger and restore functions
  const triggerTestAnomaly = useCallback(() => {
    setAnomalyMode(true);
    setActiveScenario('tachycardia');
    setConsecutiveAnomalyTicks(3); // immediately establish persistence
    if (backendConnectedRef.current) {
      pulseguardApi.injectScenario('tachycardia').catch(() => {});
    }
  }, []);

  const restoreNormalReadings = useCallback(() => {
    setAnomalyMode(false);
    setActiveScenario('normal');
    setConsecutiveAnomalyTicks(0);
    if (backendConnectedRef.current) {
      pulseguardApi.injectScenario('normal').catch(() => {});
    }
    if (activeEventRef.current) {
      const endedId = activeEventRef.current.id;
      setAnomalyEvents(prev => prev.map(e => e.id === endedId ? { ...e, recovered: true } : e));
      activeEventRef.current = null;
      setActiveAnomaly(null);
    }
  }, []);

  const injectScenario = useCallback(async (scenario: 'normal' | 'tachycardia' | 'hypoxia' | 'pyrexia') => {
    setActiveScenario(scenario);
    if (scenario === 'normal') {
      setAnomalyMode(false);
    } else {
      setAnomalyMode(true);
    }
    if (backendConnectedRef.current) {
      await pulseguardApi.injectScenario(scenario).catch(() => {});
    }
  }, []);

  const toggleMonitoring = useCallback(() => {
    setIsMonitoring(prev => {
      const nextState = !prev;
      if (backendConnectedRef.current) {
        pulseguardApi.controlStream(nextState ? 'resume' : 'pause').catch(() => {});
      }
      return nextState;
    });
  }, []);

  const acknowledgeEvent = useCallback((id: string) => {
    setAnomalyEvents(prev => prev.map(e => e.id === id ? { ...e, acknowledged: true } : e));
    if (activeAnomaly?.id === id) {
      setActiveAnomaly(prev => prev ? { ...prev, acknowledged: true } : null);
    }
    if (backendConnectedRef.current) {
      pulseguardApi.acknowledgeEvent(id).catch(() => {});
    }
  }, [activeAnomaly]);

  const importCSVData = useCallback((csvText: string): boolean => {
    try {
      const lines = csvText.trim().split('\n');
      if (lines.length < 2) return false;

      const header = lines[0].toLowerCase().split(',').map(s => s.trim());
      const hrIdx = header.findIndex(h => h.includes('heart') || h.includes('hr') || h.includes('bpm'));
      const spo2Idx = header.findIndex(h => h.includes('spo2') || h.includes('oxygen'));
      const tempIdx = header.findIndex(h => h.includes('temp'));
      const actIdx = header.findIndex(h => h.includes('act'));
      const timeIdx = header.findIndex(h => h.includes('time'));

      const parsed: TelemetryReading[] = [];
      const baseNow = Date.now();

      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',').map(s => s.trim());
        if (cols.length < 2) continue;

        const hr = hrIdx >= 0 ? parseFloat(cols[hrIdx]) : 72;
        const spo2 = spo2Idx >= 0 ? parseFloat(cols[spo2Idx]) : 98.0;
        const temp = tempIdx >= 0 ? parseFloat(cols[tempIdx]) : 36.6;
        const act = (actIdx >= 0 && cols[actIdx]) ? (cols[actIdx] as ActivityState) : 'Resting';
        const timestamp = (timeIdx >= 0 && cols[timeIdx]) ? cols[timeIdx] : new Date(baseNow + i * 2000).toTimeString().split(' ')[0];

        if (!isNaN(hr)) {
          const isAnom = hr > 100 && (act === 'Resting' || act === 'Sedentary');
          parsed.push({
            timestamp,
            epoch: baseNow + i * 2000,
            heartRate: Math.round(hr),
            spO2: Number(spo2.toFixed(1)),
            skinTemp: Number(temp.toFixed(1)),
            respiratoryRate: 16,
            activity: act,
            hrv: 45,
            isAnomaly: isAnom,
            anomalyReason: isAnom ? 'CSV flagged elevated heart rate' : undefined,
            mlAnomalyScore: isAnom ? -0.08 : 0.15,
            isMlAnomaly: isAnom,
            ruleStatus: isAnom ? 'anomaly_flagged' : 'normal',
            severity: isAnom ? 'High' : 'normal',
          });
        }
      }

      if (parsed.length > 0) {
        importedQueueRef.current = parsed;
        setDataSource('imported');
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, []);

  // Main Streaming Engine Tick (every 1.5 seconds)
  useEffect(() => {
    if (!isMonitoring) return;

    let isCancelled = false;

    const interval = setInterval(async () => {
      if (isCancelled) return;

      const now = new Date();
      const timeStr = now.toTimeString().split(' ')[0];

      // 1. Try fetching live data from genuine Python ML Backend
      if (backendConnectedRef.current && dataSource !== 'imported') {
        try {
          const payload = await pulseguardApi.getCurrentReading();
          if (isCancelled) return;

          const hr = payload.readings.heart_rate;
          const spo2 = payload.readings.spo2;
          const temp = payload.readings.skin_temperature;
          const resp = payload.readings.respiratory_rate;
          const act = payload.readings.activity as ActivityState;
          const isAnom = payload.detection.is_anomaly;
          const mlScore = payload.detection.ml_anomaly_score;
          const isMlAnom = payload.detection.is_ml_anomaly;
          const ruleStat = payload.detection.rule_status;
          const sev = payload.detection.severity as any;
          const reason = payload.detection.reason;
          const signals = payload.detection.contributing_signals;

          const nextReading: TelemetryReading = {
            timestamp: timeStr,
            epoch: Date.now(),
            heartRate: hr,
            spO2: spo2,
            skinTemp: temp,
            respiratoryRate: resp,
            activity: act,
            hrv: payload.readings.hrv ?? (isAnom ? 22 : 54),
            isAnomaly: isAnom,
            anomalyReason: reason,
            mlAnomalyScore: mlScore,
            isMlAnomaly: isMlAnom,
            ruleStatus: ruleStat,
            severity: sev,
            contributingSignals: signals,
          };

          // Sync events from backend when anomaly changes or periodically
          if (isAnom && !activeEventRef.current) {
            pulseguardApi.getEvents().then(evts => {
              if (!isCancelled && evts.length > 0) {
                setAnomalyEvents(evts);
                const active = evts.find(e => !e.recovered && !e.acknowledged);
                if (active) {
                  activeEventRef.current = active;
                  setActiveAnomaly(active);
                }
              }
            }).catch(() => {});
          } else if (!isAnom && activeEventRef.current) {
            const endedId = activeEventRef.current.id;
            setAnomalyEvents(prev => prev.map(e => e.id === endedId ? { ...e, recovered: true } : e));
            activeEventRef.current = null;
            setActiveAnomaly(null);
          }

          setCurrentReading(nextReading);
          setReadingsHistory(prev => [...prev.slice(-34), nextReading]);
          return;
        } catch {
          // If backend fetch failed, temporarily mark disconnected & fall back to simulation
          setBackendConnected(false);
        }
      }

      // 2. Fallback: CSV Imported Queue
      if (dataSource === 'imported' && importedQueueRef.current.length > 0) {
        const nextReading = importedQueueRef.current.shift()!;
        setCurrentReading(nextReading);
        setReadingsHistory(prev => [...prev.slice(-34), nextReading]);
        return;
      }

      // 3. Fallback: Client-Side Simulation (Demo mode if backend unavailable)
      let nextReading: TelemetryReading;
      if (anomalyMode) {
        const hr = Math.round(114 + Math.sin(Date.now() / 800) * 4);
        const spo2 = Number((95.4 + Math.cos(Date.now() / 1200) * 0.5).toFixed(1));
        const temp = Number((36.1 + Math.sin(Date.now() / 1500) * 0.1).toFixed(1));
        const act: ActivityState = 'Resting';

        nextReading = {
          timestamp: timeStr,
          epoch: Date.now(),
          heartRate: hr,
          spO2: spo2,
          skinTemp: temp,
          respiratoryRate: 21,
          activity: act,
          hrv: 24,
          isAnomaly: true,
          anomalyReason: 'Resting pulse exceeded baseline upper bound (>100 BPM) with persistent inactivity.',
          mlAnomalyScore: -0.112,
          isMlAnomaly: true,
          ruleStatus: 'anomaly_flagged',
          severity: 'High',
          contributingSignals: [`Heart Rate (${hr} BPM)`, 'Inactivity Mismatch'],
        };
      } else {
        const t = Date.now() / 2500;
        const hr = Math.round(69 + Math.sin(t) * 3 + (Math.random() - 0.5) * 1.5);
        const spo2 = Number((98.4 + Math.sin(t * 0.6) * 0.3).toFixed(1));
        const temp = Number((36.6 + Math.cos(t * 0.3) * 0.1).toFixed(1));
        const act: ActivityState = 'Resting';

        nextReading = {
          timestamp: timeStr,
          epoch: Date.now(),
          heartRate: hr,
          spO2: spo2,
          skinTemp: temp,
          respiratoryRate: 15,
          activity: act,
          hrv: Math.round(54 + Math.sin(t) * 5),
          isAnomaly: false,
          mlAnomalyScore: 0.185,
          isMlAnomaly: false,
          ruleStatus: 'normal',
          severity: 'normal',
        };
      }

      // Fallback Anomaly event tracking
      if (nextReading.isAnomaly) {
        setConsecutiveAnomalyTicks(prev => {
          const updated = prev + 1;
          if (updated >= 2 && !activeEventRef.current) {
            const newEvent: AnomalyEvent = {
              id: `evt-${Date.now().toString().slice(-4)}`,
              timestamp: nextReading.timestamp,
              severity: nextReading.heartRate > 115 ? 'Critical' : 'High',
              title: 'Active Resting Tachycardia',
              contributingSignals: [
                `Heart Rate (${nextReading.heartRate} BPM, +${nextReading.heartRate - defaultBaseline.heartRate.typical} vs baseline)`,
                'Inactivity Mismatch (Resting)',
                `Skin Temp (${nextReading.skinTemp}°C, -0.5°C delta)`,
              ],
              explanation: `Physiological radar flagged an unexplained surge to ${nextReading.heartRate} BPM while metabolic demand remains at resting baseline.`,
              heartRate: nextReading.heartRate,
              spO2: nextReading.spO2,
              skinTemp: nextReading.skinTemp,
              activity: nextReading.activity,
              acknowledged: false,
              recovered: false,
              durationSeconds: 6,
            };
            activeEventRef.current = newEvent;
            setActiveAnomaly(newEvent);
            setAnomalyEvents(prevEvts => [newEvent, ...prevEvts]);
          } else if (activeEventRef.current) {
            activeEventRef.current = {
              ...activeEventRef.current,
              durationSeconds: (activeEventRef.current.durationSeconds || 0) + 2,
            };
            setActiveAnomaly({ ...activeEventRef.current });
          }
          return updated;
        });
      } else {
        if (activeEventRef.current && !anomalyMode) {
          const endedId = activeEventRef.current.id;
          setAnomalyEvents(prev => prev.map(e => e.id === endedId ? { ...e, recovered: true } : e));
          activeEventRef.current = null;
          setActiveAnomaly(null);
        }
        setConsecutiveAnomalyTicks(0);
      }

      setCurrentReading(nextReading);
      setReadingsHistory(prev => [...prev.slice(-34), nextReading]);
    }, 1500);

    return () => {
      isCancelled = true;
      clearInterval(interval);
    };
  }, [isMonitoring, dataSource, anomalyMode]);

  return (
    <PulseGuardContext.Provider
      value={{
        currentReading,
        readingsHistory,
        baselineRanges,
        anomalyEvents,
        activeAnomaly,
        isMonitoring,
        dataSource,
        backendConnected,
        backendModelLoaded,
        activeScenario,
        toggleMonitoring,
        triggerTestAnomaly,
        restoreNormalReadings,
        injectScenario,
        acknowledgeEvent,
        importCSVData,
        sampleCSVContent,
      }}
    >
      {children}
    </PulseGuardContext.Provider>
  );
};

export const usePulseGuard = (): PulseGuardContextType => {
  const context = useContext(PulseGuardContext);
  if (!context) {
    throw new Error('usePulseGuard must be used within a PulseGuardProvider');
  }
  return context;
};
