import { useSyncExternalStore } from 'react';

export type DashboardDensity = 'dense' | 'expansive';

const STORAGE_KEY = 'me-dashboard-density';

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => {
    fn();
  });
}

export function getStoredDashboardDensity(): DashboardDensity | null {
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    if (v === 'dense' || v === 'expansive') return v;
  } catch {
    // Ignore storage failures in constrained environments.
  }
  return null;
}

export function readDashboardDensityFromDom(): DashboardDensity {
  return document.documentElement.dataset.dashboardDensity === 'dense' ? 'dense' : 'expansive';
}

/** Persists to <html data-dashboard-density> and localStorage; notifies subscribers. */
export function applyDashboardDensity(density: DashboardDensity) {
  document.documentElement.dataset.dashboardDensity = density;
  try {
    window.localStorage.setItem(STORAGE_KEY, density);
  } catch {
    // Ignore storage failures in constrained environments.
  }
  notify();
}

export function useDashboardDensity(): DashboardDensity {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    readDashboardDensityFromDom,
    (): DashboardDensity => 'expansive'
  );
}
