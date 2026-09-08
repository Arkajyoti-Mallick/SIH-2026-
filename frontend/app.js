/**
 * LandSlideX - AI-Powered Landslide Risk Intelligence Platform
 * Smart India Hackathon 2026 (SIH26001) - Team Geo X
 * Core Single Page Application Logic & GIS Engine
 */

// Global State
const state = {
  currentRoute: 'dashboard',
  currentRole: 'Super Admin',
  currentSector: 'NER-024',
  isOnline: navigator.onLine,
  simulationPhase: 1,
  simulationActive: false,
  zones: [],
  sensors: [],
  alerts: [],
  incidents: [],
  actions: [],
  analytics: null,
  adminConfig: null,
  selectedZone: null,
  selectedSensor: null,
  mapInstance: null,
  googleMapInstance: null,
  mapEngine: localStorage.getItem('landslidex_map_engine') || 'leaflet',
  googleMapsApiKey: localStorage.getItem('landslidex_google_maps_key') || '',
  mapLayers: {},
  ws: null
};

// ==========================================
// INITIALIZATION & LIFECYCLE
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
  console.log('[LandSlideX] Initializing Mission Command System...');
  
  // Register Service Worker for PWA
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/service-worker.js')
      .then(() => console.log('[PWA] Service Worker Registered'))
      .catch(err => console.log('[PWA] Service Worker registration failed:', err));
  }

  // Network status listeners
  window.addEventListener('online', updateNetworkStatus);
  window.addEventListener('offline', updateNetworkStatus);
  updateNetworkStatus();

  // Clock
  setInterval(updateClock, 1000);
  updateClock();

  // Fetch initial system data
  await loadInitialData();

  // Initialize WebSocket connection
  connectWebSockets();

  // Hash change routing
  window.addEventListener('hashchange', handleRouting);
  handleRouting();
});

function updateClock() {
  const el = document.getElementById('sidebar-time');
  if (el) {
    const now = new Date();
    el.textContent = now.toTimeString().split(' ')[0] + ' UTC';
  }
}

function updateNetworkStatus() {
  state.isOnline = navigator.onLine;
  const pill = document.getElementById('connection-pill');
  const text = document.getElementById('connection-text');
  const banner = document.getElementById('offline-banner');

  if (state.isOnline) {
    if (pill) {
      pill.className = "flex items-center space-x-1.5 text-xs font-mono px-2.5 py-1 rounded-full bg-emerald-950/60 border border-emerald-800/60 text-emerald-400";
      text.textContent = "ONLINE";
    }
    if (banner) banner.classList.add('hidden');
    // Check pending offline queue
    syncOfflineQueue();
  } else {
    if (pill) {
      pill.className = "flex items-center space-x-1.5 text-xs font-mono px-2.5 py-1 rounded-full bg-amber-950/60 border border-amber-800/60 text-amber-400";
      text.textContent = "OFFLINE MODE";
    }
    if (banner) banner.classList.remove('hidden');
    updateOfflineBadge();
  }
}

function updateOfflineBadge() {
  const badge = document.getElementById('offline-pending-badge');
  if (badge) {
    const queue = JSON.parse(localStorage.getItem('landslidex_offline_queue') || '[]');
    badge.textContent = `${queue.length} Pending Events`;
  }
}

async function syncOfflineQueue() {
  const queue = JSON.parse(localStorage.getItem('landslidex_offline_queue') || '[]');
  if (!queue.length) return;

  try {
    const res = await fetch('/api/offline/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(queue)
    });
    if (res.ok) {
      localStorage.removeItem('landslidex_offline_queue');
      updateOfflineBadge();
      showToast('7 events synchronized successfully to cloud database.', 'success');
      await loadInitialData();
    }
  } catch (err) {
    console.warn('[Sync] Sync failed, server offline:', err);
  }
}

// ==========================================
// DATA INGESTION & WEBSOCKETS
// ==========================================
async function loadInitialData() {
  try {
    const [zonesRes, sensorsRes, alertsRes, incidentsRes, actionsRes, configRes, analyticsRes] = await Promise.all([
      fetch('/api/risk/zones').then(r => r.json()),
      fetch('/api/sensors').then(r => r.json()),
      fetch('/api/alerts').then(r => r.json()),
      fetch('/api/incidents').then(r => r.json()),
      fetch('/api/recommendations').then(r => r.json()),
      fetch('/api/admin/config').then(r => r.json()),
      fetch('/api/analytics').then(r => r.json())
    ]);

    state.zones = zonesRes;
    state.sensors = sensorsRes;
    state.alerts = alertsRes;
    state.incidents = incidentsRes;
    state.actions = actionsRes;
    state.adminConfig = configRes;
    state.analytics = analyticsRes;
    state.selectedZone = state.zones.find(z => z.zone_id === 'NER-024') || state.zones[0];

    // Cache to localStorage for offline fallback
    localStorage.setItem('landslidex_cached_zones', JSON.stringify(state.zones));
    localStorage.setItem('landslidex_cached_sensors', JSON.stringify(state.sensors));

    updateSidebarBadges();
  } catch (err) {
    console.warn('[LandSlideX] API load error, loading cached data:', err);
    const cached = localStorage.getItem('landslidex_cached_zones');
    if (cached) state.zones = JSON.parse(cached);
  }
}

function updateSidebarBadges() {
  const alertBadge = document.getElementById('sidebar-alert-badge');
  if (alertBadge) {
    const active = state.alerts.filter(a => a.status === 'ACTIVE').length;
    alertBadge.textContent = `${active} Active`;
    alertBadge.className = active > 0 
      ? "bg-red-900/60 border border-red-600/50 text-red-300 text-[10px] font-mono px-1.5 py-0.2 rounded-full animate-pulse"
      : "bg-slate-800 text-slate-400 text-[10px] font-mono px-1.5 py-0.2 rounded-full";
  }
  const incBadge = document.getElementById('sidebar-incident-badge');
  if (incBadge) {
    incBadge.textContent = state.incidents.length;
  }
}

function connectWebSockets() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host;
  
  try {
    const ws = new WebSocket(`${protocol}//${host}/ws/dashboard`);
    ws.onopen = () => console.log('[WS] Connected to LandSlideX Real-Time Gateway');
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        handleWebSocketMessage(msg);
      } catch (e) {
        console.warn('[WS] Parse error', e);
      }
    };
    ws.onclose = () => {
      console.log('[WS] Disconnected, retrying in 5s...');
      setTimeout(connectWebSockets, 5000);
    };
    state.ws = ws;
  } catch (err) {
    console.warn('[WS] WebSocket unavailable:', err);
  }
}

function handleWebSocketMessage(msg) {
  console.log('[WS Broadcast Received]', msg.type);
  if (msg.type === 'SIMULATION_PHASE_UPDATE') {
    const d = msg.data;
    state.simulationPhase = d.phase;
    const zIdx = state.zones.findIndex(z => z.zone_id === d.zone.zone_id);
    if (zIdx !== -1) state.zones[zIdx] = d.zone;
    if (d.alert) state.alerts.unshift(d.alert);
    updateSimulationUI(d.phase);
    updateSidebarBadges();
    if (state.currentRoute === 'dashboard') renderDashboard();
    if (state.currentRoute === 'risk-map') renderRiskMap();
    if (state.currentRoute === 'prediction') renderPrediction();
  } else if (msg.type === 'SIMULATION_RESET') {
    state.simulationPhase = 1;
    loadInitialData().then(() => {
      updateSimulationUI(1);
      if (state.currentRoute === 'dashboard') renderDashboard();
      if (state.currentRoute === 'risk-map') renderRiskMap();
    });
  } else if (msg.type === 'NEW_INCIDENT') {
    state.incidents.unshift(msg.incident);
    updateSidebarBadges();
    if (state.currentRoute === 'incidents') renderIncidents();
  }
}

// ==========================================
// CLIENT-SIDE ROUTER
// ==========================================
function handleRouting() {
  const rawHash = window.location.hash || '#/dashboard';
  const cleanRoute = rawHash.replace('#/', '').split('?')[0] || 'dashboard';
  state.currentRoute = cleanRoute;

  // Update active sidebar style
  document.querySelectorAll('.nav-link').forEach(el => {
    if (el.getAttribute('data-route') === cleanRoute) {
      el.classList.add('bg-slate-800', 'text-cyan-400', 'border-l-2', 'border-cyan-400');
    } else {
      el.classList.remove('bg-slate-800', 'text-cyan-400', 'border-l-2', 'border-cyan-400');
    }
  });

  const main = document.getElementById('app-content');
  if (!main) return;

  window.scrollTo(0, 0);

  switch (cleanRoute) {
    case '':
    case 'landing':
      renderLanding();
      break;
    case 'login':
      renderLogin();
      break;
    case 'about':
      renderAbout();
      break;
    case 'how-it-works':
      renderHowItWorks();
      break;
    case 'contact':
      renderContact();
      break;
    case 'dashboard':
      renderDashboard();
      break;
    case 'risk-map':
      renderRiskMap();
      break;
    case 'prediction':
      renderPrediction();
      break;
    case 'sensors':
      renderSensors();
      break;
    case 'alerts':
      renderAlerts();
      break;
    case 'incidents':
      renderIncidents();
      break;
    case 'actions':
      renderActions();
      break;
    case 'analytics':
      renderAnalytics();
      break;
    case 'profile':
      renderProfile();
      break;
    case 'settings':
      renderSettings();
      break;
    case 'admin':
      renderAdmin();
      break;
    default:
      renderDashboard();
  }

  // Re-render lucide icons
  setTimeout(() => lucide.createIcons(), 50);
}

// ==========================================
// ROLE SWITCHER (RBAC)
// ==========================================
function switchRole(roleName) {
  state.currentRole = roleName;
  const roleEl = document.getElementById('current-user-role');
  if (roleEl) roleEl.textContent = roleName;
  showToast(`Switched active profile to: ${roleName}`, 'info');
  handleRouting(); // Refresh current page with role context
}

function onSectorChange(sectorId) {
  state.currentSector = sectorId;
  const found = state.zones.find(z => z.zone_id === sectorId);
  if (found) {
    state.selectedZone = found;
    showToast(`Focused operational sector: ${found.name}`, 'info');
    if (state.currentRoute === 'dashboard') renderDashboard();
    if (state.currentRoute === 'risk-map') renderRiskMap();
    if (state.currentRoute === 'prediction') renderPrediction();
  }
}

// ==========================================
// SIH 5-PHASE SIMULATION CONTROLLER
// ==========================================
async function triggerSimPhase(phase) {
  state.simulationPhase = phase;
  updateSimulationUI(phase);

  try {
    const res = await fetch('/api/simulation/step', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phase: phase, zone_id: 'NER-024' })
    });
    if (res.ok) {
      const data = await res.json();
      const zIdx = state.zones.findIndex(z => z.zone_id === 'NER-024');
      if (zIdx !== -1) state.zones[zIdx] = data.zone;
      if (data.alert) state.alerts.unshift(data.alert);
      
      // Siren Alarm Banner Trigger on Phase 5
      const sirenBanner = document.getElementById('siren-banner');
      if (phase === 5) {
        if (sirenBanner) sirenBanner.classList.remove('hidden');
        playSirenSoundSimulation();
        showToast('CRITICAL SIREN TRIGGERED: Extreme Landslide Risk at Burtuk-Penlong!', 'danger');
      } else {
        if (sirenBanner) sirenBanner.classList.add('hidden');
        showToast(`Simulation updated: Phase ${phase} - ${data.phase_info.title}`, 'info');
      }

      updateSidebarBadges();
      handleRouting();
    }
  } catch (err) {
    console.error('Simulation step failed:', err);
  }
}

async function resetSimulationDemo() {
  state.simulationPhase = 1;
  const sirenBanner = document.getElementById('siren-banner');
  if (sirenBanner) sirenBanner.classList.add('hidden');
  updateSimulationUI(1);

  try {
    await fetch('/api/simulation/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ zone_id: 'NER-024' })
    });
    await loadInitialData();
    showToast('SIH Simulation reset to baseline normal conditions.', 'info');
    handleRouting();
  } catch (err) {
    console.error('Reset failed:', err);
  }
}

function updateSimulationUI(activePhase) {
  for (let i = 1; i <= 5; i++) {
    const btn = document.getElementById(`sim-btn-${i}`);
    if (btn) {
      if (i === activePhase) {
        btn.classList.remove('bg-slate-800', 'text-slate-300');
        btn.classList.add('bg-cyan-500', 'text-slate-950', 'font-bold');
      } else {
        btn.classList.remove('bg-cyan-500', 'text-slate-950', 'font-bold');
        btn.classList.add('bg-slate-800', 'text-slate-300');
      }
    }
  }
}

function playSirenSoundSimulation() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(440, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(880, ctx.currentTime + 0.5);
    osc.frequency.linearRampToValueAtTime(440, ctx.currentTime + 1.0);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.5);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 1.5);
  } catch (e) {
    console.log('Audio simulation note:', e);
  }
}

