export type ActivityState = 'Resting' | 'Sedentary' | 'Light Walk' | 'Active Cardio' | 'Sleep';

export type AnomalySeverity = 'Low' | 'Moderate' | 'High' | 'Critical';

export interface TelemetryReading {
  timestamp: string; // ISO string or HH:mm:ss
  epoch: number;
  heartRate: number; // BPM
  spO2: number; // Percentage (e.g. 98.2)
  skinTemp: number; // °C (e.g. 36.6)
  activity: ActivityState;
  hrv: number; // ms (Heart rate variability)
  respiratoryRate?: number;
  mlAnomalyScore?: number | null;
  isMlAnomaly?: boolean;
  ruleStatus?: string;
  severity?: AnomalySeverity | 'normal';
  contributingSignals?: string[];
  isAnomaly: boolean;
  anomalyReason?: string;
}

export interface BackendHealthResponse {
  status: string;
  service: string;
  model_loaded: boolean;
  model_type: string;
  features: string[];
  version: string;
}

export interface BackendTelemetryPayload {
  patient_id: string;
  patient_name?: string;
  timestamp: string;
  readings: {
    heart_rate: number;
    spo2: number;
    skin_temperature: number;
    respiratory_rate: number;
    acceleration?: number;
    activity: string;
    activity_numeric?: number;
    hrv?: number;
    perfusion_index?: number;
    irregular_rhythm?: number;
  };
  detection: {
    tier?: string;
    rule_status: string;
    is_anomaly: boolean;
    score?: number;
    ml_anomaly_score: number | null;
    is_ml_anomaly: boolean;
    severity: string;
    reason: string;
    z_scores?: Record<string, number>;
    contributing_signals: string[];
  };
  source: string;
}


export interface BaselineRanges {
  heartRate: {
    restingMin: number;
    restingMax: number;
    activeMin: number;
    activeMax: number;
    typical: number;
  };
  spO2: {
    min: number;
    max: number;
    typical: number;
  };
  skinTemp: {
    min: number;
    max: number;
    typical: number;
  };
  observationWindowDays: number;
  totalDataPoints: number;
  confidenceScore: number; // 0 - 100%
  hasSufficientData: boolean;
}

export interface AnomalyEvent {
  id: string;
  timestamp: string;
  severity: AnomalySeverity;
  title: string;
  contributingSignals: string[];
  explanation: string;
  heartRate: number;
  spO2: number;
  skinTemp: number;
  activity: ActivityState;
  acknowledged: boolean;
  recovered: boolean;
  durationSeconds: number;
}

export type DashboardTab = 
  | 'live-monitor' 
  | 'personal-baseline' 
  | 'anomaly-timeline' 
  | 'response-center' 
  | 'data-settings';
