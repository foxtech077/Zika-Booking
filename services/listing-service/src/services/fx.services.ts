import { convertFromDb } from "./exchangeRate.services.js";

const cache = new Map<string, { rate: number; time: number }>();
const inflight = new Map<string, Promise<number>>();
const TTL = 1000 * 60 * 60;

export async function convertCurrency(
  amount: number,
  from: string,
  to: string
): Promise<number> {
  const key = `${from.toUpperCase()}_${to.toUpperCase()}`;
  const now = Date.now();

  const cached = cache.get(key);
  if (cached && now - cached.time < TTL) {
    return amount * cached.rate;
  }

  if (inflight.has(key)) {
    const rate = await inflight.get(key)!;
    return amount * rate;
  }

  const fetchPromise = getRate(from, to)
    .then((rate) => {
      cache.set(key, { rate, time: Date.now() });
      return rate;
    })
    .finally(() => {
      inflight.delete(key);
    });

  inflight.set(key, fetchPromise);

  const rate = await fetchPromise;
  return amount * rate;
}

async function getRate(from: string, to: string): Promise<number> {
  if (from.toUpperCase() === to.toUpperCase()) return 1;

  // Try DB first
  const dbRate = await convertFromDb(1, from, to);
  if (dbRate !== null) return dbRate;

  // Fallback to live API
  return getRateFromApi(from, to);
}

async function getRateFromApi(from: string, to: string): Promise<number> {
  try {
    const response = await fetch(`https://open.er-api.com/v6/latest/${from}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch FX rates: ${response.statusText}`);
    }
    const data = await response.json();
    const rate = data?.rates?.[to];
    if (rate === undefined) {
      throw new Error(`Currency ${to} not found in rates`);
    }
    return rate;
  } catch (error) {
    console.error(`FX API error for ${from} to ${to}:`, error);
    throw new Error("FX rate unavailable");
  }
}