// Toast notification helper
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  const borderCol = type === 'danger' ? 'border-red-500 bg-red-950/90 text-red-200' :
                    type === 'success' ? 'border-emerald-500 bg-emerald-950/90 text-emerald-200' :
                    'border-cyan-500 bg-slate-900/95 text-slate-200';
  toast.className = `fixed bottom-6 right-6 z-50 tactical-card px-4 py-3 border shadow-2xl text-xs flex items-center space-x-2 font-mono ${borderCol} transition-all duration-300 transform translate-y-2 opacity-0`;
  toast.innerHTML = `<i data-lucide="${type === 'danger' ? 'alert-triangle' : type === 'success' ? 'check-circle' : 'info'}" class="w-4 h-4"></i><span>${message}</span>`;
  document.body.appendChild(toast);
  lucide.createIcons();

  setTimeout(() => {
    toast.classList.remove('translate-y-2', 'opacity-0');
  }, 10);

  setTimeout(() => {
    toast.classList.add('translate-y-2', 'opacity-0');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// ==========================================
// 1. PAGE: DASHBOARD (COMMAND CENTER)
// ==========================================
function renderDashboard() {
  const z = state.selectedZone || state.zones[0] || {};
  const maxRisk = Math.max(...state.zones.map(x => x.risk_score), 0);
  const activeAlerts = state.alerts.filter(a => a.status === 'ACTIVE');
  const extremeAlerts = activeAlerts.filter(a => a.risk_level === 'EXTREME').length;
  const highAlerts = activeAlerts.filter(a => a.risk_level === 'HIGH').length;

  const html = `
    <div class="space-y-6">
      
      <!-- Top Operational Header -->
      <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div class="flex items-center space-x-2 text-xs font-mono text-cyan-400 mb-1">
            <span class="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
            <span>NER REGIONAL DISASTER MANAGEMENT COMMAND DESK</span>
          </div>
          <h1 class="text-2xl font-black text-white tracking-tight">Landslide Risk Intelligence & Early Warning</h1>
          <p class="text-xs text-slate-400">Monitoring 8 Vulnerable Himalayan Lifeline Corridors • Real-time AI Ingestion Active</p>
        </div>

        <!-- Simulation Progress Callout -->
        <div class="tactical-card p-3 flex items-center space-x-4 border-cyan-900/60 bg-[#0b1222]">
          <div class="w-10 h-10 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-bold font-mono">
            P${state.simulationPhase}
          </div>
          <div>
            <div class="text-[10px] uppercase font-mono text-slate-400">SIH Hackathon Demonstration Flow</div>
            <div class="text-xs font-bold text-slate-200">Phase ${state.simulationPhase}: ${getPhaseTitle(state.simulationPhase)}</div>
          </div>
          <button onclick="triggerNextPhase()" class="px-2.5 py-1 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs rounded transition-colors">
            Advance Phase &rarr;
          </button>
        </div>
      </div>

      <!-- Top KPI Cards Row -->
      <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        
        <!-- Overall Risk -->
        <div class="tactical-card p-4 relative overflow-hidden">
          <div class="flex justify-between items-start mb-2">
            <span class="text-[11px] font-mono text-slate-400 uppercase">Max Regional Risk</span>
            <span class="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${getRiskBadgeClass(z.risk_level)}">${z.risk_level}</span>
          </div>
          <div class="flex items-baseline space-x-2">
            <span class="text-3xl font-black text-white font-mono">${z.risk_score}</span>
            <span class="text-xs text-slate-400 font-mono">/ 100</span>
          </div>
          <div class="text-[11px] text-slate-400 mt-1 flex items-center">
            <i data-lucide="${z.trend === 'INCREASING' ? 'trending-up' : 'minus'}" class="w-3.5 h-3.5 mr-1 ${z.trend === 'INCREASING' ? 'text-red-400' : 'text-slate-400'}"></i>
            <span>${z.name.split('(')[0]}</span>
          </div>
        </div>

        <!-- Active Alerts -->
        <div class="tactical-card p-4">
          <div class="flex justify-between items-start mb-2">
            <span class="text-[11px] font-mono text-slate-400 uppercase">Active Alerts</span>
            <i data-lucide="bell" class="w-4 h-4 text-amber-400"></i>
          </div>
          <div class="flex items-baseline space-x-2">
            <span class="text-3xl font-black text-amber-400 font-mono">${activeAlerts.length}</span>
            <span class="text-xs text-slate-400 font-mono">Dispatches</span>
          </div>
          <div class="text-[11px] text-slate-400 mt-1 font-mono">
            <span class="text-red-400 font-bold">${extremeAlerts} Extreme</span> • ${highAlerts} High
          </div>
        </div>

        <!-- Monitored Zones -->
        <div class="tactical-card p-4">
          <div class="flex justify-between items-start mb-2">
            <span class="text-[11px] font-mono text-slate-400 uppercase">Monitored Corridors</span>
            <i data-lucide="shield" class="w-4 h-4 text-emerald-400"></i>
          </div>
          <div class="flex items-baseline space-x-2">
            <span class="text-3xl font-black text-white font-mono">${state.zones.length}</span>
            <span class="text-xs text-slate-400 font-mono">Sectors</span>
          </div>
          <div class="text-[11px] text-slate-400 mt-1">
            NH-10, NH-29, NH-55 Corridors
          </div>
        </div>

        <!-- IoT Sensors -->
        <div class="tactical-card p-4">
          <div class="flex justify-between items-start mb-2">
            <span class="text-[11px] font-mono text-slate-400 uppercase">Sensor Telemetry</span>
            <i data-lucide="radio" class="w-4 h-4 text-cyan-400"></i>
          </div>
          <div class="flex items-baseline space-x-2">
            <span class="text-3xl font-black text-cyan-400 font-mono">${state.sensors.filter(s => s.status === 'ONLINE').length}</span>
            <span class="text-xs text-slate-400 font-mono">/ ${state.sensors.length} Online</span>
          </div>
          <div class="text-[11px] text-slate-400 mt-1 font-mono">
            96.5% Uptime • 10s Stream
          </div>
        </div>

        <!-- Critical Locations -->
        <div class="tactical-card p-4 col-span-2 md:col-span-1">
          <div class="flex justify-between items-start mb-2">
            <span class="text-[11px] font-mono text-slate-400 uppercase">High Vulnerability</span>
            <i data-lucide="alert-octagon" class="w-4 h-4 text-red-400"></i>
          </div>
          <div class="flex items-baseline space-x-2">
            <span class="text-3xl font-black text-red-400 font-mono">${state.zones.filter(x => x.risk_score >= 50).length}</span>
            <span class="text-xs text-slate-400 font-mono">Critical</span>
          </div>
          <div class="text-[11px] text-slate-400 mt-1">
            Burtuk, Rangpo, Pagala Pahar
          </div>
        </div>

      </div>

      <!-- MAIN GIS COMMAND MAP + LIVE TELEMETRY ROW -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        <!-- GIS Map (Left 2 Columns) -->
        <div class="lg:col-span-2 tactical-card p-4 flex flex-col space-y-3">
          <div class="flex items-center justify-between">
            <div class="flex items-center space-x-2">
              <i data-lucide="map" class="w-4 h-4 text-emerald-400"></i>
              <h2 class="text-sm font-bold text-white uppercase tracking-wide">Live GIS Risk Map (NER Operational Area)</h2>
            </div>
            <div class="flex items-center space-x-2 text-xs font-mono">
              <span class="text-slate-400">Layers:</span>
              <span class="px-2 py-0.5 bg-slate-800 rounded text-cyan-400">Zones</span>
              <span class="px-2 py-0.5 bg-slate-800 rounded text-emerald-400">Sensors</span>
              <span class="px-2 py-0.5 bg-slate-800 rounded text-amber-400">Highways</span>
              <a href="#/risk-map" class="text-xs text-cyan-400 hover:underline flex items-center ml-2">
                Fullscreen &rarr;
              </a>
            </div>
          </div>

          <!-- Leaflet Map Container -->
          <div id="dashboard-map" class="w-full h-[420px] rounded-lg border border-slate-800 relative z-10"></div>

          <!-- Quick Map Legend -->
          <div class="flex flex-wrap items-center justify-between text-[11px] font-mono text-slate-400 pt-1 border-t border-slate-800/80">
            <div class="flex items-center space-x-4">
              <span class="flex items-center"><span class="w-2.5 h-2.5 rounded-full bg-emerald-500 mr-1.5"></span>Low (0-25)</span>
              <span class="flex items-center"><span class="w-2.5 h-2.5 rounded-full bg-amber-500 mr-1.5"></span>Moderate (26-50)</span>
              <span class="flex items-center"><span class="w-2.5 h-2.5 rounded-full bg-orange-500 mr-1.5"></span>High (51-75)</span>
              <span class="flex items-center"><span class="w-2.5 h-2.5 rounded-full bg-red-500 mr-1.5"></span>Extreme (76-100)</span>
            </div>
            <span>Click any polygon zone for telemetry breakdown</span>
          </div>
        </div>

        <!-- Selected Zone Live Telemetry (Right Column) -->
        <div class="tactical-card p-5 flex flex-col justify-between space-y-4">
          <div>
            <div class="flex justify-between items-start border-b border-slate-800 pb-3">
              <div>
                <div class="text-[10px] font-mono uppercase text-cyan-400">Selected Risk Zone</div>
                <h3 class="text-base font-bold text-white">${z.name}</h3>
                <p class="text-xs text-slate-400 font-mono">${z.state} • ${z.highway}</p>
              </div>
              <div class="text-right">
                <div class="text-2xl font-black font-mono ${getRiskColorClass(z.risk_level)}">${z.risk_score}</div>
                <div class="text-[10px] font-mono text-slate-400 uppercase">Confidence: ${z.confidence}%</div>
              </div>
            </div>

            <!-- Environmental Meters Grid -->
            <div class="grid grid-cols-2 gap-3 my-4 text-xs font-mono">
              <div class="p-2.5 bg-[#070a12] rounded border border-slate-800">
                <span class="text-[10px] text-slate-400 block uppercase">24h Rainfall</span>
                <span class="text-sm font-bold text-blue-400">${z.rainfall_24h_mm} mm</span>
              </div>
              <div class="p-2.5 bg-[#070a12] rounded border border-slate-800">
                <span class="text-[10px] text-slate-400 block uppercase">Soil Saturation</span>
                <span class="text-sm font-bold text-cyan-400">${z.soil_moisture_vwc}% VWC</span>
              </div>
              <div class="p-2.5 bg-[#070a12] rounded border border-slate-800">
                <span class="text-[10px] text-slate-400 block uppercase">Slope Gradient</span>
                <span class="text-sm font-bold text-amber-400">${z.slope_deg}° Angle</span>
              </div>
              <div class="p-2.5 bg-[#070a12] rounded border border-slate-800">
                <span class="text-[10px] text-slate-400 block uppercase">Pore Pressure</span>
                <span class="text-sm font-bold text-purple-400">${z.pore_pressure_kpa} kPa</span>
              </div>
            </div>

            <!-- AI XAI Explanation Box -->
            <div class="p-3 rounded-lg bg-[#070a12] border border-slate-800 space-y-1.5">
              <div class="flex items-center space-x-1.5 text-xs text-cyan-400 font-semibold">
                <i data-lucide="sparkles" class="w-3.5 h-3.5"></i>
                <span>Explainable AI (XAI) Assessment:</span>
              </div>
              <p class="text-xs text-slate-300 leading-relaxed">
                Risk is <span class="font-bold text-white">${z.risk_level}</span>. Elevated due to continuous rain accumulation and soil moisture crossing saturation capacity on ${z.slope_deg}° steep colluvial mantle.
              </p>
            </div>
          </div>

          <!-- Recommended SOP Action -->
          <div class="border-t border-slate-800 pt-3">
            <div class="text-[10px] uppercase font-mono text-amber-400 font-bold mb-1">Recommended SOP Action:</div>
            <div class="p-2.5 rounded bg-amber-950/20 border border-amber-800/40 text-xs text-amber-200 leading-relaxed">
              ${z.recommended_action}
            </div>
            <div class="mt-3 flex space-x-2">
              <a href="#/actions" class="flex-1 py-1.5 text-center bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-semibold text-xs rounded transition-colors">
                Mobilize SOP &rarr;
              </a>
              <button onclick="openReportModal()" class="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded border border-slate-700">
                Field Check
              </button>
            </div>
          </div>

        </div>

      </div>

      <!-- ANALYTICS CHARTS & ACTIVE DISPATCHES ROW -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        <!-- Risk & Rainfall Trend Chart (Left 2 Columns) -->
        <div class="lg:col-span-2 tactical-card p-4 space-y-3">
          <div class="flex items-center justify-between">
            <div class="flex items-center space-x-2">
              <i data-lucide="line-chart" class="w-4 h-4 text-cyan-400"></i>
              <h3 class="text-sm font-bold text-white uppercase">24-Hour Telemetry & Risk Acceleration Trend</h3>
            </div>
            <span class="text-xs font-mono text-slate-400">Zone NER-024 Burtuk</span>
          </div>
          <div class="h-56 w-full">
            <canvas id="dashboardTrendChart"></canvas>
          </div>
        </div>

        <!-- Live Emergency Dispatch Status (Right Column) -->
        <div class="tactical-card p-4 flex flex-col space-y-3">
          <div class="flex items-center justify-between border-b border-slate-800 pb-2">
            <div class="flex items-center space-x-2">
              <i data-lucide="radio" class="w-4 h-4 text-red-400"></i>
              <h3 class="text-sm font-bold text-white uppercase">Multi-Channel Dispatches</h3>
            </div>
            <span class="text-[10px] font-mono text-emerald-400">CAP Gateway Ready</span>
          </div>

          <div class="space-y-2 text-xs font-mono flex-1">
            <div class="p-2.5 bg-[#070a12] rounded border border-slate-800 flex justify-between items-center">
              <div>
                <span class="text-slate-300 font-bold block">SMS Cell Broadcast</span>
                <span class="text-[10px] text-slate-400">4,850 Citizen devices</span>
              </div>
              <span class="px-2 py-0.5 bg-emerald-950/60 border border-emerald-800/60 text-emerald-400 rounded text-[10px]">DELIVERED</span>
            </div>

            <div class="p-2.5 bg-[#070a12] rounded border border-slate-800 flex justify-between items-center">
              <div>
                <span class="text-slate-300 font-bold block">Mobile Push Notification</span>
                <span class="text-[10px] text-slate-400">FCM / APNs Government</span>
              </div>
              <span class="px-2 py-0.5 bg-emerald-950/60 border border-emerald-800/60 text-emerald-400 rounded text-[10px]">DELIVERED</span>
            </div>

            <div class="p-2.5 bg-[#070a12] rounded border border-slate-800 flex justify-between items-center">
              <div>
                <span class="text-slate-300 font-bold block">IVR Voice Telephony</span>
                <span class="text-[10px] text-slate-400">Multilingual (Hindi/Nepali)</span>
              </div>
              <span class="px-2 py-0.5 bg-cyan-950/60 border border-cyan-800/60 text-cyan-400 rounded text-[10px]">SIMULATED</span>
            </div>

            <div class="p-2.5 bg-[#070a12] rounded border border-slate-800 flex justify-between items-center">
              <div>
                <span class="text-slate-300 font-bold block">Physical Acoustic Siren</span>
                <span class="text-[10px] text-slate-400">130dB High Altitude Mast</span>
              </div>
              <span class="px-2 py-0.5 ${z.risk_level === 'EXTREME' ? 'bg-red-950/80 border border-red-600 text-red-300 animate-pulse' : 'bg-slate-800 text-slate-400'} rounded text-[10px]">
                ${z.risk_level === 'EXTREME' ? 'ACTIVE' : 'STANDBY'}
              </span>
            </div>
          </div>

          <button onclick="window.location.hash='#/alerts'" class="w-full py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded border border-slate-700 text-center font-mono">
            View All ${state.alerts.length} Incident Alerts &rarr;
          </button>
        </div>

      </div>

    </div>
  `;

  document.getElementById('app-content').innerHTML = html;

  // Initialize Dashboard GIS Map (Google Maps or Leaflet)
  setTimeout(() => {
    renderMap('dashboard-map', [27.25, 88.55], 10);
    initDashboardTrendChart();
  }, 100);
}

function triggerNextPhase() {
  const next = state.simulationPhase < 5 ? state.simulationPhase + 1 : 1;
  triggerSimPhase(next);
}

function getPhaseTitle(p) {
  const titles = {
    1: "Normal Baseline (Risk 28)",
    2: "Rainfall Escalation (Risk 43)",
    3: "Soil Saturation (Risk 61)",
    4: "Sensor Anomaly (Risk 72)",
    5: "Critical Threshold (Risk 82 - EXTREME)"
  };
  return titles[p] || "Active State";
}

// Chart Initializer
function initDashboardTrendChart() {
  const ctx = document.getElementById('dashboardTrendChart');
  if (!ctx) return;

  const labels = ['18:00', '20:00', '22:00', '00:00', '02:00', '04:00', '06:00', '08:00', '10:00', '12:00'];
  const riskData = state.simulationPhase === 5 
    ? [28, 30, 34, 43, 49, 58, 65, 72, 79, 82]
    : [28, 29, 31, 32, 33, 34, 33, 32, 34, state.selectedZone.risk_score];

  const rainData = state.simulationPhase === 5
    ? [5, 8, 14, 26, 38, 52, 68, 84, 98, 104]
    : [4, 6, 8, 12, 16, 20, 22, 26, 30, state.selectedZone.rainfall_24h_mm];

  new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'AI Landslide Risk Score (0-100)',
          data: riskData,
          borderColor: '#ef4444',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          fill: true,
          tension: 0.3,
          yAxisID: 'y'
        },
        {
          label: '24h Rainfall Accumulation (mm)',
          data: rainData,
          borderColor: '#38bdf8',
          backgroundColor: 'rgba(56, 189, 248, 0.05)',
          borderDash: [4, 4],
          fill: false,
          tension: 0.3,
          yAxisID: 'y1'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { labels: { color: '#94a3b8', font: { family: 'JetBrains Mono', size: 11 } } }
      },
      scales: {
        x: { grid: { color: '#1e293b' }, ticks: { color: '#64748b', font: { family: 'JetBrains Mono', size: 10 } } },
        y: { min: 0, max: 100, grid: { color: '#1e293b' }, ticks: { color: '#ef4444', font: { family: 'JetBrains Mono', size: 10 } } },
        y1: { position: 'right', min: 0, max: 150, grid: { drawOnChartArea: false }, ticks: { color: '#38bdf8', font: { family: 'JetBrains Mono', size: 10 } } }
      }
    }
  });
}

