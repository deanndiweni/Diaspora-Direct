import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

// Prices now live in the Supabase table `service_prices`, so they can be
// changed from the Supabase dashboard without a new app build or store
// review. The values below are only a fallback for the very first launch
// with no connection; after that the last prices fetched are cached on the
// device so the app never shows stale hardcoded numbers once it has synced.
//
// Row ids: one per service in SERVICES (property, family, errand, urgent,
// documents, funeral) plus the extras "tip" and "extra_task".
export const DEFAULT_SERVICE_FEES = {
  property: 25, family: 25, errand: 12, urgent: 37, documents: 20, funeral: 52,
};

export const DEFAULT_SERVICE_FEE_NOTES = {
  property: "30 min included, then £2 per extra 5 min",
  family: "30 min included, then £2 per extra 5 min",
  urgent: "30 min included, then £2 per extra 5 min",
  funeral: "Billed per hour",
};

export const DEFAULT_EXTRAS = { tip: 5, extra_task: 8 };

const EXTRA_IDS = Object.keys(DEFAULT_EXTRAS);
const CACHE_KEY = "dd_service_prices_v1";

export const formatMoney = (n) => "£" + Number(n || 0).toFixed(2);

function defaults() {
  return {
    fees: { ...DEFAULT_SERVICE_FEES },
    notes: { ...DEFAULT_SERVICE_FEE_NOTES },
    extras: { ...DEFAULT_EXTRAS },
  };
}

function fromRows(rows) {
  const p = defaults();
  for (const row of rows || []) {
    if (!row || !row.id || row.active === false) continue;
    const amount = Number(row.amount);
    if (!Number.isFinite(amount)) continue;
    if (EXTRA_IDS.includes(row.id)) {
      p.extras[row.id] = amount;
    } else {
      p.fees[row.id] = amount;
      if (row.note) p.notes[row.id] = row.note;
      else delete p.notes[row.id];
    }
  }
  return p;
}

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? fromRows(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

function writeCache(rows) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(rows));
  } catch {
    // Storage can be unavailable; prices still work for this session.
  }
}

// One shared copy for the whole app, so every screen shows the same prices
// and Supabase is only asked once per launch.
let current = readCache() || defaults();
let inflight = null;
const listeners = new Set();

export function refreshPricing() {
  if (inflight) return inflight;
  inflight = supabase
    .from("service_prices")
    .select("id, amount, note, active")
    .then(({ data, error }) => {
      if (error || !Array.isArray(data) || data.length === 0) {
        if (error) console.warn("Could not load prices, using last known prices:", error.message);
        return current;
      }
      writeCache(data);
      current = fromRows(data);
      listeners.forEach((fn) => fn(current));
      return current;
    })
    .catch(() => current)
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export function usePricing() {
  const [pricing, setPricing] = useState(current);
  useEffect(() => {
    listeners.add(setPricing);
    setPricing(current);
    refreshPricing();
    return () => listeners.delete(setPricing);
  }, []);
  return pricing;
}
