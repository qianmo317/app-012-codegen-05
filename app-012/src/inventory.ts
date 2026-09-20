import type { HerbMeta, Prescription } from './types';
import { HERBS, getHerbByName } from './herbs';

export interface Inventory {
  /** 抽屉里出现的药（原方药 + 可顶替的相近药 + 干扰项） */
  herbs: HerbMeta[];
  /** 药名 -> 柜内存量（克） */
  stock: Map<string, number>;
}

export interface InventoryOptions {
  /** 随机源，默认 Math.random；测试可注入固定随机 */
  random?: () => number;
  /** 强制让某味原方药缺货（测试用） */
  forceShortageFor?: string;
  /** 强制让候选也缺（测试用） */
  forceCandidatesShort?: boolean;
}

type Rng = () => number;

function intBetween(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

/**
 * 为一张处方摆一柜药：
 * - 原方每味药都在柜里；
 * - 原方药的相近药也放进柜子，作为缺货时的顶替候选；
 * - 其余抽屉用不重复的药填满做干扰；
 * - 正常关卡偶尔（约三成）有一味原方药不够；教学关与无相近药关保证够。
 */
export function generateInventory(prescription: Prescription, hasSimilarHerbs: boolean, options: InventoryOptions = {}): Inventory {
  const rng = options.random ?? Math.random;
  const herbs: HerbMeta[] = [];
  const seen = new Set<string>();

  const push = (name: string): void => {
    if (seen.has(name)) return;
    const meta = getHerbByName(name);
    if (meta) {
      herbs.push(meta);
      seen.add(name);
    }
  };

  prescription.items.forEach(item => push(item.herb));
  // 相近药作为顶替候选一起摆进柜里
  prescription.items.forEach(item => {
    if (hasSimilarHerbs) {
      const meta = getHerbByName(item.herb);
      meta?.similar?.forEach(s => push(s));
    }
  });
  // 干扰项凑满 36 个抽屉
  const pool = HERBS.filter(h => !seen.has(h.name));
  for (const h of pool) {
    if (herbs.length >= 36) break;
    herbs.push(h);
    seen.add(h.name);
  }

  const stock = new Map<string, number>();
  herbs.forEach(h => stock.set(h.name, intBetween(rng, 40, 90)));

  // 决定哪味药缺货：优先取有相近候选的，否则缺了也没法替
  const shortageCandidates = prescription.items.filter(i => {
    const meta = getHerbByName(i.herb);
    return hasSimilarHerbs && meta?.similar && meta.similar.length > 0;
  });
  let shortageItem: string | null = options.forceShortageFor ?? null;
  if (!shortageItem && shortageCandidates.length > 0 && rng() < 0.3) {
    shortageItem = shortageCandidates[Math.floor(rng() * shortageCandidates.length)].herb;
  }

  if (shortageItem) {
    const item = prescription.items.find(i => i.herb === shortageItem);
    if (item) {
      // 柜中只够零头，撑不下本方用量
      stock.set(shortageItem, intBetween(rng, 1, Math.max(1, Math.floor(item.grams / 3))));
      const meta = getHerbByName(shortageItem);
      meta?.similar?.forEach((s, idx) => {
        // 多数时候候选是够的；测试可强制候选也缺；偶发一个候选缺、另一个够
        if (options.forceCandidatesShort || (meta.similar!.length > 1 && idx === 0 && rng() < 0.5)) {
          stock.set(s, intBetween(rng, 1, Math.max(1, Math.floor(item.grams / 3))));
        } else {
          stock.set(s, intBetween(rng, Math.round(item.grams * 1.2), Math.round(item.grams * 4)));
        }
      });
    }
  }

  return { herbs, stock };
}

/** 这味药按现在的存量够不够本次用量 */
export function isStockSufficient(stock: Map<string, number>, herb: string, grams: number): boolean {
  return (stock.get(herb) ?? 0) >= grams;
}

/** 抓完药扣库存（按实际称得的量扣，至少为 0） */
export function deductStock(stock: Map<string, number>, herb: string, grams: number): number {
  const next = Math.max(0, (stock.get(herb) ?? 0) - Math.max(0, grams));
  stock.set(herb, next);
  return next;
}