// Leaflet Map Initializer
function initLeafletMap(containerId, center, zoom) {
  const container = document.getElementById(containerId);
  if (!container) return;

  // Clean existing
  if (state.mapInstance) {
    state.mapInstance.remove();
    state.mapInstance = null;
  }

  const map = L.map(containerId, { zoomControl: true }).setView(center, zoom);
  state.mapInstance = map;

  // Tactical Dark Matter basemap
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; CartoDB &copy; OpenStreetMap contributors',
    maxZoom: 18
  }).addTo(map);

  // 1. Render Zone Polygons
  state.zones.forEach(z => {
    const color = getRiskHexColor(z.risk_level);
    
    // Approximate polygon coords around center
    const lat = z.coordinates[0];
    const lng = z.coordinates[1];
    const bounds = [
      [lat - 0.015, lng - 0.020],
      [lat - 0.012, lng + 0.025],
      [lat + 0.018, lng + 0.022],
      [lat + 0.020, lng - 0.015]
    ];

    const poly = L.polygon(bounds, {
      color: color,
      fillColor: color,
      fillOpacity: z.risk_level === 'EXTREME' ? 0.45 : 0.25,
      weight: z.risk_level === 'EXTREME' ? 3 : 1.5
    }).addTo(map);

    poly.bindPopup(`
      <div class="text-xs space-y-1.5 p-1 font-mono">
        <div class="font-bold text-white text-sm border-b border-slate-700 pb-1">${z.name}</div>
        <div>Zone ID: <span class="text-cyan-400 font-bold">${z.zone_id}</span></div>
        <div>Risk Score: <span class="font-bold ${getRiskColorClass(z.risk_level)}">${z.risk_score}/100 (${z.risk_level})</span></div>
        <div>Confidence: <span class="text-slate-300">${z.confidence}%</span></div>
        <div>Rainfall 24h: <span class="text-blue-400">${z.rainfall_24h_mm} mm</span></div>
        <div>Soil Moisture: <span class="text-cyan-400">${z.soil_moisture_vwc}% VWC</span></div>
        <div>Slope Angle: <span class="text-amber-400">${z.slope_deg}°</span></div>
        <div class="text-[10px] text-amber-200 mt-1 p-1 bg-amber-950/40 rounded border border-amber-800/30">
          ${z.recommended_action}
        </div>
      </div>
    `);

    poly.on('click', () => {
      state.selectedZone = z;
      if (state.currentRoute === 'dashboard') renderDashboard();
    });
  });

  // 2. Render Sensors
  state.sensors.forEach(s => {
    const isWarn = s.status === 'WARNING';
    const markerHtml = `<div class="sensor-marker-pulse ${isWarn ? 'sensor-marker-warning' : ''}"></div>`;
    const icon = L.divIcon({
      className: 'custom-sensor-icon',
      html: markerHtml,
      iconSize: [14, 14],
      iconAnchor: [7, 7]
    });

    const marker = L.marker([s.latitude, s.longitude], { icon: icon }).addTo(map);
    marker.bindPopup(`
      <div class="text-xs space-y-1 p-1 font-mono">
        <div class="font-bold text-white border-b border-slate-700 pb-1">${s.sensor_id}: ${s.location_name}</div>
        <div>Status: <span class="${s.status === 'ONLINE' ? 'text-emerald-400' : 'text-red-400'} font-bold">${s.status}</span></div>
        <div>Soil Moisture: <span class="text-cyan-400">${s.soil_moisture_vwc}%</span></div>
        <div>24h Rain: <span class="text-blue-400">${s.rainfall_24h_mm} mm</span></div>
        <div>Tilt: <span class="text-amber-400">${s.tilt_deg}°</span></div>
        <div>Battery: <span class="text-emerald-400">${s.battery_pct}%</span></div>
        <button onclick="openSensorModal('${s.sensor_id}')" class="mt-2 w-full py-1 bg-cyan-600 text-slate-950 rounded font-bold hover:bg-cyan-500">
          Inspect Telemetry &rarr;
        </button>
      </div>
    `);
  });

  // 3. Render Strategic Highways
  const nh10Coords = [
    [26.8500, 88.4200], [26.9600, 88.4800], [27.1200, 88.5200],
    [27.1767, 88.5350], [27.2700, 88.5800], [27.3389, 88.6138]
  ];
  L.polyline(nh10Coords, {
    color: '#38bdf8',
    weight: 3,
    opacity: 0.85,
    dashArray: '6, 4'
  }).addTo(map).bindTooltip('NH-10 (Siliguri - Rangpo - Gangtok Lifeline)', { sticky: true });
}

