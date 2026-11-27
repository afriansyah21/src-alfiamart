export const SUMMARY_TTL_MS = {
  kemarin: 60 * 60 * 1000,
  hari_ini: 10 * 60 * 1000,
};

export function getSummaryCacheTtl(period) {
  return SUMMARY_TTL_MS[period] ?? 0;
}

export function createSummaryCache({ now = Date.now } = {}) {
  const entries = new Map();

  return {
    get(type, period) {
      const key = `summary:${type}:${period}`;
      const entry = entries.get(key);
      if (!entry) return null;
      if (entry.expiresAt <= now()) {
        entries.delete(key);
        return null;
      }
      return entry.value;
    },

    set(type, period, value) {
      const ttl = getSummaryCacheTtl(period);
      if (ttl <= 0) return false;
      const key = `summary:${type}:${period}`;
      entries.set(key, {
        expiresAt: now() + ttl,
        value,
      });
      return true;
    },

    delete(type, period) {
      entries.delete(`summary:${type}:${period}`);
    },

    clear() {
      entries.clear();
    },
  };
}
