import {
  buildGoogleMapsDirectionsUrl,
  calculateHaversineMetres,
  formatDistance,
  isDispenserSuitable
} from './distance.js';
import { applyDispenserFilters, computeDashboardStats } from './filters.js';
import { AquaFindMap } from './map.js';
import { ReportController } from './report.js';
import {
  clearCustomDispensers,
  clearPreferences,
  loadCustomDispensers,
  loadPreferences,
  saveCustomDispensers,
  savePreferences
} from './storage.js';

const DEFAULT_DEMO_CENTER = {
  name: 'LPU Campus Central Quad',
  latitude: 31.2536,
  longitude: 75.7037
};

const state = {
  demoCenter: { ...DEFAULT_DEMO_CENTER },
  baseDispensers: [],
  customDispensers: [],
  rawDispensers: [],
  dispensers: [],
  filteredDispensers: [],
  userLocation: null, // { latitude, longitude, accuracy, source: 'gps' | 'demo' }
  filters: {
    search: '',
    radius: '100',
    waterStatus: 'all',
    cleanlinessStatus: 'all'
  },
  mapController: null,
  reportController: null
};

const dom = {
  mobileMenuBtn: document.getElementById('mobileMenuBtn'),
  navLinks: document.getElementById('navLinks'),
  heroRadiusSelect: document.getElementById('heroRadiusSelect'),
  heroVisualRadiusTag: document.getElementById('heroVisualRadiusTag'),
  heroEnableLocationBtn: document.getElementById('heroEnableLocationBtn'),
  heroDemoLocationBtn: document.getElementById('heroDemoLocationBtn'),
  bannerEnableLocBtn: document.getElementById('bannerEnableLocBtn'),
  bannerDemoLocBtn: document.getElementById('bannerDemoLocBtn'),
  bannerAddNearMeBtn: document.getElementById('bannerAddNearMeBtn'),
  locationStatusTitle: document.getElementById('locationStatusTitle'),
  locationStatusMessage: document.getElementById('locationStatusMessage'),
  locationModeBadge: document.getElementById('locationModeBadge'),

  statTotal: document.getElementById('statTotal'),
  statTotalNote: document.getElementById('statTotalNote'),
  statAvailable: document.getElementById('statAvailable'),
  statClean: document.getElementById('statClean'),
  statNearby: document.getElementById('statNearby'),
  statNearbyNote: document.getElementById('statNearbyNote'),

  searchInput: document.getElementById('searchInput'),
  radiusFilter: document.getElementById('radiusFilter'),
  waterFilter: document.getElementById('waterFilter'),
  cleanlinessFilter: document.getElementById('cleanlinessFilter'),
  resetFiltersBtn: document.getElementById('resetFiltersBtn'),
  resultsSummary: document.getElementById('resultsSummary'),
  suitabilityAlert: document.getElementById('suitabilityAlert'),

  mapLocateMeBtn: document.getElementById('mapLocateMeBtn'),
  mapShowAllBtn: document.getElementById('mapShowAllBtn'),
  mapNearestSuitableBtn: document.getElementById('mapNearestSuitableBtn'),
  mapTileWarning: document.getElementById('mapTileWarning'),

  dispenserGrid: document.getElementById('dispenserGrid'),
  emptyState: document.getElementById('emptyState'),
  emptyStateTitle: document.getElementById('emptyStateTitle'),
  emptyStateDesc: document.getElementById('emptyStateDesc'),
  emptyAddNearMeBtn: document.getElementById('emptyAddNearMeBtn'),
  emptyResetBtn: document.getElementById('emptyResetBtn'),
  toastContainer: document.getElementById('toastContainer')
};

function showToast(message, type = 'info') {
  if (!dom.toastContainer) return;
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  dom.toastContainer.appendChild(toast);

  window.setTimeout(() => {
    toast.remove();
  }, 4200);
}