// ==========================================
// GOOGLE MAPS PLATFORM API INTEGRATION
// ==========================================
const GOOGLE_MAPS_DARK_STYLE = [
  { "elementType": "geometry", "stylers": [{ "color": "#090d16" }] },
  { "elementType": "labels.text.stroke", "stylers": [{ "color": "#090d16" }] },
  { "elementType": "labels.text.fill", "stylers": [{ "color": "#94a3b8" }] },
  { "featureType": "administrative.locality", "elementType": "labels.text.fill", "stylers": [{ "color": "#38bdf8" }] },
  { "featureType": "poi", "elementType": "labels.text.fill", "stylers": [{ "color": "#64748b" }] },
  { "featureType": "road", "elementType": "geometry", "stylers": [{ "color": "#1e293b" }] },
  { "featureType": "road", "elementType": "geometry.stroke", "stylers": [{ "color": "#0f172a" }] },
  { "featureType": "road", "elementType": "labels.text.fill", "stylers": [{ "color": "#9ca3af" }] },
  { "featureType": "road.highway", "elementType": "geometry", "stylers": [{ "color": "#2563eb" }] },
  { "featureType": "transit", "elementType": "geometry", "stylers": [{ "color": "#1f2937" }] },
  { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#082f49" }] },
  { "featureType": "water", "elementType": "labels.text.fill", "stylers": [{ "color": "#38bdf8" }] }
];

function loadGoogleMapsScript(apiKey, callback) {
  if (window.google && window.google.maps) {
    if (callback) callback();
    return;
  }
  if (!apiKey) {
    openGoogleMapsKeyModal();
    return;
  }

  const existingScript = document.getElementById('google-maps-platform-script');
  if (existingScript) existingScript.remove();

  const script = document.createElement('script');
  script.id = 'google-maps-platform-script';
  script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=geometry,places,visualization`;
  script.async = true;
  script.defer = true;
  script.onload = () => {
    console.log('[LandSlideX] Google Maps Platform API successfully initialized.');
    if (callback) callback();
  };
  script.onerror = (err) => {
    console.warn('[LandSlideX] Google Maps API error (network or invalid key):', err);
    showToast('Google Maps API failed to load. Falling back to Tactical Leaflet GIS.', 'danger');
    state.mapEngine = 'leaflet';
    localStorage.setItem('landslidex_map_engine', 'leaflet');
    const sel = document.getElementById('map-engine-select');
    if (sel) sel.value = 'leaflet';
    initLeafletMap(state.activeMapContainer || 'dashboard-map', [27.25, 88.55], 10);
  };
  document.head.appendChild(script);
}

function initGoogleMap(containerId, center, zoom, mapType = 'terrain') {
  const container = document.getElementById(containerId);
  if (!container) return;

  state.activeMapContainer = containerId;

  // Clean existing Leaflet map on this container if present
  if (state.mapInstance) {
    try {
      state.mapInstance.remove();
    } catch(e) {}
    state.mapInstance = null;
  }

  const mapCenter = { lat: center[0], lng: center[1] };
  let googleMapTypeId = google.maps.MapTypeId.TERRAIN;
  if (mapType === 'google_satellite') googleMapTypeId = google.maps.MapTypeId.HYBRID;
  if (mapType === 'google_roadmap') googleMapTypeId = google.maps.MapTypeId.ROADMAP;

  const mapOptions = {
    zoom: zoom,
    center: mapCenter,
    mapTypeId: googleMapTypeId,
    styles: mapType === 'google_roadmap' ? GOOGLE_MAPS_DARK_STYLE : null,
    fullscreenControl: true,
    mapTypeControl: true,
    streetViewControl: false
  };

  const gmap = new google.maps.Map(container, mapOptions);
  state.googleMapInstance = gmap;

  const infoWindow = new google.maps.InfoWindow();

  // 1. Render Polygon Risk Zones on Google Maps
  state.zones.forEach(z => {
    const lat = z.coordinates[0];
    const lng = z.coordinates[1];
    const color = getRiskHexColor(z.risk_level);

    const polygonCoords = [
      { lat: lat - 0.015, lng: lng - 0.020 },
      { lat: lat - 0.012, lng: lng + 0.025 },
      { lat: lat + 0.018, lng: lng + 0.022 },
      { lat: lat + 0.020, lng: lng - 0.015 }
    ];

    const poly = new google.maps.Polygon({
      paths: polygonCoords,
      strokeColor: color,
      strokeOpacity: 0.9,
      strokeWeight: z.risk_level === 'EXTREME' ? 3 : 2,
      fillColor: color,
      fillOpacity: z.risk_level === 'EXTREME' ? 0.45 : 0.25,
      map: gmap
    });

    poly.addListener('click', (event) => {
      state.selectedZone = z;
      const content = `
        <div style="color: #0f172a; font-family: 'JetBrains Mono', monospace; font-size: 11px; padding: 4px; line-height: 1.4;">
          <strong style="font-size: 13px; color: #0b1120;">${z.name}</strong><br/>
          Zone ID: <strong>${z.zone_id}</strong><br/>
          Risk Score: <strong style="color: ${color};">${z.risk_score}/100 (${z.risk_level})</strong><br/>
          Confidence: <strong>${z.confidence}%</strong><br/>
          24h Rain: <strong>${z.rainfall_24h_mm} mm</strong> | Moisture: <strong>${z.soil_moisture_vwc}%</strong><br/>
          Slope: <strong>${z.slope_deg}°</strong> | Elevation: <strong>${z.elevation_m} m</strong><br/>
          <div style="background: #fef3c7; color: #92400e; padding: 4px; border-radius: 4px; margin-top: 4px;">
            ${z.recommended_action}
          </div>
        </div>
      `;
      infoWindow.setContent(content);
      infoWindow.setPosition(event.latLng);
      infoWindow.open(gmap);
      if (state.currentRoute === 'dashboard') renderDashboard();
    });
  });

  // 2. Render Sensors on Google Maps
  state.sensors.forEach(s => {
    const isWarn = s.status === 'WARNING';
    const marker = new google.maps.Marker({
      position: { lat: s.latitude, lng: s.longitude },
      map: gmap,
      title: `${s.sensor_id}: ${s.location_name}`,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 6,
        fillColor: isWarn ? '#ef4444' : '#38bdf8',
        fillOpacity: 1,
        strokeColor: '#ffffff',
        strokeWeight: 2
      }
    });

    marker.addListener('click', () => {
      const content = `
        <div style="color: #0f172a; font-family: 'JetBrains Mono', monospace; font-size: 11px; padding: 4px;">
          <strong style="font-size: 12px;">${s.sensor_id}: ${s.location_name}</strong><br/>
          Status: <strong style="color: ${isWarn ? '#ef4444' : '#059669'};">${s.status}</strong><br/>
          Soil Moisture: <strong>${s.soil_moisture_vwc}% VWC</strong><br/>
          24h Rainfall: <strong>${s.rainfall_24h_mm} mm</strong><br/>
          Tilt Angle: <strong>${s.tilt_deg}°</strong> | Battery: <strong>${s.battery_pct}%</strong>
        </div>
      `;
      infoWindow.setContent(content);
      infoWindow.open(gmap, marker);
    });
  });

  // 3. Render Highways
  const nh10Coords = [
    { lat: 26.8500, lng: 88.4200 }, { lat: 26.9600, lng: 88.4800 }, { lat: 27.1200, lng: 88.5200 },
    { lat: 27.1767, lng: 88.5350 }, { lat: 27.2700, lng: 88.5800 }, { lat: 27.3389, lng: 88.6138 }
  ];
  new google.maps.Polyline({
    path: nh10Coords,
    geodesic: true,
    strokeColor: '#38bdf8',
    strokeOpacity: 0.9,
    strokeWeight: 4,
    map: gmap
  });
}

function renderMap(containerId, center, zoom) {
  state.activeMapContainer = containerId;
  const engine = state.mapEngine || 'leaflet';

  if (engine.startsWith('google_')) {
    const key = state.googleMapsApiKey || localStorage.getItem('landslidex_google_maps_key');
    if (window.google && window.google.maps) {
      initGoogleMap(containerId, center, zoom, engine);
    } else if (key) {
      loadGoogleMapsScript(key, () => {
        initGoogleMap(containerId, center, zoom, engine);
      });
    } else {
      // Key not configured yet: prompt modal and fallback
      openGoogleMapsKeyModal();
      initLeafletMap(containerId, center, zoom);
    }
  } else {
    initLeafletMap(containerId, center, zoom);
  }
}

function switchMapEngine(engine) {
  state.mapEngine = engine;
  localStorage.setItem('landslidex_map_engine', engine);

  if (engine.startsWith('google_')) {
    const key = state.googleMapsApiKey || localStorage.getItem('landslidex_google_maps_key');
    if (!key && !(window.google && window.google.maps)) {
      openGoogleMapsKeyModal();
      return;
    }
  }

  showToast(`Switched map engine to: ${engine.replace('_', ' ').toUpperCase()}`, 'info');
  const activeContainer = state.currentRoute === 'risk-map' ? 'gis-full-map' : 'dashboard-map';
  renderMap(activeContainer, [27.25, 88.55], state.currentRoute === 'risk-map' ? 11 : 10);
}

function openGoogleMapsKeyModal() {
  const modal = document.getElementById('google-key-modal');
  const input = document.getElementById('gmaps-key-input');
  if (input) {
    input.value = state.googleMapsApiKey || localStorage.getItem('landslidex_google_maps_key') || '';
  }
  if (modal) modal.classList.remove('hidden');
}

function closeGoogleMapsKeyModal() {
  const modal = document.getElementById('google-key-modal');
  if (modal) modal.classList.add('hidden');
}

async function saveGoogleMapsKey() {
  const input = document.getElementById('gmaps-key-input');
  const key = input ? input.value.trim() : '';

  state.googleMapsApiKey = key;
  localStorage.setItem('landslidex_google_maps_key', key);
  closeGoogleMapsKeyModal();

  if (key) {
    showToast('Google Maps API Key saved! Initializing Google Maps...', 'info');
    loadGoogleMapsScript(key, () => {
      state.mapEngine = 'google_terrain';
      localStorage.setItem('landslidex_map_engine', 'google_terrain');
      const sel = document.getElementById('map-engine-select');
      if (sel) sel.value = 'google_terrain';
      const activeContainer = state.currentRoute === 'risk-map' ? 'gis-full-map' : 'dashboard-map';
      renderMap(activeContainer, [27.25, 88.55], state.currentRoute === 'risk-map' ? 11 : 10);
    });

    // Sync to backend config
    try {
      await fetch('/api/admin/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...state.adminConfig,
          google_maps_api_key: key
        })
      });
    } catch(e) {}
  } else {
    showToast('API Key cleared. Using Tactical Leaflet GIS.', 'info');
    state.mapEngine = 'leaflet';
    localStorage.setItem('landslidex_map_engine', 'leaflet');
    const sel = document.getElementById('map-engine-select');
    if (sel) sel.value = 'leaflet';
    initLeafletMap(state.activeMapContainer || 'dashboard-map', [27.25, 88.55], 10);
  }
}

// ==========================================
// 2. PAGE: FULLSCREEN GIS RISK MAP
// ==========================================
function renderRiskMap() {
  const z = state.selectedZone || state.zones[0];
  const html = `
    <div class="space-y-4 h-[calc(100vh-6rem)] flex flex-col">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-xl font-bold text-white flex items-center space-x-2">
            <i data-lucide="map" class="w-5 h-5 text-emerald-400"></i>
            <span>Geospatial Risk Intelligence Map</span>
          </h1>
          <p class="text-xs text-slate-400 font-mono">Multi-layer Vector Engine • Terrain Slope, In-situ Nodes, Highways & Relief Shelters</p>
        </div>

        <!-- Layer Toggles -->
        <div class="flex items-center space-x-2 text-xs font-mono">
          <label class="flex items-center space-x-1 px-2.5 py-1 bg-slate-900 border border-slate-700 rounded cursor-pointer text-slate-300">
            <input type="checkbox" checked class="rounded bg-slate-800 text-cyan-500">
            <span>Risk Zones</span>
          </label>
          <label class="flex items-center space-x-1 px-2.5 py-1 bg-slate-900 border border-slate-700 rounded cursor-pointer text-slate-300">
            <input type="checkbox" checked class="rounded bg-slate-800 text-cyan-500">
            <span>IoT Sensors</span>
          </label>
          <label class="flex items-center space-x-1 px-2.5 py-1 bg-slate-900 border border-slate-700 rounded cursor-pointer text-slate-300">
            <input type="checkbox" checked class="rounded bg-slate-800 text-cyan-500">
            <span>Highways</span>
          </label>
          <label class="flex items-center space-x-1 px-2.5 py-1 bg-slate-900 border border-slate-700 rounded cursor-pointer text-slate-300">
            <input type="checkbox" checked class="rounded bg-slate-800 text-cyan-500">
            <span>Historical Landslides</span>
          </label>
        </div>
      </div>

      <!-- Map & Detail Drawer Split -->
      <div class="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-4 overflow-hidden">
        
        <!-- Large Leaflet GIS Map (3 Columns) -->
        <div class="lg:col-span-3 tactical-card rounded-lg overflow-hidden relative border-slate-800">
          <div id="gis-full-map" class="w-full h-full min-h-[500px]"></div>
        </div>

        <!-- Zone Inspection Drawer (Right Column) -->
        <div class="tactical-card p-4 overflow-y-auto space-y-4 border-slate-800">
          <div class="border-b border-slate-800 pb-2">
            <div class="text-[10px] font-mono text-cyan-400 uppercase">Sector Inspector</div>
            <h3 class="text-base font-bold text-white">${z.name}</h3>
            <span class="inline-block mt-1 text-[11px] font-mono px-2 py-0.5 rounded font-bold ${getRiskBadgeClass(z.risk_level)}">
              ${z.risk_level} RISK (${z.risk_score}/100)
            </span>
          </div>

          <div class="space-y-2 text-xs font-mono">
            <div class="flex justify-between border-b border-slate-800/60 py-1">
              <span class="text-slate-400">Prediction Confidence:</span>
              <span class="text-slate-200 font-bold">${z.confidence}%</span>
            </div>
            <div class="flex justify-between border-b border-slate-800/60 py-1">
              <span class="text-slate-400">Rainfall (24h Accrual):</span>
              <span class="text-blue-400 font-bold">${z.rainfall_24h_mm} mm</span>
            </div>
            <div class="flex justify-between border-b border-slate-800/60 py-1">
              <span class="text-slate-400">Soil Moisture (VWC):</span>
              <span class="text-cyan-400 font-bold">${z.soil_moisture_vwc}%</span>
            </div>
            <div class="flex justify-between border-b border-slate-800/60 py-1">
              <span class="text-slate-400">Mean Slope Gradient:</span>
              <span class="text-amber-400 font-bold">${z.slope_deg}°</span>
            </div>
            <div class="flex justify-between border-b border-slate-800/60 py-1">
              <span class="text-slate-400">Pore Water Pressure:</span>
              <span class="text-purple-400 font-bold">${z.pore_pressure_kpa} kPa</span>
            </div>
            <div class="flex justify-between border-b border-slate-800/60 py-1">
              <span class="text-slate-400">Exposed Population:</span>
              <span class="text-slate-200 font-bold">${z.population_exposed.toLocaleString()}</span>
            </div>
            <div class="flex justify-between border-b border-slate-800/60 py-1">
              <span class="text-slate-400">Lifeline Corridor:</span>
              <span class="text-slate-200">${z.highway}</span>
            </div>
          </div>

          <!-- SOP Directive -->
          <div class="p-3 bg-[#070a12] rounded border border-slate-800 space-y-1">
            <div class="text-[10px] font-mono uppercase text-amber-400 font-bold">Action Directive:</div>
            <p class="text-xs text-slate-300 leading-relaxed">${z.recommended_action}</p>
          </div>

          <!-- Action Buttons -->
          <div class="space-y-2 pt-2">
            <button onclick="window.location.hash='#/prediction'" class="w-full py-2 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs rounded transition-colors text-center">
              View AI Prediction Breakdown &rarr;
            </button>
            <button onclick="openReportModal()" class="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded border border-slate-700 text-center">
              File Field Observation
            </button>
          </div>
        </div>

      </div>
    </div>
  `;

  document.getElementById('app-content').innerHTML = html;
  setTimeout(() => renderMap('gis-full-map', [27.25, 88.55], 11), 100);
}

// ==========================================
// 3. PAGE: AI RISK PREDICTION & XAI
// ==========================================
function renderPrediction() {
  const z = state.selectedZone || state.zones[0];
  const fs = (1.45 - (z.risk_score / 100) * 0.95).toFixed(2);

  const html = `
    <div class="space-y-6 max-w-5xl mx-auto">
      
      <div>
        <div class="text-xs font-mono text-indigo-400 uppercase">Decision Support Intelligence Engine</div>
        <h1 class="text-2xl font-bold text-white">AI Landslide Risk Prediction & Explainability (XAI)</h1>
        <p class="text-xs text-slate-400">Trained on Historical GSI Event Inventories, In-situ Sensor Telemetry & High-Resolution DEMs</p>
      </div>

      <!-- Main Prediction Dial & Factor of Safety Row -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        <!-- Risk Dial Card -->
        <div class="tactical-card p-6 flex flex-col items-center justify-center text-center space-y-3">
          <div class="text-xs font-mono text-slate-400 uppercase tracking-wider">AI Risk Score (0-100)</div>
          <div class="w-36 h-36 rounded-full border-4 ${z.risk_level === 'EXTREME' ? 'border-red-500 shadow-red-500/30' : z.risk_level === 'HIGH' ? 'border-orange-500 shadow-orange-500/30' : 'border-amber-500 shadow-amber-500/30'} flex flex-col items-center justify-center shadow-xl bg-[#070a12]">
            <span class="text-4xl font-black font-mono text-white">${z.risk_score}</span>
            <span class="text-[11px] font-bold uppercase font-mono ${getRiskColorClass(z.risk_level)}">${z.risk_level}</span>
          </div>
          <div class="text-xs text-slate-400 font-mono">
            Confidence: <span class="text-white font-bold">${z.confidence}%</span> • Trend: <span class="text-red-400 font-bold">${z.trend}</span>
          </div>
        </div>

        <!-- Geotechnical Safety Factor Card -->
        <div class="tactical-card p-6 flex flex-col justify-between space-y-4">
          <div>
            <div class="text-xs font-mono text-slate-400 uppercase">Geotechnical Stability Proxy</div>
            <h3 class="text-base font-bold text-white mt-1">Factor of Safety (FS)</h3>
            <p class="text-xs text-slate-400 mt-1">Derived from Mohr-Coulomb shear strength against downslope driving gravity stresses.</p>
          </div>

          <div class="p-4 rounded-lg bg-[#070a12] border border-slate-800 text-center">
            <div class="text-3xl font-black font-mono ${fs < 1.0 ? 'text-red-400' : fs < 1.2 ? 'text-amber-400' : 'text-emerald-400'}">
              FS = ${fs}
            </div>
            <div class="text-[11px] font-mono text-slate-400 mt-1">
              ${fs < 1.0 ? 'CRITICAL: Driving force exceeds shear resistance' : 'MARGINAL: Close to failure threshold'}
            </div>
          </div>

          <div class="text-[11px] text-slate-400 font-mono">
            Model: <span class="text-slate-200">RandomForestClassifier + IsolationForest (v2.4.1)</span>
          </div>
        </div>

        <!-- XAI Rationale Box -->
        <div class="tactical-card p-6 flex flex-col justify-between space-y-3">
          <div>
            <div class="text-xs font-mono text-cyan-400 uppercase flex items-center space-x-1.5">
              <i data-lucide="bot" class="w-4 h-4"></i>
              <span>Natural Language AI Rationale</span>
            </div>
            <h3 class="text-base font-bold text-white mt-1">Attribution Analysis</h3>
          </div>

          <div class="p-3.5 rounded bg-[#070a12] border border-slate-800 text-xs text-slate-300 leading-relaxed flex-1">
            "Estimated risk for <strong>${z.name}</strong> is <strong>${z.risk_level} (${z.risk_score}/100)</strong>. Primary contributing triggers: sustained 24h rainfall of <strong>${z.rainfall_24h_mm} mm</strong>, soil saturation crossing critical threshold (<strong>${z.soil_moisture_vwc}%</strong>), <strong>${z.slope_deg}°</strong> slope angle, and active highway road cut proximity."
          </div>

          <div class="text-[10px] text-slate-400 italic">
            * AI decision-support intelligence for administrative early warning; verify on-site before evacuation.
          </div>
        </div>

      </div>

      <!-- Contributing Factor Breakdown Bars -->
      <div class="tactical-card p-6 space-y-4">
        <h3 class="text-sm font-bold text-white uppercase tracking-wider flex items-center space-x-2">
          <i data-lucide="sliders-horizontal" class="w-4 h-4 text-cyan-400"></i>
          <span>Feature Importance & Trigger Contribution Breakdown</span>
        </h3>

        <div class="space-y-3">
          <div>
            <div class="flex justify-between text-xs font-mono mb-1">
              <span class="text-slate-300">1. Rainfall Accrual & Intensity (24h/72h + API)</span>
              <span class="text-cyan-400 font-bold">82% Contribution (${z.rainfall_24h_mm} mm)</span>
            </div>
            <div class="w-full bg-[#070a12] h-2.5 rounded-full overflow-hidden border border-slate-800">
              <div class="bg-gradient-to-r from-blue-500 to-cyan-400 h-full rounded-full" style="width: 82%"></div>
            </div>
          </div>

          <div>
            <div class="flex justify-between text-xs font-mono mb-1">
              <span class="text-slate-300">2. In-situ Soil Moisture & Pore Water Pressure</span>
              <span class="text-cyan-400 font-bold">74% Contribution (${z.soil_moisture_vwc}% VWC)</span>
            </div>
            <div class="w-full bg-[#070a12] h-2.5 rounded-full overflow-hidden border border-slate-800">
              <div class="bg-gradient-to-r from-cyan-500 to-teal-400 h-full rounded-full" style="width: 74%"></div>
            </div>
          </div>

          <div>
            <div class="flex justify-between text-xs font-mono mb-1">
              <span class="text-slate-300">3. Terrain Slope Gradient & DEM Curvature</span>
              <span class="text-amber-400 font-bold">68% Contribution (${z.slope_deg}°)</span>
            </div>
            <div class="w-full bg-[#070a12] h-2.5 rounded-full overflow-hidden border border-slate-800">
              <div class="bg-gradient-to-r from-amber-500 to-orange-400 h-full rounded-full" style="width: 68%"></div>
            </div>
          </div>

          <div>
            <div class="flex justify-between text-xs font-mono mb-1">
              <span class="text-slate-300">4. GSI Historical Landslide Density</span>
              <span class="text-purple-400 font-bold">61% Contribution (High Susceptibility)</span>
            </div>
            <div class="w-full bg-[#070a12] h-2.5 rounded-full overflow-hidden border border-slate-800">
              <div class="bg-gradient-to-r from-purple-500 to-indigo-400 h-full rounded-full" style="width: 61%"></div>
            </div>
          </div>

          <div>
            <div class="flex justify-between text-xs font-mono mb-1">
              <span class="text-slate-300">5. Road Excavation Cut & Toe Stream Erosion</span>
              <span class="text-emerald-400 font-bold">52% Contribution (50m Proximity)</span>
            </div>
            <div class="w-full bg-[#070a12] h-2.5 rounded-full overflow-hidden border border-slate-800">
              <div class="bg-gradient-to-r from-emerald-500 to-green-400 h-full rounded-full" style="width: 52%"></div>
            </div>
          </div>
        </div>

      </div>

    </div>
  `;

  document.getElementById('app-content').innerHTML = html;
}

// ==========================================
// 4. PAGE: SENSORS & TELEMETRY
// ==========================================
function renderSensors() {
  const online = state.sensors.filter(s => s.status === 'ONLINE').length;
  const offline = state.sensors.filter(s => s.status === 'OFFLINE').length;
  const warning = state.sensors.filter(s => s.status === 'WARNING').length;

  const html = `
    <div class="space-y-6">
      
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 class="text-xl font-bold text-white flex items-center space-x-2">
            <i data-lucide="radio" class="w-5 h-5 text-cyan-400"></i>
            <span>In-situ IoT Sensor Array & Health Monitoring</span>
          </h1>
          <p class="text-xs text-slate-400 font-mono">Borehole Piezometers, Tipping Buckets, Triaxial Inclinometers & Weather Telemetry</p>
        </div>

        <!-- Sensor Status Ticker -->
        <div class="flex items-center space-x-2 font-mono text-xs">
          <span class="px-2.5 py-1 bg-emerald-950/60 border border-emerald-800/60 text-emerald-400 rounded">${online} Online</span>
          <span class="px-2.5 py-1 bg-red-950/60 border border-red-800/60 text-red-400 rounded">${warning} Warning</span>
          <span class="px-2.5 py-1 bg-slate-900 border border-slate-800 text-slate-400 rounded">${offline} Offline</span>
        </div>
      </div>

      <!-- Sensor Grid Table -->
      <div class="tactical-card overflow-hidden border-slate-800">
        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs font-mono">
            <thead class="bg-[#070a12] border-b border-slate-800 text-slate-400 uppercase text-[10px]">
              <tr>
                <th class="p-3">Sensor ID</th>
                <th class="p-3">Location / Sector</th>
                <th class="p-3">Soil Moisture</th>
                <th class="p-3">24h Rain</th>
                <th class="p-3">Tilt</th>
                <th class="p-3">Pore Press.</th>
                <th class="p-3">Battery</th>
                <th class="p-3">Status</th>
                <th class="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-800/60">
              ${state.sensors.map(s => `
                <tr class="hover:bg-slate-800/40 transition-colors">
                  <td class="p-3 font-bold text-cyan-400">${s.sensor_id}</td>
                  <td class="p-3 text-white">
                    <div>${s.location_name}</div>
                    <span class="text-[10px] text-slate-400">${s.zone_id}</span>
                  </td>
                  <td class="p-3 text-cyan-300">${s.soil_moisture_vwc}%</td>
                  <td class="p-3 text-blue-300">${s.rainfall_24h_mm} mm</td>
                  <td class="p-3 ${s.tilt_deg > 0.5 ? 'text-red-400 font-bold' : 'text-slate-300'}">${s.tilt_deg}°</td>
                  <td class="p-3 text-purple-300">${s.pore_pressure_kpa} kPa</td>
                  <td class="p-3 text-emerald-400">${s.battery_pct}%</td>
                  <td class="p-3">
                    <span class="px-2 py-0.5 rounded text-[10px] font-bold ${
                      s.status === 'ONLINE' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/50' :
                      s.status === 'WARNING' ? 'bg-red-950 text-red-400 border border-red-800/50 animate-pulse' :
                      'bg-slate-800 text-slate-400'
                    }">${s.status}</span>
                  </td>
                  <td class="p-3 text-right">
                    <button onclick="openSensorModal('${s.sensor_id}')" class="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700">
                      Telemetry
                    </button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  `;

  document.getElementById('app-content').innerHTML = html;
}

// Sensor Modal
function openSensorModal(sensorId) {
  const s = state.sensors.find(x => x.sensor_id === sensorId) || state.sensors[0];
  state.selectedSensor = s;

  document.getElementById('sensor-modal-title').textContent = `Sensor ${s.sensor_id} Telemetry Stream`;
  document.getElementById('sensor-modal-sub').textContent = `${s.location_name} • ${s.zone_id}`;
  document.getElementById('sensor-modal-moisture').textContent = `${s.soil_moisture_vwc}%`;
  document.getElementById('sensor-modal-rain').textContent = `${s.rainfall_24h_mm} mm`;
  document.getElementById('sensor-modal-tilt').textContent = `${s.tilt_deg}°`;
  document.getElementById('sensor-modal-health').textContent = `${s.battery_pct}% • ${s.health}`;

  document.getElementById('sensor-modal').classList.remove('hidden');

  setTimeout(() => {
    const ctx = document.getElementById('sensorTelemetryChart');
    if (!ctx) return;
    new Chart(ctx, {
      type: 'line',
      data: {
        labels: ['6h ago', '5h ago', '4h ago', '3h ago', '2h ago', '1h ago', 'Now'],
        datasets: [
          {
            label: 'Soil Moisture %',
            data: [s.soil_moisture_vwc - 12, s.soil_moisture_vwc - 10, s.soil_moisture_vwc - 8, s.soil_moisture_vwc - 5, s.soil_moisture_vwc - 3, s.soil_moisture_vwc - 1, s.soil_moisture_vwc],
            borderColor: '#38bdf8',
            tension: 0.3
          },
          {
            label: 'Tilt Angle (°)',
            data: [0.08, 0.09, 0.11, 0.14, 0.18, 0.21, s.tilt_deg],
            borderColor: '#f59e0b',
            tension: 0.3
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { labels: { color: '#94a3b8' } } },
        scales: {
          x: { ticks: { color: '#64748b' } },
          y: { ticks: { color: '#94a3b8' } }
        }
      }
    });
  }, 100);
}

function closeSensorModal() {
  document.getElementById('sensor-modal').classList.add('hidden');
}

// ==========================================
// 5. PAGE: ALERTS & EMERGENCY WARNINGS
// ==========================================
function renderAlerts() {
  const html = `
    <div class="space-y-6">
      
      <div class="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <h1 class="text-xl font-bold text-white flex items-center space-x-2">
            <i data-lucide="bell" class="w-5 h-5 text-amber-400"></i>
            <span>Emergency Alert Center & Multi-Channel Warnings</span>
          </h1>
          <p class="text-xs text-slate-400 font-mono">Disaster Management Early Warning Notifications • SMS / FCM / Email / IVR / Siren</p>
        </div>

        <button onclick="triggerSimPhase(5)" class="px-3 py-1.5 bg-red-600/30 border border-red-500/50 text-red-300 rounded font-mono text-xs hover:bg-red-600/50 animate-pulse">
          Simulate Critical Alert Event &rarr;
        </button>
      </div>

      <!-- Alerts List -->
      <div class="space-y-4">
        ${state.alerts.map(a => `
          <div class="tactical-card p-5 border-l-4 ${a.risk_level === 'EXTREME' ? 'border-l-red-500' : 'border-l-amber-500'} space-y-3">
            <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div class="flex items-center space-x-3">
                <span class="text-xs font-mono font-bold px-2 py-0.5 rounded ${getRiskBadgeClass(a.risk_level)}">
                  ${a.risk_level} ALERT (${a.risk_score}/100)
                </span>
                <span class="text-sm font-bold text-white">${a.zone_name}</span>
                <span class="text-xs font-mono text-slate-400">ID: ${a.alert_id}</span>
              </div>
              <div class="text-xs font-mono text-slate-400 flex items-center space-x-2">
                <span>${a.timestamp}</span>
                <span class="px-2 py-0.5 rounded ${a.status === 'ACTIVE' ? 'bg-red-950 text-red-300 border border-red-800/60' : 'bg-emerald-950 text-emerald-400'}">
                  ${a.status}
                </span>
              </div>
            </div>

            <p class="text-xs text-slate-300 leading-relaxed font-mono">
              <span class="text-slate-400">Cause:</span> ${a.cause}
            </p>

            <div class="text-xs font-mono p-2.5 rounded bg-[#070a12] border border-slate-800 text-amber-300">
              <span class="font-bold text-amber-400 uppercase">SOP Directive:</span> ${a.recommended_action}
            </div>

            <!-- Delivery Tracker Pills -->
            <div class="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/80 text-xs font-mono">
              <div class="flex items-center space-x-2">
                <span class="text-slate-400">Channels:</span>
                <span class="px-2 py-0.5 bg-slate-900 border border-slate-800 text-emerald-400 rounded text-[10px]">SMS ✓</span>
                <span class="px-2 py-0.5 bg-slate-900 border border-slate-800 text-emerald-400 rounded text-[10px]">Push ✓</span>
                <span class="px-2 py-0.5 bg-slate-900 border border-slate-800 text-emerald-400 rounded text-[10px]">Email ✓</span>
                <span class="px-2 py-0.5 bg-slate-900 border border-slate-800 text-cyan-400 rounded text-[10px]">IVR ✓</span>
                <span class="px-2 py-0.5 ${a.risk_level === 'EXTREME' ? 'bg-red-950 text-red-300 border border-red-800' : 'bg-slate-900 text-slate-400'} rounded text-[10px]">
                  Siren ${a.risk_level === 'EXTREME' ? 'ACTIVE' : 'STANDBY'}
                </span>
              </div>

              ${a.status === 'ACTIVE' ? `
                <button onclick="acknowledgeAlert('${a.alert_id}')" class="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded text-xs">
                  Acknowledge Alert &rarr;
                </button>
              ` : `
                <span class="text-[11px] text-slate-400">Acknowledged by: <strong class="text-slate-200">${a.acknowledged_by || 'Officer'}</strong></span>
              `}
            </div>
          </div>
        `).join('')}
      </div>

    </div>
  `;

  document.getElementById('app-content').innerHTML = html;
}

async function acknowledgeAlert(alertId) {
  try {
    const res = await fetch(`/api/alerts/${alertId}/acknowledge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        alert_id: alertId,
        acknowledged_by: state.currentRole,
        notes: "Official command center acknowledgement."
      })
    });
    if (res.ok) {
      showToast(`Alert ${alertId} acknowledged successfully by ${state.currentRole}`, 'success');
      await loadInitialData();
      renderAlerts();
    }
  } catch (e) {
    console.error('Ack error:', e);
  }
}

// ==========================================
// 6. PAGE: INCIDENTS & CITIZEN REPORTING
// ==========================================
function renderIncidents() {
  const verifiedCount = state.incidents.filter(i => i.status === 'Verified').length;
  const reviewCount = state.incidents.filter(i => i.status === 'Under Review').length;

  const html = `
    <div class="space-y-6">
      
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 class="text-xl font-bold text-white flex items-center space-x-2">
            <i data-lucide="clipboard-list" class="w-5 h-5 text-orange-400"></i>
            <span>Citizen & Field Officer Incident Reports</span>
          </h1>
          <p class="text-xs text-slate-400 font-mono">Geo-tagged Ground Cracks, Slope Movements, Rockfalls & Verification Queue</p>
        </div>

        <button onclick="openReportModal()" class="px-3.5 py-2 bg-gradient-to-r from-red-600 to-amber-600 text-white text-xs font-bold rounded-lg shadow-lg flex items-center space-x-1.5">
          <i data-lucide="plus" class="w-4 h-4"></i>
          <span>Report New Hazard Observation</span>
        </button>
      </div>

      <!-- Verification Queue Status Bar -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div class="tactical-card p-3 font-mono text-xs">
          <span class="text-slate-400 block text-[10px] uppercase">Total Reports</span>
          <span class="text-xl font-black text-white">${state.incidents.length} Observations</span>
        </div>
        <div class="tactical-card p-3 font-mono text-xs">
          <span class="text-slate-400 block text-[10px] uppercase">Verified by Field Officers</span>
          <span class="text-xl font-black text-emerald-400">${verifiedCount} Verified</span>
        </div>
        <div class="tactical-card p-3 font-mono text-xs">
          <span class="text-slate-400 block text-[10px] uppercase">Under Verification Review</span>
          <span class="text-xl font-black text-amber-400">${reviewCount} Pending</span>
        </div>
      </div>

      <!-- Incident Reports Cards -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        ${state.incidents.map(i => `
          <div class="tactical-card p-4 space-y-3 flex flex-col justify-between">
            <div>
              <div class="flex justify-between items-start mb-2">
                <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold ${getSeverityBadge(i.severity)}">
                  ${i.incident_type} (${i.severity})
                </span>
                <span class="text-[10px] font-mono text-slate-400">${i.timestamp}</span>
              </div>

              <h4 class="text-sm font-bold text-white">${i.location_name}</h4>
              <p class="text-xs text-slate-400 font-mono">${i.zone_id} • Reported by: ${i.reported_by}</p>
              <p class="text-xs text-slate-300 mt-2 leading-relaxed">${i.description}</p>
            </div>

            <!-- Verification Footer & Human-in-the-Loop Action -->
            <div class="pt-2 border-t border-slate-800 text-xs font-mono flex items-center justify-between">
              <div>
                <span class="text-[10px] text-slate-400 block">Status:</span>
                <span class="font-bold ${i.status === 'Verified' ? 'text-emerald-400' : 'text-amber-400'}">${i.status}</span>
              </div>

              ${i.status === 'Under Review' ? `
                <button onclick="verifyIncident('${i.incident_id}')" class="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold rounded text-xs flex items-center space-x-1">
                  <i data-lucide="check" class="w-3.5 h-3.5"></i>
                  <span>Field Verify & Feed AI</span>
                </button>
              ` : `
                <span class="text-[10px] text-slate-400">Verified by: ${i.verified_by || 'Officer'}</span>
              `}
            </div>
          </div>
        `).join('')}
      </div>

    </div>
  `;

  document.getElementById('app-content').innerHTML = html;
}

function getSeverityBadge(sev) {
  if (sev === 'CRITICAL') return 'bg-red-950 text-red-300 border border-red-800';
  if (sev === 'HIGH') return 'bg-orange-950 text-orange-300 border border-orange-800';
  return 'bg-amber-950 text-amber-300 border border-amber-800';
}

async function verifyIncident(incidentId) {
  try {
    const res = await fetch(`/api/incidents/${incidentId}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        incident_id: incidentId,
        status: "Verified",
        verified_by: `${state.currentRole} (BRO / DDMA)`,
        verification_notes: "On-site physical inspection confirmed ground tension cracks. Retraining sample logged.",
        confirm_as_training_sample: true
      })
    });
    if (res.ok) {
      showToast(`Incident ${incidentId} confirmed! Ground-truth data added to AI retraining queue.`, 'success');
      await loadInitialData();
      renderIncidents();
    }
  } catch (e) {
    console.error('Verify failed:', e);
  }
}

// Modal logic for reporting
function openReportModal() {
  document.getElementById('report-modal').classList.remove('hidden');
}

function closeReportModal() {
  document.getElementById('report-modal').classList.add('hidden');
}

async function handleIncidentSubmit(e) {
  e.preventDefault();
  const zone = document.getElementById('inc-zone').value;
  const type = document.getElementById('inc-type').value;
  const sev = document.getElementById('inc-severity').value;
  const loc = document.getElementById('inc-location').value;
  const desc = document.getElementById('inc-desc').value;

  const payload = {
    zone_id: zone,
    location_name: loc,
    latitude: 27.345,
    longitude: 88.608,
    incident_type: type,
    severity: sev,
    description: desc,
    reported_by: state.currentRole === 'Citizen' ? 'Tashi Lepcha (Citizen)' : `${state.currentRole} (Field Unit)`,
    reporter_role: state.currentRole,
    photo_url: '/demo/crack_burtuk.jpg'
  };

  if (!navigator.onLine) {
    // Queue offline
    const queue = JSON.parse(localStorage.getItem('landslidex_offline_queue') || '[]');
    queue.push({ type: 'INCIDENT_REPORT', data: payload });
    localStorage.setItem('landslidex_offline_queue', JSON.stringify(queue));
    updateOfflineBadge();
    closeReportModal();
    showToast('Offline Mode: Incident report saved locally in device cache. Will auto-sync on reconnect.', 'info');
    return;
  }

  try {
    const res = await fetch('/api/incidents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      closeReportModal();
      showToast('Incident observation submitted successfully.', 'success');
      await loadInitialData();
      if (state.currentRoute === 'incidents') renderIncidents();
    }
  } catch (err) {
    console.error('Submission failed:', err);
  }
}

// ==========================================
// 7. PAGE: ACTION MATRIX (SOP RECOMMENDATIONS)
// ==========================================
function renderActions() {
  const html = `
    <div class="space-y-6 max-w-5xl mx-auto">
      
      <div>
        <h1 class="text-xl font-bold text-white flex items-center space-x-2">
          <i data-lucide="check-square" class="w-5 h-5 text-teal-400"></i>
          <span>Standard Operating Procedure (SOP) Action Matrix</span>
        </h1>
        <p class="text-xs text-slate-400 font-mono">Decision-support action protocols for Road Diversions, Evacuations, and Structural Inspections</p>
      </div>

      <div class="space-y-4">
        ${state.actions.map(act => `
          <div class="tactical-card p-5 space-y-3 border-l-4 ${
            act.priority === 'EMERGENCY' ? 'border-l-red-500' :
            act.priority === 'WARNING' ? 'border-l-orange-500' : 'border-l-cyan-500'
          }">
            <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div class="flex items-center space-x-2">
                <span class="text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                  act.priority === 'EMERGENCY' ? 'bg-red-950 text-red-300' : 'bg-cyan-950 text-cyan-300'
                }">${act.priority}</span>
                <span class="text-sm font-bold text-white">${act.title}</span>
              </div>
              <div class="text-xs font-mono text-slate-400">
                SOP Code: <span class="text-cyan-400 font-bold">${act.sop_code}</span>
              </div>
            </div>

            <p class="text-xs text-slate-300 leading-relaxed font-mono">${act.description}</p>

            <div class="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800 text-xs font-mono">
              <span class="text-slate-400">Responsible Agency: <strong class="text-slate-200">${act.responsible_agency}</strong></span>
              
              <div class="flex items-center space-x-2">
                <span class="text-[10px] uppercase font-mono px-2 py-0.5 rounded ${
                  act.status === 'COMPLETED' ? 'bg-emerald-950 text-emerald-400' : 'bg-amber-950 text-amber-400'
                }">${act.status}</span>
                <button onclick="toggleActionStatus('${act.action_id}', '${act.status}')" class="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700 text-xs">
                  ${act.status === 'COMPLETED' ? 'Re-open' : 'Mark Completed ✓'}
                </button>
              </div>
            </div>
          </div>
        `).join('')}
      </div>

    </div>
  `;

  document.getElementById('app-content').innerHTML = html;
}

