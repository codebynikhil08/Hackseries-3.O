import type {
  BackendHealthResponse,
  BackendTelemetryPayload,
  BaselineRanges,
  AnomalyEvent
} from '../types/pulseguard';

const getBaseUrl = (): string => {
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }
  if (typeof window !== 'undefined') {
    if (!window.location.hostname.includes('localhost') && !window.location.hostname.includes('127.0.0.1')) {
      return '/api';
    }
  }
  return 'http://127.0.0.1:8000/api';
};

const API_BASE_URL = getBaseUrl();

class PulseGuardApiService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = API_BASE_URL;
  }

  public getBaseUrl(): string {
    return this.baseUrl;
  }

  /**
   * Health and readiness check
   */
  async checkHealth(): Promise<BackendHealthResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    try {
      const res = await fetch(`${this.baseUrl}/health`, {
        signal: controller.signal,
        headers: { 'Accept': 'application/json' },
      });
      clearTimeout(timeoutId);
      if (!res.ok) {
        throw new Error(`Health check returned status ${res.status}`);
      }
      return await res.json();
    } catch (err) {
      clearTimeout(timeoutId);
      throw err;
    }
  }

  /**
   * Fetch latest telemetry reading & anomaly assessment
   */
  async getCurrentReading(): Promise<BackendTelemetryPayload> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);

    try {
      const res = await fetch(`${this.baseUrl}/readings/current`, {
        signal: controller.signal,
        headers: { 'Accept': 'application/json' },
      });
      clearTimeout(timeoutId);
      if (!res.ok) {
        throw new Error(`Current reading returned status ${res.status}`);
      }
      return await res.json();
    } catch (err) {
      clearTimeout(timeoutId);
      throw err;
    }
  }

  /**
   * Fetch recent reading history
   */
  async getReadingsHistory(): Promise<BackendTelemetryPayload[]> {
    const res = await fetch(`${this.baseUrl}/readings/history`);
    if (!res.ok) throw new Error(`History fetch failed: ${res.status}`);
    return await res.json();
  }

  /**
   * Fetch activity-adjusted baseline stats
   */
  async getBaseline(): Promise<BaselineRanges & { isModelTrained: boolean }> {
    const res = await fetch(`${this.baseUrl}/baseline`);
    if (!res.ok) throw new Error(`Baseline fetch failed: ${res.status}`);
    const data = await res.json();
    return {
      heartRate: {
        restingMin: data.heart_rate.resting_min,
        restingMax: data.heart_rate.resting_max,
        activeMin: data.heart_rate.active_min,
        activeMax: data.heart_rate.active_max,
        typical: data.heart_rate.typical,
      },
      spO2: {
        min: data.spo2.min,
        max: data.spo2.max,
        typical: data.spo2.typical,
      },
      skinTemp: {
        min: data.skin_temp.min,
        max: data.skin_temp.max,
        typical: data.skin_temp.typical,
      },
      observationWindowDays: data.observation_window_days,
      totalDataPoints: data.total_data_points,
      confidenceScore: data.confidence_score,
      hasSufficientData: data.has_sufficient_data,
      isModelTrained: data.is_model_trained,
    };
  }

  /**
   * Fetch list of anomaly events from backend
   */
  async getEvents(): Promise<AnomalyEvent[]> {
    const res = await fetch(`${this.baseUrl}/events`);
    if (!res.ok) throw new Error(`Events fetch failed: ${res.status}`);
    const data = await res.json();
    return data.map((ev: any) => ({
      id: ev.id,
      timestamp: ev.timestamp,
      severity: ev.severity,
      title: ev.title,
      contributingSignals: ev.contributing_signals,
      explanation: ev.explanation,
      heartRate: ev.heart_rate,
      spO2: ev.spo2,
      skinTemp: ev.skin_temperature,
      activity: ev.activity,
      acknowledged: ev.acknowledged,
      recovered: ev.recovered,
      durationSeconds: ev.duration_seconds,
    }));
  }

  /**
   * Acknowledge an anomaly event
   */
  async acknowledgeEvent(eventId: string): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/events/${eventId}/acknowledge`, {
        method: 'POST',
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  /**
   * Control the live streaming state (pause / resume)
   */
  async controlStream(action: 'pause' | 'resume'): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/stream/control`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  /**
   * Inject a test scenario (e.g. 'tachycardia', 'hypoxia', 'pyrexia', 'normal')
   */
  async injectScenario(scenario: 'normal' | 'tachycardia' | 'hypoxia' | 'pyrexia'): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/scenario/inject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}

export const pulseguardApi = new PulseGuardApiService();
