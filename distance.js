const EARTH_RADIUS_METRES = 6371000;

function toRadians(degrees) {
  return (degrees * Math.PI) / 180;
}

/**
 * Calculates great-circle distance in metres between two coordinates using Haversine formula.
 */
export function calculateHaversineMetres(lat1, lng1, lat2, lng2) {
  if (
    !Number.isFinite(lat1) ||
    !Number.isFinite(lng1) ||
    !Number.isFinite(lat2) ||
    !Number.isFinite(lng2)
  ) {
    return null;
  }

  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const radLat1 = toRadians(lat1);
  const radLat2 = toRadians(lat2);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(radLat1) * Math.cos(radLat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(EARTH_RADIUS_METRES * c);
}

/**
 * Formats distance cleanly in metres or kilometres.
 */
export function formatDistance(metres) {
  if (!Number.isFinite(metres)) {
    return 'Enable location';
  }
  if (metres < 1000) {
    return `${metres} m away`;
  }
  return `${(metres / 1000).toFixed(2)} km away`;
}

/**
 * A dispenser is suitable only when water is available AND cleanliness is Clean (80–100).
 * Empty or dirty dispensers are never recommended as suitable drinking points.
 */
export function isDispenserSuitable(dispenser) {
  return (
    dispenser &&
    dispenser.waterStatus === 'available' &&
    dispenser.cleanlinessStatus === 'clean' &&
    Number(dispenser.cleanlinessScore) >= 80
  );
}

/**
 * Builds a Google Maps walking directions URL.
 * Includes origin only when real browser GPS coordinates are available.
 */
export function buildGoogleMapsDirectionsUrl(dispenser, userLocation) {
  const destination = `${dispenser.latitude},${dispenser.longitude}`;
  const params = new URLSearchParams({
    api: '1',
    destination,
    travelmode: 'walking'
  });

  if (
    userLocation &&
    userLocation.source === 'gps' &&
    Number.isFinite(userLocation.latitude) &&
    Number.isFinite(userLocation.longitude)
  ) {
    params.set('origin', `${userLocation.latitude},${userLocation.longitude}`);
  }

  return `https://www.google.com/maps/dir/?${params.toString()}`;
}
