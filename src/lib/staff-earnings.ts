// Product Staff reward rule: ₦1,000 for every 10 products that are live in the store.
// Counting live (published) products, not drafts, keeps empty placeholder products from earning.
export const PRODUCTS_PER_REWARD = 10;
export const REWARD_KOBO = 100_000;

export interface Earnings {
  earnedKobo: number;
  /** Live products counted towards the next reward (0–9). */
  progress: number;
  remaining: number;
  percent: number;
}

export function earningsFor(liveProducts: number): Earnings {
  const live = Math.max(0, Math.floor(liveProducts));
  const progress = live % PRODUCTS_PER_REWARD;
  return {
    earnedKobo: Math.floor(live / PRODUCTS_PER_REWARD) * REWARD_KOBO,
    progress,
    remaining: PRODUCTS_PER_REWARD - progress,
    percent: Math.round((progress / PRODUCTS_PER_REWARD) * 100),
  };
}