function normalizeDispenser(item, index) {
  const score = Number(item?.cleanlinessScore);
  const safeScore = Number.isFinite(score) ? Math.min(100, Math.max(0, score)) : 50;
  let cleanStatus = item?.cleanlinessStatus;
  if (!['clean', 'average', 'dirty'].includes(cleanStatus)) {
    cleanStatus = safeScore >= 80 ? 'clean' : safeScore >= 50 ? 'average' : 'dirty';
  }

  const waterStatus = ['available', 'low', 'empty'].includes(item?.waterStatus)
    ? item.waterStatus
    : 'empty';

  return {
    id: String(item?.id || `AQF-${index + 1}`),
    name: String(item?.name || 'Unnamed Water Point'),
    building: String(item?.building || 'Campus Facility'),
    latitude: Number(item?.latitude) || DEFAULT_DEMO_CENTER.latitude,
    longitude: Number(item?.longitude) || DEFAULT_DEMO_CENTER.longitude,
    waterStatus,
    cleanlinessStatus: cleanStatus,
    cleanlinessScore: safeScore,
    lastUpdated: item?.lastUpdated || new Date().toISOString(),
    locationDescription: String(item?.locationDescription || 'Location details unavailable.'),
    waterType: String(item?.waterType || 'Drinking Water'),
    cleaningRecommendation: String(
      item?.cleaningRecommendation || 'Follow standard campus inspection cycle.'
    ),
    distanceMetres: null
  };
}

