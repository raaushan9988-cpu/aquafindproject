/**
 * Filters and sorts dispensers based on search query, radius, water status, and cleanliness status.
 */
export function applyDispenserFilters(dispensers, filters, hasLocation) {
  const query = (filters.search || '').trim().toLowerCase();
  const radiusLimit = filters.radius === 'all' ? Infinity : Number(filters.radius);

  const filtered = dispensers.filter((item) => {
    if (query) {
      const searchable = `${item.name} ${item.building} ${item.locationDescription}`.toLowerCase();
      if (!searchable.includes(query)) {
        return false;
      }
    }

    if (hasLocation && Number.isFinite(radiusLimit) && Number.isFinite(item.distanceMetres)) {
      if (item.distanceMetres > radiusLimit) {
        return false;
      }
    }

    if (filters.waterStatus !== 'all' && item.waterStatus !== filters.waterStatus) {
      return false;
    }

    if (
      filters.cleanlinessStatus !== 'all' &&
      item.cleanlinessStatus !== filters.cleanlinessStatus
    ) {
      return false;
    }

    return true;
  });

  if (hasLocation) {
    filtered.sort((a, b) => (a.distanceMetres ?? Infinity) - (b.distanceMetres ?? Infinity));
  }

  return filtered;
}

/**
 * Computes consistent dashboard statistics aligned with active filters and location state.
 */
export function computeDashboardStats(allDispensers, filteredDispensers, activeRadius, hasLocation) {
  const total = filteredDispensers.length;
  const available = filteredDispensers.filter((d) => d.waterStatus === 'available').length;
  const clean = filteredDispensers.filter((d) => d.cleanlinessStatus === 'clean').length;

  let nearby = null;
  let nearbyLabel = 'Enable location to measure';

  if (hasLocation) {
    const nearbyThreshold = activeRadius === 'all' ? 100 : Number(activeRadius);
    nearby = allDispensers.filter(
      (d) => Number.isFinite(d.distanceMetres) && d.distanceMetres <= nearbyThreshold
    ).length;
    nearbyLabel = `Within ${nearbyThreshold} metres`;
  }

  return {
    total,
    available,
    clean,
    nearby,
    nearbyLabel
  };
}
