// services/fx.service.ts
const cache = new Map<string, { rate: number; time: number }>();
const TTL = 1000 * 60 * 60;

export async function convertCurrency(
  amount: number,
  from: string,
  to: string
): Promise<number> {
  const key = `${from}_${to}`;
  const now = Date.now();

  const cached = cache.get(key);

  if (cached && now - cached.time < TTL) {
    return amount * cached.rate;
  }

  const rate = await getRate(from, to);

  cache.set(key, { rate, time: now });

  return amount * rate;
}

// mock rates (replace with real API later)
async function getRate(from: string, to: string) {
  if (from === "USD" && to === "INR") return 83;
  if (from === "USD" && to === "NGN") return 1500;
  return 1;
}