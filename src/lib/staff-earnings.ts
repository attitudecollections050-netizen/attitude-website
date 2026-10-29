// Product Staff reward rule: ₦1,000 for every 10 products they add (archived products don't count).
export const PRODUCTS_PER_REWARD = 10;
export const REWARD_KOBO = 100_000;

export interface Earnings {
  earnedKobo: number;
  /** Products counted towards the next reward (0–9). */
  progress: number;
  remaining: number;
  percent: number;
}

export function earningsFor(productsAdded: number): Earnings {
  const added = Math.max(0, Math.floor(productsAdded));
  const progress = added % PRODUCTS_PER_REWARD;
  return {
    earnedKobo: Math.floor(added / PRODUCTS_PER_REWARD) * REWARD_KOBO,
    progress,
    remaining: PRODUCTS_PER_REWARD - progress,
    percent: Math.round((progress / PRODUCTS_PER_REWARD) * 100),
  };
}
