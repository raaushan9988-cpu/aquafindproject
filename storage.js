const REPORTS_STORAGE_KEY = 'aquafind_reports_v1';
const PREFS_STORAGE_KEY = 'aquafind_preferences_v1';
const CUSTOM_DISPENSERS_KEY = 'aquafind_near_me_dispensers_v1';

function isValidReport(item) {
  return (
    item &&
    typeof item === 'object' &&
    typeof item.id === 'string' &&
    typeof item.dispenserId === 'string' &&
    typeof item.dispenserName === 'string' &&
    typeof item.issueType === 'string' &&
    typeof item.description === 'string' &&
    typeof item.createdAt === 'string'
  );
}

export function loadReports() {
  try {
    const raw = window.localStorage.getItem(REPORTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidReport);
  } catch (err) {
    console.warn('AquaFind: Failed to read saved reports from LocalStorage.', err);
    return [];
  }
}

export function saveReport(report) {
  const current = loadReports();
  const updated = [report, ...current].slice(0, 50);
  try {
    window.localStorage.setItem(REPORTS_STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn('AquaFind: Failed to save report to LocalStorage.', err);
  }
  return updated;
}

export function clearReports() {
  try {
    window.localStorage.removeItem(REPORTS_STORAGE_KEY);
  } catch (err) {
    console.warn('AquaFind: Failed to clear reports from LocalStorage.', err);
  }
  return [];
}

export function loadPreferences() {
  const defaults = {
    radius: '100',
    waterStatus: 'all',
    cleanlinessStatus: 'all'
  };

  try {
    const raw = window.localStorage.getItem(PREFS_STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return defaults;

    const validRadii = ['50', '100', 'all'];
    const validWater = ['all', 'available', 'low', 'empty'];
    const validClean = ['all', 'clean', 'average', 'dirty'];

    return {
      radius: validRadii.includes(parsed.radius) ? parsed.radius : defaults.radius,
      waterStatus: validWater.includes(parsed.waterStatus) ? parsed.waterStatus : defaults.waterStatus,
      cleanlinessStatus: validClean.includes(parsed.cleanlinessStatus)
        ? parsed.cleanlinessStatus
        : defaults.cleanlinessStatus
    };
  } catch (err) {
    console.warn('AquaFind: Failed to read preferences from LocalStorage.', err);
    return defaults;
  }
}

export function savePreferences(prefs) {
  try {
    window.localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(prefs));
  } catch (err) {
    console.warn('AquaFind: Failed to save preferences to LocalStorage.', err);
  }
}

export function clearPreferences() {
  try {
    window.localStorage.removeItem(PREFS_STORAGE_KEY);
  } catch (err) {
    console.warn('AquaFind: Failed to clear preferences from LocalStorage.', err);
  }
}

export function loadCustomDispensers() {
  try {
    const raw = window.localStorage.getItem(CUSTOM_DISPENSERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item) =>
        item &&
        typeof item === 'object' &&
        typeof item.id === 'string' &&
        typeof item.name === 'string' &&
        Number.isFinite(Number(item.latitude)) &&
        Number.isFinite(Number(item.longitude))
    );
  } catch (err) {
    console.warn('AquaFind: Failed to read custom dispensers from LocalStorage.', err);
    return [];
  }
}

export function saveCustomDispensers(list) {
  try {
    window.localStorage.setItem(CUSTOM_DISPENSERS_KEY, JSON.stringify(list));
  } catch (err) {
    console.warn('AquaFind: Failed to save custom dispensers to LocalStorage.', err);
  }
  return list;
}

export function clearCustomDispensers() {
  try {
    window.localStorage.removeItem(CUSTOM_DISPENSERS_KEY);
  } catch (err) {
    console.warn('AquaFind: Failed to clear custom dispensers from LocalStorage.', err);
  }
  return [];
}
