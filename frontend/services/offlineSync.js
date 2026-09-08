/**
 * LandSlideX Offline Sync Engine
 * Manages offline queues, IndexedDB/LocalStorage persistence, and auto-sync on reconnection.
 */

const QUEUE_KEY = 'landslidex_offline_queue';
const CACHE_RISK_KEY = 'landslidex_cached_risk_data';

export const offlineSync = {
  isOnline: () => navigator.onLine,

  getQueue: () => {
    try {
      const q = localStorage.getItem(QUEUE_KEY);
      return q ? JSON.parse(q) : [];
    } catch {
      return [];
    }
  },

  enqueueIncident: (incidentData) => {
    const queue = offlineSync.getQueue();
    const eventItem = {
      id: 'EVT-' + Date.now(),
      type: 'INCIDENT_REPORT',
      data: incidentData,
      created_at: new Date().toISOString()
    };
    queue.push(eventItem);
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    return eventItem;
  },

  clearQueue: () => {
    localStorage.removeItem(QUEUE_KEY);
  },

  cacheRiskData: (data) => {
    try {
      localStorage.setItem(CACHE_RISK_KEY, JSON.stringify({
        data,
        cached_at: new Date().toISOString()
      }));
    } catch (e) {
      console.warn('Cache write failed', e);
    }
  },

  getCachedRiskData: () => {
    try {
      const item = localStorage.getItem(CACHE_RISK_KEY);
      return item ? JSON.parse(item) : null;
    } catch {
      return null;
    }
  },

  syncPendingEvents: async () => {
    const queue = offlineSync.getQueue();
    if (!queue.length) {
      return { status: 'EMPTY', count: 0 };
    }

    try {
      const res = await fetch('/api/offline/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(queue)
      });
      if (res.ok) {
        const result = await res.json();
        offlineSync.clearQueue();
        return { status: 'SUCCESS', count: queue.length, result };
      }
    } catch (err) {
      console.warn('[OfflineSync] Server unreachable for flush:', err);
    }
    return { status: 'FAILED', count: queue.length };
  }
};
