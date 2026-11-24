import { buildGoogleMapsDirectionsUrl, formatDistance, isDispenserSuitable } from './distance.js';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getPinClass(waterStatus) {
  if (waterStatus === 'available') return 'pin-green';
  if (waterStatus === 'low') return 'pin-yellow';
  return 'pin-red';
}

function getWaterLabel(waterStatus) {
  if (waterStatus === 'available') return 'Available';
  if (waterStatus === 'low') return 'Low Water';
  return 'Empty';
}

function getCleanlinessLabel(status) {
  if (status === 'clean') return 'Clean';
  if (status === 'average') return 'Average';
  return 'Dirty';
}

export class AquaFindMap {
  constructor(containerId, { onReportClick, onTileError } = {}) {
    this.containerId = containerId;
    this.onReportClick = onReportClick || (() => {});
    this.onTileError = onTileError || (() => {});
    this.map = null;
    this.markersLayer = null;
    this.userLayer = null;
    this.markerById = new Map();
    this.tileErrorNotified = false;
  }

  init(centerLat, centerLng, zoom = 17) {
    if (typeof window.L === 'undefined') {
      throw new Error('Leaflet library failed to load.');
    }

    this.map = window.L.map(this.containerId, {
      zoomControl: true
    }).setView([centerLat, centerLng], zoom);

    const tileLayer = window.L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    });

    tileLayer.on('tileerror', () => {
      if (!this.tileErrorNotified) {
        this.tileErrorNotified = true;
        this.onTileError();
      }
    });

    tileLayer.addTo(this.map);

    this.userLayer = window.L.layerGroup().addTo(this.map);
    this.markersLayer = window.L.layerGroup().addTo(this.map);

    this.map.on('popupopen', (event) => {
      const popupEl = event.popup.getElement();
      if (!popupEl) return;
      const reportBtn = popupEl.querySelector('[data-report-id]');
      if (reportBtn) {
        reportBtn.addEventListener('click', () => {
          const id = reportBtn.getAttribute('data-report-id');
          this.onReportClick(id);
        });
      }
    });
  }

  renderUserLocation(userLocation, radiusSetting) {
    if (!this.map || !this.userLayer) return;
    this.userLayer.clearLayers();

    if (!userLocation) return;

    const userIcon = window.L.divIcon({
      className: 'custom-leaflet-pin',
      html: '<div class="user-leaflet-pin" aria-label="User location"></div>',
      iconSize: [22, 22],
      iconAnchor: [11, 11]
    });

    const sourceText =
      userLocation.source === 'gps'
        ? 'Your Live GPS Location'
        : 'Demo Campus Location (Simulated)';

    const marker = window.L.marker([userLocation.latitude, userLocation.longitude], {
      icon: userIcon,
      zIndexOffset: 500
    });
    marker.bindPopup(`<strong>${escapeHtml(sourceText)}</strong>`);
    marker.addTo(this.userLayer);

    const radiusMetres = radiusSetting === 'all' ? 100 : Number(radiusSetting);
    if (Number.isFinite(radiusMetres)) {
      window.L.circle([userLocation.latitude, userLocation.longitude], {
        radius: radiusMetres,
        color: '#0284c7',
        weight: 2,
        dashArray: '6 6',
        fillColor: '#38bdf8',
        fillOpacity: 0.1
      }).addTo(this.userLayer);
    }
  }

  renderDispensers(dispensers, userLocation) {
    if (!this.map || !this.markersLayer) return;
    this.markersLayer.clearLayers();
    this.markerById.clear();

    dispensers.forEach((dispenser) => {
      const pinClass = getPinClass(dispenser.waterStatus);
      const icon = window.L.divIcon({
        className: 'custom-leaflet-pin',
        html: `<div class="pin-bubble ${pinClass}"><div class="pin-bubble-inner"></div></div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -30]
      });

      const marker = window.L.marker([dispenser.latitude, dispenser.longitude], { icon });
      const directionsUrl = buildGoogleMapsDirectionsUrl(dispenser, userLocation);
      const suitableBadge = isDispenserSuitable(dispenser)
        ? '<span class="status-badge water-available">Suitable Point</span>'
        : '';

      const popupHtml = `
        <div class="popup-card">
          <div class="popup-title">${escapeHtml(dispenser.name)}</div>
          <div class="popup-meta">${escapeHtml(dispenser.building)} • ${escapeHtml(formatDistance(dispenser.distanceMetres))}</div>
          <div class="popup-badges">
            <span class="status-badge water-${escapeHtml(dispenser.waterStatus)}">${escapeHtml(getWaterLabel(dispenser.waterStatus))}</span>
            <span class="status-badge clean-${escapeHtml(dispenser.cleanlinessStatus)}">${escapeHtml(getCleanlinessLabel(dispenser.cleanlinessStatus))} (${escapeHtml(dispenser.cleanlinessScore)}/100)</span>
            ${suitableBadge}
          </div>
          <div class="popup-meta">${escapeHtml(dispenser.locationDescription)}</div>
          <div class="popup-actions">
            <a href="${escapeHtml(directionsUrl)}" target="_blank" rel="noopener noreferrer" class="popup-btn popup-btn-primary">Directions</a>
            <button type="button" class="popup-btn" data-report-id="${escapeHtml(dispenser.id)}">Report Issue</button>
          </div>
        </div>
      `;

      marker.bindPopup(popupHtml);
      marker.addTo(this.markersLayer);
      this.markerById.set(dispenser.id, marker);
    });
  }

  focusDispenser(dispenserId) {
    const marker = this.markerById.get(dispenserId);
    if (!marker || !this.map) return;
    const latLng = marker.getLatLng();
    this.map.flyTo(latLng, 18, { duration: 0.55 });
    marker.openPopup();
  }

  focusUserLocation(userLocation) {
    if (!this.map || !userLocation) return;
    this.map.flyTo([userLocation.latitude, userLocation.longitude], 17, { duration: 0.55 });
  }

  fitDispensers(dispensers, userLocation = null) {
    if (!this.map) return;
    const coords = dispensers.map((d) => [d.latitude, d.longitude]);
    if (userLocation) {
      coords.push([userLocation.latitude, userLocation.longitude]);
    }
    if (coords.length === 0) return;

    const bounds = window.L.latLngBounds(coords);
    this.map.fitBounds(bounds, { padding: [45, 45], maxZoom: 18 });
  }
}