function formatUpdatedTime(isoString) {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return 'Recently';
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function getWaterMeta(status) {
  if (status === 'available') return { label: 'Available', className: 'water-available' };
  if (status === 'low') return { label: 'Low Water', className: 'water-low' };
  return { label: 'Empty', className: 'water-empty' };
}

function getCleanlinessMeta(status) {
  if (status === 'clean') return { label: 'Clean', badgeClass: 'clean-clean', meterClass: 'meter-clean' };
  if (status === 'average') return { label: 'Average', badgeClass: 'clean-average', meterClass: 'meter-average' };
  return { label: 'Dirty', badgeClass: 'clean-dirty', meterClass: 'meter-dirty' };
}

function recalculateDistances() {
  state.dispensers = state.rawDispensers.map((d) => {
    const copy = { ...d };
    if (state.userLocation) {
      copy.distanceMetres = calculateHaversineMetres(
        state.userLocation.latitude,
        state.userLocation.longitude,
        copy.latitude,
        copy.longitude
      );
    } else {
      copy.distanceMetres = null;
    }
    return copy;
  });
}

function syncRadiusUI(radiusValue) {
  state.filters.radius = radiusValue;
  if (dom.heroRadiusSelect) dom.heroRadiusSelect.value = radiusValue;
  if (dom.radiusFilter) dom.radiusFilter.value = radiusValue;

  if (dom.heroVisualRadiusTag) {
    dom.heroVisualRadiusTag.textContent =
      radiusValue === 'all' ? 'All Campus Zone' : `${radiusValue}m Zone`;
  }
}

function updateLocationBanner(errorMessage = null) {
  if (!dom.locationStatusTitle || !dom.locationStatusMessage || !dom.locationModeBadge) return;

  if (errorMessage) {
    dom.locationModeBadge.className = 'location-mode-badge badge-error';
    dom.locationModeBadge.textContent = 'GPS Unavailable';
    dom.locationStatusTitle.textContent = errorMessage;
    dom.locationStatusMessage.textContent =
      'Switched to Demo Campus Location or click Enable My Location again after allowing access.';
    return;
  }

  if (!state.userLocation) {
    dom.locationModeBadge.className = 'location-mode-badge badge-neutral';
    dom.locationModeBadge.textContent = 'Location Off';
    dom.locationStatusTitle.textContent = 'Location not enabled yet';
    dom.locationStatusMessage.textContent =
      'Click Enable My Location for live GPS distance or Use Demo Location to explore the simulated college campus.';
    return;
  }

  if (state.userLocation.source === 'gps') {
    dom.locationModeBadge.className = 'location-mode-badge badge-live';
    dom.locationModeBadge.textContent = 'Live GPS Active';
    dom.locationStatusTitle.textContent = 'Live browser location active';
    const accText = Number.isFinite(state.userLocation.accuracy)
      ? ` (±${Math.round(state.userLocation.accuracy)} m accuracy)`
      : '';
    dom.locationStatusMessage.textContent = `Coordinates: ${state.userLocation.latitude.toFixed(
      5
    )}, ${state.userLocation.longitude.toFixed(5)}${accText}. Distances calculated via Haversine formula.`;
  } else {
    dom.locationModeBadge.className = 'location-mode-badge badge-demo';
    dom.locationModeBadge.textContent = 'Demo Location (Simulated)';
    dom.locationStatusTitle.textContent = `Using ${state.demoCenter.name}`;
    dom.locationStatusMessage.textContent = `Simulated coordinates (${state.demoCenter.latitude.toFixed(
      4
    )}, ${state.demoCenter.longitude.toFixed(4)}) active for 50m / 100m radius demonstration.`;
  }
}

function updateDashboardAndSummary() {
  const hasLocation = Boolean(state.userLocation);
  const stats = computeDashboardStats(
    state.dispensers,
    state.filteredDispensers,
    state.filters.radius,
    hasLocation
  );

  if (dom.statTotal) dom.statTotal.textContent = String(stats.total);
  if (dom.statTotalNote) {
    dom.statTotalNote.textContent = `Out of ${state.dispensers.length} campus stations`;
  }
  if (dom.statAvailable) dom.statAvailable.textContent = String(stats.available);
  if (dom.statClean) dom.statClean.textContent = String(stats.clean);
  if (dom.statNearby) {
    dom.statNearby.textContent = stats.nearby === null ? '--' : String(stats.nearby);
  }
  if (dom.statNearbyNote) dom.statNearbyNote.textContent = stats.nearbyLabel;

  if (dom.resultsSummary) {
    const count = state.filteredDispensers.length;
    const noun = count === 1 ? 'water dispenser' : 'water dispensers';

    if (hasLocation && state.filters.radius !== 'all') {
      const modeSuffix =
        state.userLocation.source === 'demo' ? ' (Demo Campus Location)' : ' (Your Location)';
      dom.resultsSummary.textContent = `Showing ${count} ${noun} within ${state.filters.radius} metres${modeSuffix}.`;
    } else if (hasLocation) {
      dom.resultsSummary.textContent = `Showing ${count} ${noun} sorted nearest to you.`;
    } else {
      dom.resultsSummary.textContent = `Showing ${count} simulated ${noun}. Enable location or Demo Location for 50m/100m distance filtering.`;
    }
  }

  if (dom.suitabilityAlert) {
    const suitableList = state.filteredDispensers.filter(isDispenserSuitable);
    if (suitableList.length === 0) {
      dom.suitabilityAlert.className = 'suitability-banner';
      dom.suitabilityAlert.textContent =
        'No suitable water dispenser found within your selected radius.';
    } else {
      const best = suitableList[0];
      dom.suitabilityAlert.className = 'suitability-banner is-positive';
      const distText = hasLocation ? ` (${formatDistance(best.distanceMetres)})` : '';
      dom.suitabilityAlert.textContent = `Nearest suitable drinking point: ${best.name}${distText} — Available water & Clean (${best.cleanlinessScore}/100).`;
    }
  }
}

function renderDispenserCards() {
  if (!dom.dispenserGrid || !dom.emptyState) return;
  dom.dispenserGrid.innerHTML = '';

  if (state.filteredDispensers.length === 0) {
    dom.emptyState.classList.remove('hidden');
    if (dom.emptyStateTitle && dom.emptyStateDesc) {
      const isRadiusEmpty = Boolean(state.userLocation) && state.filters.radius !== 'all';
      dom.emptyStateTitle.textContent = isRadiusEmpty
        ? `No water dispensers found within ${state.filters.radius} metres`
        : 'No dispensers match your active filters';
      dom.emptyStateDesc.textContent =
        state.userLocation?.source === 'gps'
          ? 'You can add simulated dispensers near your live GPS location, expand the radius, or reset filters.'
          : 'Try expanding the radius to 100 metres, switching to All nearby dispensers, or resetting filters.';
    }
    if (dom.emptyAddNearMeBtn) {
      const showNearMeBtn = state.userLocation?.source === 'gps';
      dom.emptyAddNearMeBtn.classList.toggle('hidden', !showNearMeBtn);
    }
    return;
  }

  dom.emptyState.classList.add('hidden');
  dom.emptyAddNearMeBtn?.classList.add('hidden');

  state.filteredDispensers.forEach((dispenser) => {
    const suitable = isDispenserSuitable(dispenser);
    const notRecommended = dispenser.waterStatus === 'empty' || dispenser.cleanlinessStatus === 'dirty';
    const waterMeta = getWaterMeta(dispenser.waterStatus);
    const cleanMeta = getCleanlinessMeta(dispenser.cleanlinessStatus);

    const card = document.createElement('article');
    card.className = 'dispenser-card';
    if (suitable) card.classList.add('is-suitable');
    if (notRecommended) card.classList.add('is-not-recommended');

    if (suitable) {
      const tag = document.createElement('div');
      tag.className = 'suitable-tag';
      tag.textContent = 'Recommended • Suitable Drinking Point';
      card.appendChild(tag);
    } else if (notRecommended) {
      const tag = document.createElement('div');
      tag.className = 'caution-tag';
      tag.textContent =
        dispenser.waterStatus === 'empty'
          ? 'Not Recommended • Water Empty'
          : 'Not Recommended • Needs Cleaning';
      card.appendChild(tag);
    }

    const topRow = document.createElement('div');
    topRow.className = 'card-top-row';

    const titleWrap = document.createElement('div');
    const titleEl = document.createElement('h3');
    titleEl.className = 'dispenser-name';
    titleEl.textContent = dispenser.name;

    const buildingEl = document.createElement('div');
    buildingEl.className = 'dispenser-building';
    buildingEl.textContent = `${dispenser.building} • ${dispenser.waterType}`;

    titleWrap.appendChild(titleEl);
    titleWrap.appendChild(buildingEl);

    const distPill = document.createElement('span');
    distPill.className = 'distance-pill';
    distPill.textContent = formatDistance(dispenser.distanceMetres);

    topRow.appendChild(titleWrap);
    topRow.appendChild(distPill);
    card.appendChild(topRow);

    const descEl = document.createElement('p');
    descEl.className = 'dispenser-desc';
    descEl.textContent = dispenser.locationDescription;
    card.appendChild(descEl);

    const badgesRow = document.createElement('div');
    badgesRow.className = 'status-badges-row';

    const waterBadge = document.createElement('span');
    waterBadge.className = `status-badge ${waterMeta.className}`;
    waterBadge.textContent = `Water: ${waterMeta.label}`;

    const cleanBadge = document.createElement('span');
    cleanBadge.className = `status-badge ${cleanMeta.badgeClass}`;
    cleanBadge.textContent = `Cleanliness: ${cleanMeta.label}`;

    badgesRow.appendChild(waterBadge);
    badgesRow.appendChild(cleanBadge);
    card.appendChild(badgesRow);

    const meterBox = document.createElement('div');
    meterBox.className = 'cleanliness-meter-box';

    const meterHeader = document.createElement('div');
    meterHeader.className = 'meter-header';

    const scoreLabel = document.createElement('span');
    scoreLabel.textContent = 'Cleanliness Score';
    const scoreValue = document.createElement('span');
    scoreValue.textContent = `${dispenser.cleanlinessScore} / 100`;
    meterHeader.appendChild(scoreLabel);
    meterHeader.appendChild(scoreValue);

    const meterTrack = document.createElement('div');
    meterTrack.className = 'meter-track';
    const meterFill = document.createElement('div');
    meterFill.className = `meter-fill ${cleanMeta.meterClass}`;
    meterFill.style.width = `${dispenser.cleanlinessScore}%`;
    meterTrack.appendChild(meterFill);

    const recEl = document.createElement('p');
    recEl.className = 'cleaning-rec';
    recEl.textContent = dispenser.cleaningRecommendation;

    meterBox.appendChild(meterHeader);
    meterBox.appendChild(meterTrack);
    meterBox.appendChild(recEl);
    card.appendChild(meterBox);

    const metaFooter = document.createElement('div');
    metaFooter.className = 'card-meta-footer';

    const updatedEl = document.createElement('span');
    updatedEl.textContent = `Inspected: ${formatUpdatedTime(dispenser.lastUpdated)}`;

    const reportLink = document.createElement('button');
    reportLink.type = 'button';
    reportLink.className = 'btn btn-ghost btn-sm';
    reportLink.textContent = 'Report Issue';
    reportLink.addEventListener('click', () => {
      state.reportController?.preselectDispenser(dispenser.id);
    });

    metaFooter.appendChild(updatedEl);
    metaFooter.appendChild(reportLink);
    card.appendChild(metaFooter);

    const actions = document.createElement('div');
    actions.className = 'card-actions';

    const viewMapBtn = document.createElement('button');
    viewMapBtn.type = 'button';
    viewMapBtn.className = 'btn btn-outline btn-sm';
    viewMapBtn.textContent = 'View on Map';
    viewMapBtn.addEventListener('click', () => {
      document.getElementById('live-map')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      window.setTimeout(() => {
        state.mapController?.focusDispenser(dispenser.id);
      }, 280);
    });

    const directionsLink = document.createElement('a');
    directionsLink.className = 'btn btn-primary btn-sm';
    directionsLink.href = buildGoogleMapsDirectionsUrl(dispenser, state.userLocation);
    directionsLink.target = '_blank';
    directionsLink.rel = 'noopener noreferrer';
    directionsLink.textContent = 'Get Directions';

    actions.appendChild(viewMapBtn);
    actions.appendChild(directionsLink);
    card.appendChild(actions);

    dom.dispenserGrid.appendChild(card);
  });
}

function refreshView({ fitMap = false } = {}) {
  const hasLocation = Boolean(state.userLocation);
  state.filteredDispensers = applyDispenserFilters(state.dispensers, state.filters, hasLocation);

  savePreferences({
    radius: state.filters.radius,
    waterStatus: state.filters.waterStatus,
    cleanlinessStatus: state.filters.cleanlinessStatus
  });

  updateDashboardAndSummary();
  renderDispenserCards();

  if (state.mapController) {
    state.mapController.renderUserLocation(state.userLocation, state.filters.radius);
    state.mapController.renderDispensers(state.filteredDispensers, state.userLocation);
    if (fitMap) {
      state.mapController.fitDispensers(
        state.filteredDispensers.length > 0 ? state.filteredDispensers : state.dispensers,
        state.userLocation
      );
    }
  }
}

function syncRawDispensers() {
  state.rawDispensers = [...state.baseDispensers, ...state.customDispensers];
  recalculateDistances();
  state.reportController?.updateDispensers(state.dispensers);
}

function generateDispensersNearLocation(lat, lng) {
  const latRad = (lat * Math.PI) / 180;
  const metersToLat = (m) => m / 111132;
  const metersToLng = (m) => m / (111320 * Math.max(0.2, Math.cos(latRad)));
  const nowIso = new Date().toISOString();

  const templates = [
    {
      id: 'LOC-001',
      name: 'Nearby Point – Main Walkway',
      dNorth: 24,
      dEast: 14,
      waterStatus: 'available',
      cleanlinessStatus: 'clean',
      cleanlinessScore: 93,
      locationDescription: 'Simulated water point ~28 m northeast of your live location.',
      waterType: 'Chilled & Normal',
      cleaningRecommendation: 'Routine hygiene check on schedule. Basin and nozzle area clean.'
    },
    {
      id: 'LOC-002',
      name: 'Nearby Point – East Corner',
      dNorth: -31,
      dEast: 24,
      waterStatus: 'available',
      cleanlinessStatus: 'average',
      cleanlinessScore: 71,
      locationDescription: 'Simulated water point ~39 m southeast of your live location.',
      waterType: 'Normal & Cool',
      cleaningRecommendation: 'Scheduled tray wiping recommended within 4 hours.'
    },
    {
      id: 'LOC-003',
      name: 'Nearby Point – West Lobby',
      dNorth: 18,
      dEast: -38,
      waterStatus: 'empty',
      cleanlinessStatus: 'dirty',
      cleanlinessScore: 36,
      locationDescription: 'Simulated water point ~42 m northwest of your live location.',
      waterType: 'Normal',
      cleaningRecommendation: 'Urgent sanitization and tank refill inspection required.'
    },
    {
      id: 'LOC-004',
      name: 'Nearby Point – Courtyard',
      dNorth: 58,
      dEast: 36,
      waterStatus: 'available',
      cleanlinessStatus: 'clean',
      cleanlinessScore: 88,
      locationDescription: 'Simulated water point ~68 m northeast of your live location.',
      waterType: 'Chilled & Normal',
      cleaningRecommendation: 'Clean exterior and splash tray; routine check on schedule.'
    },
    {
      id: 'LOC-005',
      name: 'Nearby Point – Gate Side',
      dNorth: -65,
      dEast: -58,
      waterStatus: 'low',
      cleanlinessStatus: 'clean',
      cleanlinessScore: 84,
      locationDescription: 'Simulated water point ~87 m southwest of your live location.',
      waterType: 'Chilled Only',
      cleaningRecommendation: 'Clean tap assembly; monitor water pressure.'
    },
    {
      id: 'LOC-006',
      name: 'Nearby Point – Annex Block',
      dNorth: 95,
      dEast: -72,
      waterStatus: 'available',
      cleanlinessStatus: 'clean',
      cleanlinessScore: 90,
      locationDescription: 'Simulated water point ~119 m northwest of your live location.',
      waterType: 'Chilled & Normal',
      cleaningRecommendation: 'Well maintained; nozzle guard and basin are clean.'
    }
  ];

  return templates.map((tpl, idx) =>
    normalizeDispenser(
      {
        id: tpl.id,
        name: tpl.name,
        building: 'Simulated Near Your Location',
        latitude: Number((lat + metersToLat(tpl.dNorth)).toFixed(6)),
        longitude: Number((lng + metersToLng(tpl.dEast)).toFixed(6)),
        waterStatus: tpl.waterStatus,
        cleanlinessStatus: tpl.cleanlinessStatus,
        cleanlinessScore: tpl.cleanlinessScore,
        lastUpdated: nowIso,
        locationDescription: tpl.locationDescription,
        waterType: tpl.waterType,
        cleaningRecommendation: tpl.cleaningRecommendation
      },
      idx
    )
  );
}

function addDispensersNearUserLocation() {
  if (!state.userLocation) {
    requestLiveLocation({ autoAddNearMe: true });
    return;
  }

  const generated = generateDispensersNearLocation(
    state.userLocation.latitude,
    state.userLocation.longitude
  );
  state.customDispensers = saveCustomDispensers(generated);
  syncRawDispensers();
  refreshView({ fitMap: true });
  showToast(
    'Added 6 simulated dispensers (28 m – 119 m) around your current location.',
    'success'
  );
}

function activateDemoLocation(reasonToast = null) {
  state.userLocation = {
    latitude: state.demoCenter.latitude,
    longitude: state.demoCenter.longitude,
    accuracy: null,
    source: 'demo'
  };
  recalculateDistances();
  updateLocationBanner();
  refreshView({ fitMap: true });

  if (reasonToast) {
    showToast(reasonToast, 'warning');
  } else {
    showToast(`Demo Campus Location activated (${state.demoCenter.name}).`, 'info');
  }
}

function requestLiveLocation({ autoAddNearMe = false } = {}) {
  if (!('geolocation' in navigator)) {
    activateDemoLocation(
      'Geolocation is not supported by this browser. Activated Demo Campus Location instead.'
    );
    return;
  }

  if (dom.locationStatusTitle) {
    dom.locationStatusTitle.textContent = 'Detecting your location...';
  }
  showToast('Requesting browser location permission...', 'info');

  navigator.geolocation.getCurrentPosition(
    (position) => {
      state.userLocation = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        source: 'gps'
      };
      if (autoAddNearMe) {
        addDispensersNearUserLocation();
        updateLocationBanner();
        return;
      }

      recalculateDistances();
      updateLocationBanner();
      refreshView({ fitMap: true });

      const nearbyCount = state.dispensers.filter(
        (d) => Number.isFinite(d.distanceMetres) && d.distanceMetres <= 100
      ).length;
      if (nearbyCount === 0) {
        showToast(
          'Live GPS active. No LPU dispensers within 100m — click "Add Dispensers Near Me" to place simulated stations nearby.',
          'warning'
        );
      } else {
        showToast('Live GPS location detected and distances updated.', 'success');
      }
    },
    (error) => {
      let msg = 'Unable to retrieve your location.';
      if (error.code === error.PERMISSION_DENIED) {
        msg = 'Location permission was denied.';
      } else if (error.code === error.POSITION_UNAVAILABLE) {
        msg = 'Location information is currently unavailable.';
      } else if (error.code === error.TIMEOUT) {
        msg = 'Location request timed out.';
      }

      activateDemoLocation(`${msg} Switched to Demo Campus Location so you can test all features.`);
      updateLocationBanner(msg);
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 30000
    }
  );
}

