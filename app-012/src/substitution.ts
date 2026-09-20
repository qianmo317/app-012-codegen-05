import type { SubstitutionCandidate, SubstitutionComparison } from './types';
import { getProperties, getDoseRatio } from './herbProperties';

/** 综合评分权重：药性优先，其次用量要不要大改，再看存量与价格 */
export const SCORE_WEIGHTS = {
  similarity: 0.45,
  stock: 0.2,
  price: 0.2,
  dose: 0.15,
} as const;

/** 四气温凉刻度，用于衡量寒热偏向的差距 */
const NATURE_SCALE: Record<string, number> = {
  寒: -2,
  微寒: -1.5,
  凉: -1,
  平: 0,
  微温: 1,
  温: 1.5,
  热: 2,
};

function jaccard(a: string[], b: string[]): number {
  if (a.length === 0 && b.length === 0) return 1;
  const sa = new Set(a);
  const sb = new Set(b);
  let inter = 0;
  sa.forEach(x => { if (sb.has(x)) inter++; });
  const union = sa.size + sb.size - inter;
  return union === 0 ? 1 : inter / union;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** 药性相似度 0~100：四气、五味、归经、功效标签四项等权平均 */
export function herbSimilarity(original: string, candidate: string): number {
  const a = getProperties(original);
  const b = getProperties(candidate);
  if (!a || !b) return 0;

  const natureDiff = Math.abs((NATURE_SCALE[a.nature] ?? 0) - (NATURE_SCALE[b.nature] ?? 0));
  const natureSim = Math.max(0, 1 - natureDiff / 4);
  const flavorSim = jaccard(a.flavors, b.flavors);
  const meridianSim = jaccard(a.meridians, b.meridians);
  const effectSim = jaccard(a.effects, b.effects);

  return round1(((natureSim + flavorSim + meridianSim + effectSim) / 4) * 100);
}

/** 替代后建议用量：按老药师换算表折算，四舍五入到整克 */
export function adjustedDose(original: string, candidate: string, requiredGrams: number): number {
  return Math.round(requiredGrams * getDoseRatio(original, candidate));
}

export interface CandidateInput {
  name: string;
  stockGrams: number;
}

/**
 * 把每个候选摆在一起比：药性相似度、现有存量、单价、替代后用量增减，
 * 加权打分排出最合适的顶替药。存量不够的候选一律排到后面。
 * 一个能撑下来的都没有时 canFulfill=false，明确告诉抓药的人方子配不齐。
 */
export function compareSubstitution(
  original: string,
  requiredGrams: number,
  candidateInputs: CandidateInput[],
  stockGramsOfOriginal?: number,
): SubstitutionComparison {
  const built = candidateInputs
    .filter(c => c.name !== original)
    .map(c => buildCandidate(original, requiredGrams, c.name, c.stockGrams));

  const cheapest = built.reduce((m, c) => Math.min(m, c.totalPrice), Infinity);

  const scored = built.map(c => {
    const priceScore = Number.isFinite(cheapest) && cheapest > 0
      ? Math.min(100, round1((cheapest / c.totalPrice) * 100))
      : 100;
    const scoreParts = {
      similarity: c.similarity,
      stock: c.scoreParts.stock,
      price: priceScore,
      dose: c.scoreParts.dose,
    };
    const score = round1(
      scoreParts.similarity * SCORE_WEIGHTS.similarity +
      scoreParts.stock * SCORE_WEIGHTS.stock +
      scoreParts.price * SCORE_WEIGHTS.price +
      scoreParts.dose * SCORE_WEIGHTS.dose,
    );
    return { ...c, scoreParts, score };
  });

  const sufficient = scored.filter(c => c.sufficient);
  const insufficient = scored.filter(c => !c.sufficient);
  sufficient.sort((a, b) => b.score - a.score);
  insufficient.sort((a, b) => b.score - a.score);
  const candidates = [...sufficient, ...insufficient];

  const recommended = sufficient[0] ?? null;
  candidates.forEach(c => {
    c.drawbacks = describeDrawbacks(c, recommended);
  });

  const canFulfill = recommended !== null;
  const ownStock = stockGramsOfOriginal ?? 0;
  const message = canFulfill
    ? ''
    : `${original}柜中只剩${ownStock}g，这张方子需要${requiredGrams}g；` +
      (candidates.length === 0
        ? '又没有药性相近的药可替，这张方子今天配不齐，请病人改日再来或请大夫更方。'
        : `可替的${candidates.map(c => c.candidate).join('、')}存量也都不够，这张方子今天配不齐，请病人改日再来或请大夫更方。`);

  return {
    original,
    requiredGrams,
    stockGrams: ownStock,
    candidates,
    recommended,
    canFulfill,
    message,
  };
}

function buildCandidate(original: string, requiredGrams: number, name: string, stockGrams: number): SubstitutionCandidate {
  const props = getProperties(name);
  const adjusted = adjustedDose(original, name, requiredGrams);
  const doseChangePct = Math.round((adjusted / requiredGrams - 1) * 100);
  const pricePer10g = props?.pricePer10g ?? 0;
  const sufficient = stockGrams >= adjusted;
  // 存量能盖住两倍需求即满分；不够的候选存量分按缺口比例折算
  const stockScore = sufficient
    ? Math.min(100, round1((stockGrams / (adjusted * 2)) * 100))
    : Math.max(0, round1((stockGrams / adjusted) * 100));
  // 用量变动越大越扣分，变动 50% 及以上扣光
  const doseScore = round1(Math.max(0, 100 - Math.min(100, Math.abs(doseChangePct) * 2)));

  return {
    original,
    candidate: name,
    similarity: herbSimilarity(original, name),
    stockGrams,
    requiredGrams,
    adjustedGrams: adjusted,
    doseChangePct,
    pricePer10g,
    totalPrice: round1((pricePer10g / 10) * adjusted),
    sufficient,
    score: 0,
    scoreParts: { similarity: 0, stock: stockScore, price: 0, dose: doseScore },
    drawbacks: [],
  };
}

/** 与最终选定的候选逐条对比，说明差在哪一条 */
export function describeDrawbacks(candidate: SubstitutionCandidate, chosen: SubstitutionCandidate | null): string[] {
  const reasons: string[] = [];
  if (!candidate.sufficient) {
    reasons.push(`存量仅${candidate.stockGrams}g，不够替代所需的${candidate.adjustedGrams}g`);
  }
  if (!chosen) return reasons;
  if (candidate.candidate === chosen.candidate) return reasons;

  const simGap = chosen.similarity - candidate.similarity;
  if (simGap >= 5) {
    reasons.push(`药性相似度${candidate.similarity}分，比${chosen.candidate}低${round1(simGap)}分`);
  }
  const stockGap = chosen.scoreParts.stock - candidate.scoreParts.stock;
  if (candidate.sufficient && stockGap >= 10) {
    reasons.push(`存量余量不如${chosen.candidate}（本柜${candidate.stockGrams}g/${chosen.stockGrams}g）`);
  }
  const priceGap = (candidate.totalPrice - chosen.totalPrice) / chosen.totalPrice;
  if (priceGap >= 0.1) {
    reasons.push(`药费更贵（${candidate.totalPrice}文/${chosen.totalPrice}文）`);
  }
  const doseGap = Math.abs(candidate.doseChangePct) - Math.abs(chosen.doseChangePct);
  if (doseGap >= 10) {
    reasons.push(`替代后用量要${candidate.doseChangePct > 0 ? '加' : '减'}${Math.abs(candidate.doseChangePct)}%，比${chosen.candidate}调整更大`);
  }
  if (reasons.length === 0) {
    reasons.push(`综合得分${candidate.score}分，略低于${chosen.candidate}的${chosen.score}分`);
  }
  return reasons;
}

/** 生成定药理由：把选中候选占优的几条说清楚 */
export function buildDecisionReason(original: string, chosen: SubstitutionCandidate): string {
  const parts: string[] = [];
  parts.push(`与${original}药性相似度${chosen.similarity}分`);
  if (chosen.sufficient) {
    parts.push(`存量${chosen.stockGrams}g够本次${chosen.adjustedGrams}g`);
  }
  if (chosen.doseChangePct === 0) {
    parts.push('用量无需增减');
  } else {
    parts.push(`替代后按${chosen.doseChangePct > 0 ? '加' : '减'}${Math.abs(chosen.doseChangePct)}%用${chosen.adjustedGrams}g`);
  }
  parts.push(`药费${chosen.totalPrice}文`);
  return parts.join('，');
}