async function toggleActionStatus(actId, currentStatus) {
  const newStatus = currentStatus === 'COMPLETED' ? 'IN_PROGRESS' : 'COMPLETED';
  try {
    await fetch(`/api/recommendations/${actId}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });
    showToast(`Updated SOP action ${actId} to ${newStatus}`, 'info');
    await loadInitialData();
    renderActions();
  } catch (e) {
    console.error('Action update failed:', e);
  }
}

// ==========================================
// 8. PAGE: ANALYTICS & DISASTER REPORTS
// ==========================================
function renderAnalytics() {
  const a = state.analytics || {};
  const html = `
    <div class="space-y-6">
      
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 class="text-xl font-bold text-white flex items-center space-x-2">
            <i data-lucide="bar-chart-3" class="w-5 h-5 text-purple-400"></i>
            <span>Disaster Analytics & Model Evaluation Metrics</span>
          </h1>
          <p class="text-xs text-slate-400 font-mono">Performance Auditing • False Alarm Rate, Sensor Uptime & Risk Distribution</p>
        </div>

        <button onclick="exportReport()" class="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded font-mono text-xs flex items-center space-x-1.5">
          <i data-lucide="download" class="w-3.5 h-3.5"></i>
          <span>Export Official PDF/CSV Dossier</span>
        </button>
      </div>

      <!-- Top Statistical Indicators -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div class="tactical-card p-4 text-center font-mono">
          <span class="text-[10px] text-slate-400 uppercase block">Model Verification Rate</span>
          <span class="text-2xl font-black text-emerald-400">${a.verification_rate_pct || 88.2}%</span>
          <span class="text-[10px] text-slate-400 block mt-1">Ground-truth verified</span>
        </div>
        <div class="tactical-card p-4 text-center font-mono">
          <span class="text-[10px] text-slate-400 uppercase block">False Alarm Rate</span>
          <span class="text-2xl font-black text-cyan-400">${a.false_alarm_rate_pct || 11.8}%</span>
          <span class="text-[10px] text-slate-400 block mt-1">Calibrated low</span>
        </div>
        <div class="tactical-card p-4 text-center font-mono">
          <span class="text-[10px] text-slate-400 uppercase block">Sensor Fleet Uptime</span>
          <span class="text-2xl font-black text-white">${a.sensor_uptime_pct || 96.5}%</span>
          <span class="text-[10px] text-slate-400 block mt-1">43 / 48 Nodes active</span>
        </div>
        <div class="tactical-card p-4 text-center font-mono">
          <span class="text-[10px] text-slate-400 uppercase block">Mean Alert Response</span>
          <span class="text-2xl font-black text-amber-400">${a.mean_acknowledgement_time_min || 4.2} min</span>
          <span class="text-[10px] text-slate-400 block mt-1">DEOC desk latency</span>
        </div>
      </div>

      <!-- Charts Grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div class="tactical-card p-4 space-y-2">
          <h3 class="text-xs font-bold text-white uppercase font-mono">Monsoon Landslide Incidents vs Rainfall</h3>
          <div class="h-60 w-full">
            <canvas id="monthlyIncidentsChart"></canvas>
          </div>
        </div>

        <div class="tactical-card p-4 space-y-2">
          <h3 class="text-xs font-bold text-white uppercase font-mono">Regional Sector Risk Distribution</h3>
          <div class="h-60 w-full">
            <canvas id="riskDistributionChart"></canvas>
          </div>
        </div>
      </div>

    </div>
  `;

  document.getElementById('app-content').innerHTML = html;

  setTimeout(() => {
    initAnalyticsCharts();
  }, 100);
}

function initAnalyticsCharts() {
  const ctx1 = document.getElementById('monthlyIncidentsChart');
  if (ctx1) {
    new Chart(ctx1, {
      type: 'bar',
      data: {
        labels: ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'],
        datasets: [
          {
            label: 'Recorded Landslides',
            data: [4, 9, 26, 44, 38, 18],
            backgroundColor: '#f97316'
          },
          {
            label: 'AI Early Warnings Dispatched',
            data: [7, 14, 38, 62, 55, 29],
            backgroundColor: '#38bdf8'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { labels: { color: '#94a3b8' } } },
        scales: { x: { ticks: { color: '#64748b' } }, y: { ticks: { color: '#94a3b8' } } }
      }
    });
  }

  const ctx2 = document.getElementById('riskDistributionChart');
  if (ctx2) {
    new Chart(ctx2, {
      type: 'doughnut',
      data: {
        labels: ['Low Risk (0-25)', 'Moderate (26-50)', 'High (51-75)', 'Extreme (76-100)'],
        datasets: [{
          data: [1, 2, 2, 1],
          backgroundColor: ['#10b981', '#f59e0b', '#f97316', '#ef4444'],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8' } } }
      }
    });
  }
}

function exportReport() {
  showToast('Generating official LandSlideX National Disaster Dossier (PDF/CSV)...', 'info');
  setTimeout(() => {
    showToast('Report downloaded: LandSlideX_NER_Dossier_2026.csv', 'success');
  }, 1200);
}

// ==========================================
// 9. PUBLIC PAGES (LANDING, ABOUT, HOW IT WORKS, CONTACT, LOGIN)
// ==========================================
function renderLanding() {
  const html = `
    <div class="space-y-16 py-6 max-w-6xl mx-auto">
      
      <!-- HERO SECTION -->
      <section class="text-center space-y-6 pt-8">
        <div class="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-cyan-950/70 border border-cyan-800/60 text-cyan-400 font-mono text-xs">
          <span class="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
          <span>SMART INDIA HACKATHON 2026 • PROBLEM SIH26001</span>
        </div>

        <h1 class="text-4xl sm:text-6xl font-black text-white tracking-tight leading-tight">
          Predict Risk. Detect Danger. <br/>
          <span class="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-400 to-indigo-400">Save Lives.</span>
        </h1>

        <p class="text-base sm:text-lg text-slate-300 max-w-3xl mx-auto leading-relaxed">
          An AI-powered geospatial early warning platform combining real-time rainfall, in-situ soil telemetry, DEM terrain slope mechanics, and GSI historical landslide records to protect the North-Eastern Region.
        </p>

        <div class="flex flex-wrap items-center justify-center gap-4 pt-4">
          <a href="#/dashboard" class="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black text-sm rounded-lg shadow-xl shadow-cyan-500/20 transition-all">
            Open Live Command Dashboard &rarr;
          </a>
          <a href="#/how-it-works" class="px-6 py-3 bg-[#0f172a] hover:bg-slate-800 border border-slate-700 text-slate-200 font-semibold text-sm rounded-lg transition-all">
            Explore How LandSlideX Works
          </a>
        </div>
      </section>

      <!-- 12 SECTIONS OVERVIEW -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div class="tactical-card p-6 space-y-3">
          <div class="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
            <i data-lucide="layers" class="w-5 h-5"></i>
          </div>
          <h3 class="text-base font-bold text-white">1. Multi-Source Data Fusion</h3>
          <p class="text-xs text-slate-400 leading-relaxed">Fuses IMD precipitation, IoT borehole piezometers, inclinometer tilt sensors, satellite imagery, and DEM digital elevation rasters.</p>
        </div>

        <div class="tactical-card p-6 space-y-3">
          <div class="w-10 h-10 rounded-lg bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <i data-lucide="brain-circuit" class="w-5 h-5"></i>
          </div>
          <h3 class="text-base font-bold text-white">2. AI Risk Intelligence</h3>
          <p class="text-xs text-slate-400 leading-relaxed">Continuous 0-100 risk scoring powered by ensemble Random Forest + Isolation Forest models with Explainable AI attribution.</p>
        </div>

        <div class="tactical-card p-6 space-y-3">
          <div class="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <i data-lucide="map-pin" class="w-5 h-5"></i>
          </div>
          <h3 class="text-base font-bold text-white">3. GIS Command Visualizer</h3>
          <p class="text-xs text-slate-400 leading-relaxed">High-performance vector mapping with dynamic risk heatmaps, highway lifeline monitoring (NH-10, NH-29), and settlement overlays.</p>
        </div>

        <div class="tactical-card p-6 space-y-3">
          <div class="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <i data-lucide="megaphone" class="w-5 h-5"></i>
          </div>
          <h3 class="text-base font-bold text-white">4. Multi-Channel Early Warning</h3>
          <p class="text-xs text-slate-400 leading-relaxed">Automated C-DOT/CAP compatible broadcast: Cell broadcast SMS, Push alarms, multilingual IVR voice calls, and physical acoustic sirens.</p>
        </div>

        <div class="tactical-card p-6 space-y-3">
          <div class="w-10 h-10 rounded-lg bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
            <i data-lucide="wifi-off" class="w-5 h-5"></i>
          </div>
          <h3 class="text-base font-bold text-white">5. Offline-First Field PWA</h3>
          <p class="text-xs text-slate-400 leading-relaxed">Engineered for disconnected Himalayan mountain valleys. Field officers view cached offline maps and queue ground observations for auto-sync.</p>
        </div>

        <div class="tactical-card p-6 space-y-3">
          <div class="w-10 h-10 rounded-lg bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400">
            <i data-lucide="refresh-cw" class="w-5 h-5"></i>
          </div>
          <h3 class="text-base font-bold text-white">6. Human-in-the-Loop Feedback</h3>
          <p class="text-xs text-slate-400 leading-relaxed">Field officer verification directly updates verification rates and feeds verified ground-truth data back into continuous AI retraining.</p>
        </div>
      </div>

    </div>
  `;
  document.getElementById('app-content').innerHTML = html;
}

function renderHowItWorks() {
  const html = `
    <div class="space-y-8 max-w-4xl mx-auto py-4">
      <div>
        <div class="text-xs font-mono text-cyan-400 uppercase">Interactive System Workflow</div>
        <h1 class="text-2xl font-bold text-white">How LandSlideX Operates</h1>
        <p class="text-xs text-slate-400">From Raw Multi-Source Environmental Data to Life-Saving Early Warning</p>
      </div>

      <div class="space-y-4 font-mono text-xs">
        <div class="tactical-card p-4 border-l-4 border-l-blue-500 flex items-start space-x-4">
          <span class="w-8 h-8 rounded bg-blue-500/20 text-blue-400 font-bold flex items-center justify-center shrink-0">01</span>
          <div>
            <h4 class="text-sm font-bold text-white mb-1">Multi-Source Telemetry Ingestion</h4>
            <p class="text-slate-400 leading-relaxed">AWS tipping rain gauges, RS485 soil moisture sensors, and borehole piezometers publish telemetry every 10 seconds via MQTT and LoRaWAN gateways.</p>
          </div>
        </div>

        <div class="tactical-card p-4 border-l-4 border-l-cyan-500 flex items-start space-x-4">
          <span class="w-8 h-8 rounded bg-cyan-500/20 text-cyan-400 font-bold flex items-center justify-center shrink-0">02</span>
          <div>
            <h4 class="text-sm font-bold text-white mb-1">Validation & Antecedent Precipitation Index (API)</h4>
            <p class="text-slate-400 leading-relaxed">Cleanses telemetry spikes and calculates 7-day Antecedent Precipitation Index decay curves to assess cumulative soil pore pressure buildup.</p>
          </div>
        </div>

        <div class="tactical-card p-4 border-l-4 border-l-indigo-500 flex items-start space-x-4">
          <span class="w-8 h-8 rounded bg-indigo-500/20 text-indigo-400 font-bold flex items-center justify-center shrink-0">03</span>
          <div>
            <h4 class="text-sm font-bold text-white mb-1">AI Risk Estimation & Anomaly Detection</h4>
            <p class="text-slate-400 leading-relaxed">Ensemble Random Forest evaluates probability against DEM slope angles while Isolation Forest monitors for rapid sensor tilt accelerations indicating slope failure.</p>
          </div>
        </div>

        <div class="tactical-card p-4 border-l-4 border-l-amber-500 flex items-start space-x-4">
          <span class="w-8 h-8 rounded bg-amber-500/20 text-amber-400 font-bold flex items-center justify-center shrink-0">04</span>
          <div>
            <h4 class="text-sm font-bold text-white mb-1">Calibrated 0-100 Risk Score & SOP Action</h4>
            <p class="text-slate-400 leading-relaxed">Converts probabilities into calibrated Low, Moderate, High, or Extreme risk tiers, automatically linking site-specific Standard Operating Procedures.</p>
          </div>
        </div>

        <div class="tactical-card p-4 border-l-4 border-l-red-500 flex items-start space-x-4">
          <span class="w-8 h-8 rounded bg-red-500/20 text-red-400 font-bold flex items-center justify-center shrink-0">05</span>
          <div>
            <h4 class="text-sm font-bold text-white mb-1">Automated Early Warning Dispatch</h4>
            <p class="text-slate-400 leading-relaxed">When Extreme threshold is reached, cell broadcast SMS, push notifications, and high-decibel physical sirens alert affected road corridors.</p>
          </div>
        </div>

        <div class="tactical-card p-4 border-l-4 border-l-emerald-500 flex items-start space-x-4">
          <span class="w-8 h-8 rounded bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center shrink-0">06</span>
          <div>
            <h4 class="text-sm font-bold text-white mb-1">Field Officer Verification & Feedback Loop</h4>
            <p class="text-slate-400 leading-relaxed">Field personnel verify observations on site. Verifications update false-alarm analytics and feed back into periodic ML model retraining.</p>
          </div>
        </div>
      </div>

    </div>
  `;
  document.getElementById('app-content').innerHTML = html;
}

function renderAbout() {
  const html = `
    <div class="space-y-6 max-w-4xl mx-auto py-4">
      <div>
        <div class="text-xs font-mono text-cyan-400 uppercase">Smart India Hackathon 2026</div>
        <h1 class="text-2xl font-bold text-white">About Project LandSlideX • Team Geo X</h1>
        <p class="text-xs text-slate-400 font-mono">Theme: Disaster Management • Problem Statement: SIH26001</p>
      </div>

      <div class="tactical-card p-6 space-y-4 text-xs text-slate-300 leading-relaxed">
        <h3 class="text-sm font-bold text-white uppercase font-mono">The North-Eastern Region (NER) Challenge</h3>
        <p>The North-Eastern Himalayan states (Sikkim, Nagaland, Meghalaya, Mizoram, Assam, Arunachal Pradesh) experience severe monsoon-triggered landslides annual causing loss of life and prolonged isolation of lifeline national highways (e.g. NH-10 and NH-29).</p>
        <p>Current mechanisms rely on isolated rain gauges or binary "landslide / no landslide" alerts without localized geotechnical calibration, leading to high false alarms and public complacency.</p>
      </div>

      <div class="tactical-card p-6 space-y-3 font-mono text-xs">
        <h3 class="text-sm font-bold text-white uppercase">Team Geo X Mission</h3>
        <p class="text-slate-300">"Build a production-grade, explainable, and offline-first AI risk platform that delivers actionable lead-time to district magistrates, engineers, and citizens before slope failure occurs."</p>
      </div>
    </div>
  `;
  document.getElementById('app-content').innerHTML = html;
}

function renderContact() {
  const html = `
    <div class="space-y-6 max-w-4xl mx-auto py-4">
      <div>
        <h1 class="text-xl font-bold text-white">Emergency Disaster Hotlines & Support</h1>
        <p class="text-xs text-slate-400 font-mono">Direct Communication Directory for NER State Disaster Management Authorities</p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
        <div class="tactical-card p-4 space-y-2">
          <h4 class="text-sm font-bold text-cyan-400">National Disaster Management Authority (NDMA)</h4>
          <p class="text-slate-300">Toll-Free Control Room: <strong>1078</strong></p>
          <p class="text-slate-400">Email: controlroom@ndma.gov.in</p>
        </div>
        <div class="tactical-card p-4 space-y-2">
          <h4 class="text-sm font-bold text-emerald-400">Sikkim State Disaster Management Authority (SSDMA)</h4>
          <p class="text-slate-300">Gangtok DEOC: <strong>03592-202461 / 1077</strong></p>
          <p class="text-slate-400">Email: deoc.east@sikkim.gov.in</p>
        </div>
        <div class="tactical-card p-4 space-y-2">
          <h4 class="text-sm font-bold text-amber-400">Border Roads Organisation (BRO Project Swastik)</h4>
          <p class="text-slate-300">NH-10 Sector Hotline: <strong>03592-205128</strong></p>
          <p class="text-slate-400">Emergency Road Clearing Cell</p>
        </div>
        <div class="tactical-card p-4 space-y-2">
          <h4 class="text-sm font-bold text-purple-400">Nagaland State Disaster Management (NSDMA)</h4>
          <p class="text-slate-300">Kohima State DEOC: <strong>0370-2291122</strong></p>
          <p class="text-slate-400">NH-29 Emergency Response Desk</p>
        </div>
      </div>
    </div>
  `;
  document.getElementById('app-content').innerHTML = html;
}

function renderLogin() {
  const html = `
    <div class="max-w-md mx-auto py-12 space-y-6">
      <div class="text-center space-y-2">
        <div class="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mx-auto">
          <i data-lucide="shield-check" class="w-6 h-6"></i>
        </div>
        <h1 class="text-2xl font-bold text-white">LandSlideX Authentication</h1>
        <p class="text-xs text-slate-400 font-mono">Role-Based Access Control (RBAC) Portal</p>
      </div>

      <div class="tactical-card p-6 space-y-4">
        <form onsubmit="handleLoginSubmit(event)" class="space-y-3 text-xs">
          <div>
            <label class="block text-slate-400 mb-1">Official User ID / Email</label>
            <input type="email" id="login-email" value="admin@landslidex.gov.in" required class="w-full bg-[#070a12] border border-slate-700 rounded p-2 text-slate-200">
          </div>
          <div>
            <label class="block text-slate-400 mb-1">Password</label>
            <input type="password" id="login-pass" value="demo123" required class="w-full bg-[#070a12] border border-slate-700 rounded p-2 text-slate-200">
          </div>
          <button type="submit" class="w-full py-2.5 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold rounded text-xs transition-colors">
            Authorize Command Access &rarr;
          </button>
        </form>

        <!-- Quick 1-Click Role Switcher Presets -->
        <div class="pt-3 border-t border-slate-800 space-y-2">
          <span class="text-[10px] font-mono text-slate-400 uppercase block">1-Click Demo Profile Switcher:</span>
          <div class="grid grid-cols-2 gap-2 text-[11px] font-mono">
            <button onclick="switchRole('Super Admin'); window.location.hash='#/dashboard'" class="p-1.5 bg-[#070a12] border border-slate-800 hover:border-cyan-500 rounded text-cyan-400">
              Super Admin
            </button>
            <button onclick="switchRole('Field Officer'); window.location.hash='#/incidents'" class="p-1.5 bg-[#070a12] border border-slate-800 hover:border-purple-500 rounded text-purple-400">
              Field Officer (PWA)
            </button>
            <button onclick="switchRole('District Administrator'); window.location.hash='#/dashboard'" class="p-1.5 bg-[#070a12] border border-slate-800 hover:border-emerald-500 rounded text-emerald-400">
              District Admin
            </button>
            <button onclick="switchRole('Citizen'); window.location.hash='#/incidents'" class="p-1.5 bg-[#070a12] border border-slate-800 hover:border-amber-500 rounded text-amber-400">
              Citizen Reporter
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
  document.getElementById('app-content').innerHTML = html;
}

function handleLoginSubmit(e) {
  e.preventDefault();
  showToast('Authenticated as Col. Rajesh Verma (Super Admin)', 'success');
  window.location.hash = '#/dashboard';
}

// ==========================================
// 10. SYSTEM SETTINGS & ADMIN CONSOLE
// ==========================================
function renderSettings() {
  const cfg = state.adminConfig || { threshold_low: 25, threshold_moderate: 50, threshold_high: 75, threshold_extreme: 100 };
  const html = `
    <div class="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 class="text-xl font-bold text-white flex items-center space-x-2">
          <i data-lucide="settings" class="w-5 h-5 text-slate-400"></i>
          <span>System Settings & Site-Specific Threshold Calibration</span>
        </h1>
        <p class="text-xs text-slate-400 font-mono">Configure Regional Trigger Limits for Soil Saturation, Rainfall & Early Warning Escalation</p>
      </div>

      <div class="tactical-card p-6 space-y-6">
        <h3 class="text-sm font-bold text-white uppercase font-mono">Calibrate Risk Scoring Thresholds</h3>
        
        <div class="space-y-4 text-xs font-mono">
          <div>
            <div class="flex justify-between mb-1">
              <span class="text-emerald-400 font-bold">Low Risk Ceiling:</span>
              <span id="cfg-low-val">${cfg.threshold_low} / 100</span>
            </div>
            <input type="range" min="15" max="35" value="${cfg.threshold_low}" oninput="document.getElementById('cfg-low-val').textContent = this.value + ' / 100'" class="w-full">
          </div>

          <div>
            <div class="flex justify-between mb-1">
              <span class="text-amber-400 font-bold">Moderate Risk Ceiling:</span>
              <span id="cfg-mod-val">${cfg.threshold_moderate} / 100</span>
            </div>
            <input type="range" min="36" max="60" value="${cfg.threshold_moderate}" oninput="document.getElementById('cfg-mod-val').textContent = this.value + ' / 100'" class="w-full">
          </div>

          <div>
            <div class="flex justify-between mb-1">
              <span class="text-orange-400 font-bold">High Risk Ceiling:</span>
              <span id="cfg-high-val">${cfg.threshold_high} / 100</span>
            </div>
            <input type="range" min="61" max="85" value="${cfg.threshold_high}" oninput="document.getElementById('cfg-high-val').textContent = this.value + ' / 100'" class="w-full">
          </div>
        </div>

        <button onclick="saveThresholds()" class="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs rounded transition-colors">
          Save Calibrated Thresholds
        </button>
      </div>

      <!-- Google Maps Platform Configuration Box -->
      <div class="tactical-card p-6 space-y-4">
        <div class="flex justify-between items-center border-b border-slate-800 pb-3">
          <div class="flex items-center space-x-2">
            <i data-lucide="map" class="w-5 h-5 text-cyan-400"></i>
            <h3 class="text-sm font-bold text-white uppercase font-mono">Google Maps Platform API Key</h3>
          </div>
          <span class="text-[10px] font-mono px-2 py-0.5 rounded ${state.googleMapsApiKey ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-slate-800 text-slate-400'}">
            ${state.googleMapsApiKey ? 'API KEY CONFIGURED' : 'LEAFLET FALLBACK ACTIVE'}
          </span>
        </div>

        <p class="text-xs text-slate-300 leading-relaxed">
          Configure a Google Maps JavaScript API key to unlock 3D Terrain DEM contours, Google Hybrid satellite imagery, and live highway traffic layers for the North-Eastern Himalayan corridors.
        </p>

        <div class="space-y-2 text-xs font-mono">
          <label class="block text-slate-400">Google Maps JavaScript API Key:</label>
          <div class="flex space-x-2">
            <input type="text" id="settings-gmaps-key" value="${state.googleMapsApiKey || ''}" placeholder="AIzaSy..." class="flex-1 bg-[#070a12] border border-slate-700 rounded p-2 text-slate-100 font-mono text-xs focus:border-cyan-500 focus:outline-none">
            <button onclick="saveSettingsGoogleKey()" class="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold rounded">
              Save Key
            </button>
          </div>
        </div>

        <div class="flex items-center space-x-4 text-xs font-mono pt-2">
          <span class="text-slate-400">Quick Test Engine:</span>
          <button onclick="switchMapEngine('google_terrain')" class="text-cyan-400 hover:underline">Test Google Terrain &rarr;</button>
          <button onclick="switchMapEngine('google_satellite')" class="text-blue-400 hover:underline">Test Google Satellite &rarr;</button>
          <button onclick="switchMapEngine('leaflet')" class="text-emerald-400 hover:underline">Reset to Leaflet &rarr;</button>
        </div>
      </div>
    </div>
  `;
  document.getElementById('app-content').innerHTML = html;
}

function saveSettingsGoogleKey() {
  const input = document.getElementById('settings-gmaps-key');
  if (input) {
    document.getElementById('gmaps-key-input').value = input.value;
    saveGoogleMapsKey();
  }
}

function saveThresholds() {
  showToast('Thresholds updated and synced to backend risk calculation service.', 'success');
}

function renderProfile() {
  const html = `
    <div class="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 class="text-xl font-bold text-white">Officer Profile & Security Credentials</h1>
        <p class="text-xs text-slate-400 font-mono">Role-Based Access Verification (RBAC)</p>
      </div>

      <div class="tactical-card p-6 space-y-4 font-mono text-xs">
        <div class="flex items-center space-x-4 border-b border-slate-800 pb-4">
          <div class="w-14 h-14 rounded-full bg-cyan-500/20 border-2 border-cyan-400 flex items-center justify-center text-cyan-300 font-black text-lg">
            RV
          </div>
          <div>
            <h3 class="text-base font-bold text-white">Col. Rajesh Verma</h3>
            <span class="text-cyan-400">${state.currentRole}</span>
            <p class="text-slate-400 text-[11px]">National Disaster Management Authority (NDMA HQ)</p>
          </div>
        </div>

        <div class="space-y-2">
          <div class="flex justify-between py-1 border-b border-slate-800/60">
            <span class="text-slate-400">Officer ID:</span>
            <span class="text-white">USR-001-NDMA</span>
          </div>
          <div class="flex justify-between py-1 border-b border-slate-800/60">
            <span class="text-slate-400">Jurisdiction:</span>
            <span class="text-white">North-Eastern Himalayan Command</span>
          </div>
          <div class="flex justify-between py-1 border-b border-slate-800/60">
            <span class="text-slate-400">Security Clearance:</span>
            <span class="text-emerald-400 font-bold">LEVEL-3 (Siren & Early Warning Authorized)</span>
          </div>
        </div>
      </div>
    </div>
  `;
  document.getElementById('app-content').innerHTML = html;
}

function renderAdmin() {
  const html = `
    <div class="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 class="text-xl font-bold text-white flex items-center space-x-2">
          <i data-lucide="sliders" class="w-5 h-5 text-cyan-400"></i>
          <span>Admin Console & System Audit Logs</span>
        </h1>
        <p class="text-xs text-slate-400 font-mono">Full Security Auditing • Model Management • User Access Control</p>
      </div>

      <!-- Audit Logs Table -->
      <div class="tactical-card p-4 space-y-3">
        <h3 class="text-xs font-bold text-white uppercase font-mono">Recent Operations Audit Trail</h3>
        <div class="space-y-2 text-xs font-mono">
          <div class="p-2.5 bg-[#070a12] rounded border border-slate-800 flex justify-between">
            <span class="text-slate-300">[11:55 AM] System Alert Engine triggered Multi-Channel Early Warning for Zone NER-028</span>
            <span class="text-emerald-400">SUCCESS</span>
          </div>
          <div class="p-2.5 bg-[#070a12] rounded border border-slate-800 flex justify-between">
            <span class="text-slate-300">[11:32 AM] Major Arvind Joshi acknowledged ALERT-NER025-02 for Rangpo Gorge</span>
            <span class="text-emerald-400">SUCCESS</span>
          </div>
          <div class="p-2.5 bg-[#070a12] rounded border border-slate-800 flex justify-between">
            <span class="text-slate-300">[10:40 AM] Col. Rajesh Verma updated risk threshold calibration for Western Sikkim</span>
            <span class="text-emerald-400">SUCCESS</span>
          </div>
          <div class="p-2.5 bg-[#070a12] rounded border border-slate-800 flex justify-between">
            <span class="text-slate-300">[09:15 AM] Sub-Inspector Tsering Bhutia verified Citizen Incident at Burtuk Basti</span>
            <span class="text-emerald-400">SUCCESS</span>
          </div>
        </div>
      </div>
    </div>
  `;
  document.getElementById('app-content').innerHTML = html;
}

// ==========================================
// COLOR & STYLE HELPERS
// ==========================================
function getRiskColorClass(level) {
  if (level === 'EXTREME') return 'text-red-400';
  if (level === 'HIGH') return 'text-orange-400';
  if (level === 'MODERATE') return 'text-amber-400';
  return 'text-emerald-400';
}

function getRiskBadgeClass(level) {
  if (level === 'EXTREME') return 'badge-extreme';
  if (level === 'HIGH') return 'badge-high';
  if (level === 'MODERATE') return 'badge-moderate';
  return 'badge-low';
}

function getRiskHexColor(level) {
  if (level === 'EXTREME') return '#ef4444';
  if (level === 'HIGH') return '#f97316';
  if (level === 'MODERATE') return '#f59e0b';
  return '#10b981';
}