function resetAllFilters() {
  state.filters = {
    search: '',
    radius: 'all',
    waterStatus: 'all',
    cleanlinessStatus: 'all'
  };

  if (dom.searchInput) dom.searchInput.value = '';
  if (dom.waterFilter) dom.waterFilter.value = 'all';
  if (dom.cleanlinessFilter) dom.cleanlinessFilter.value = 'all';
  syncRadiusUI('all');
  refreshView({ fitMap: true });
  showToast('All filters reset.', 'info');
}

function locateNearestSuitable() {
  if (!state.userLocation) {
    activateDemoLocation(
      'Demo Campus Location activated to calculate nearest suitable dispenser.'
    );
  }

  const suitable = state.filteredDispensers.filter(isDispenserSuitable);
  if (suitable.length === 0) {
    showToast('No suitable water dispenser found within your selected radius.', 'warning');
    return;
  }

  const nearest = suitable[0];
  document.getElementById('live-map')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  window.setTimeout(() => {
    state.mapController?.focusDispenser(nearest.id);
  }, 250);
  showToast(
    `Nearest suitable dispenser: ${nearest.name} (${formatDistance(nearest.distanceMetres)}).`,
    'success'
  );
}

function setupEventListeners() {
  // Mobile Navigation
  dom.mobileMenuBtn?.addEventListener('click', () => {
    const isOpen = dom.navLinks?.classList.toggle('is-open');
    dom.mobileMenuBtn.setAttribute('aria-expanded', String(Boolean(isOpen)));
  });

  dom.navLinks?.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      dom.navLinks.classList.remove('is-open');
      dom.mobileMenuBtn?.setAttribute('aria-expanded', 'false');
    });
  });

  // Location Buttons
  [dom.heroEnableLocationBtn, dom.bannerEnableLocBtn, dom.mapLocateMeBtn].forEach((btn) => {
    btn?.addEventListener('click', () => requestLiveLocation());
  });

  [dom.heroDemoLocationBtn, dom.bannerDemoLocBtn].forEach((btn) => {
    btn?.addEventListener('click', () => activateDemoLocation());
  });

  [dom.bannerAddNearMeBtn, dom.emptyAddNearMeBtn].forEach((btn) => {
    btn?.addEventListener('click', addDispensersNearUserLocation);
  });

  // Radius Controls Sync
  const handleRadiusChange = (val) => {
    syncRadiusUI(val);
    if (!state.userLocation && val !== 'all') {
      activateDemoLocation(
        `Demo Campus Location activated to filter within ${val} metres.`
      );
      return;
    }
    refreshView({ fitMap: true });
  };

  dom.heroRadiusSelect?.addEventListener('change', (e) => handleRadiusChange(e.target.value));
  dom.radiusFilter?.addEventListener('change', (e) => handleRadiusChange(e.target.value));

  // Search & Status Filters
  dom.searchInput?.addEventListener('input', (e) => {
    state.filters.search = e.target.value;
    refreshView();
  });

  dom.waterFilter?.addEventListener('change', (e) => {
    state.filters.waterStatus = e.target.value;
    refreshView();
  });

  dom.cleanlinessFilter?.addEventListener('change', (e) => {
    state.filters.cleanlinessStatus = e.target.value;
    refreshView();
  });

  dom.resetFiltersBtn?.addEventListener('click', resetAllFilters);
  dom.emptyResetBtn?.addEventListener('click', resetAllFilters);

  // Map Toolbar
  dom.mapShowAllBtn?.addEventListener('click', () => {
    syncRadiusUI('all');
    if (dom.waterFilter) dom.waterFilter.value = 'all';
    if (dom.cleanlinessFilter) dom.cleanlinessFilter.value = 'all';
    if (dom.searchInput) dom.searchInput.value = '';
    state.filters = {
      search: '',
      radius: 'all',
      waterStatus: 'all',
      cleanlinessStatus: 'all'
    };
    refreshView({ fitMap: true });
    showToast('Showing all campus water dispensers on the map.', 'info');
  });

  dom.mapNearestSuitableBtn?.addEventListener('click', locateNearestSuitable);
}

async function loadDataset() {
  try {
    const response = await fetch('./data/dispensers.json');
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();

    if (data?.demoCampusCenter) {
      state.demoCenter = {
        name: data.demoCampusCenter.name || DEFAULT_DEMO_CENTER.name,
        latitude: Number(data.demoCampusCenter.latitude) || DEFAULT_DEMO_CENTER.latitude,
        longitude: Number(data.demoCampusCenter.longitude) || DEFAULT_DEMO_CENTER.longitude
      };
    }

    const list = Array.isArray(data?.dispensers) ? data.dispensers : [];
    state.baseDispensers = list.map(normalizeDispenser);
    state.customDispensers = loadCustomDispensers().map(normalizeDispenser);
    syncRawDispensers();
  } catch (err) {
    console.error('AquaFind: Error loading dispenser dataset:', err);
    showToast('Unable to load simulated dispenser data file.', 'error');
    state.baseDispensers = [];
    state.customDispensers = [];
    state.rawDispensers = [];
    state.dispensers = [];
  }
}

async function initApp() {
  const savedPrefs = loadPreferences();
  state.filters.radius = savedPrefs.radius;
  state.filters.waterStatus = savedPrefs.waterStatus;
  state.filters.cleanlinessStatus = savedPrefs.cleanlinessStatus;

  syncRadiusUI(state.filters.radius);
  if (dom.waterFilter) dom.waterFilter.value = state.filters.waterStatus;
  if (dom.cleanlinessFilter) dom.cleanlinessFilter.value = state.filters.cleanlinessStatus;

  await loadDataset();

  // Initialize Leaflet Map
  try {
    state.mapController = new AquaFindMap('map', {
      onReportClick: (dispenserId) => state.reportController?.preselectDispenser(dispenserId),
      onTileError: () => dom.mapTileWarning?.classList.remove('hidden')
    });
    state.mapController.init(state.demoCenter.latitude, state.demoCenter.longitude, 17);
  } catch (err) {
    console.error('AquaFind: Map initialization failed:', err);
    dom.mapTileWarning?.classList.remove('hidden');
  }

  // Initialize Report Controller
  state.reportController = new ReportController({
    dispensers: state.dispensers,
    onToast: showToast,
    onResetDemoData: () => {
      clearPreferences();
      state.customDispensers = clearCustomDispensers();
      state.userLocation = null;
      syncRawDispensers();
      updateLocationBanner();
      resetAllFilters();
    }
  });
  state.reportController.init();

  setupEventListeners();
  updateLocationBanner();
  refreshView({ fitMap: true });
}

document.addEventListener('DOMContentLoaded', initApp);
