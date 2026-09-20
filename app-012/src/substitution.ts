import type {
  HerbProfile,
  SubstituteCandidate,
  CandidateEvaluation,
  CandidateScores,
  SubstitutionPlan,
  SubstitutionDecision,
} from './types';
import { getHerbProfile, getSubstituteSpecs } from './herbProfiles';

/** 四条维度的权重：药性最重，其次用量要不要增减，再是存量与单价 */
export const SCORE_WEIGHTS = { nature: 0.45, dose: 0.25, stock: 0.15, price: 0.15 } as const;

const NATURE_ORDER: Record<HerbProfile['nature'], number> = { 寒: 0, 凉: 1, 平: 2, 温: 3, 热: 4 };

function jaccard(a: string[], b: string[]): number {
  if (a.length === 0 && b.length === 0) return 1;
  const setB = new Set(b);
  const inter = a.filter(x => setB.has(x)).length;
  const union = new Set([...a, ...b]).size;
  return union === 0 ? 0 : inter / union;
}

/** 两味药的药性相近度 0..1：性（寒热温凉平）占 0.4，味占 0.3，功效占 0.3 */
export function compareNature(a: HerbProfile, b: HerbProfile): number {
  const natureClose = 1 - Math.abs(NATURE_ORDER[a.nature] - NATURE_ORDER[b.nature]) / 4;
  const score = 0.4 * natureClose + 0.3 * jaccard(a.flavors, b.flavors) + 0.3 * jaccard(a.effects, b.effects);
  return Math.round(score * 1000) / 1000;
}

/** 按替代表 + 库存，把候选药一个个摆出来 */
export function buildCandidates(originalHerb: string, inventory: Map<string, number>): SubstituteCandidate[] {
  const original = getHerbProfile(originalHerb);
  if (!original) return [];
  const candidates: SubstituteCandidate[] = [];
  for (const spec of getSubstituteSpecs(originalHerb)) {
    const profile = getHerbProfile(spec.herb);
    if (!profile) continue;
    candidates.push({
      herb: spec.herb,
      natureScore: compareNature(original, profile),
      stockGrams: inventory.get(spec.herb) ?? 0,
      pricePerGram: profile.pricePerGram,
      doseFactor: spec.doseFactor,
    });
  }
  return candidates;
}

function scoreCandidate(
  c: SubstituteCandidate,
  adjustedGrams: number,
  minPrice: number,
): CandidateScores {
  const nature = Math.round(c.natureScore * 100);
  const dose = Math.round(Math.max(0, 1 - Math.abs(c.doseFactor - 1)) * 100);
  const stock = Math.round(Math.min(1, c.stockGrams / (adjustedGrams * 1.5)) * 100);
  const price = Math.round((minPrice / c.pricePerGram) * 100);
  const total = Math.round(
    nature * SCORE_WEIGHTS.nature +
    dose * SCORE_WEIGHTS.dose +
    stock * SCORE_WEIGHTS.stock +
    price * SCORE_WEIGHTS.price,
  );
  return { nature, stock, price, dose, total };
}

function listShortcomings(
  c: SubstituteCandidate,
  adjustedGrams: number,
  requiredGrams: number,
  minPrice: number,
): string[] {
  const out: string[] = [];
  const pct = Math.round(c.natureScore * 100);
  if (c.natureScore < 0.6) out.push(`药性偏差较大（相近度${pct}%）`);
  else if (c.natureScore < 0.8) out.push(`药性相近度一般（${pct}%）`);

  if (c.stockGrams < adjustedGrams) {
    out.push(`存量不足：需${adjustedGrams}g，仅存${c.stockGrams}g`);
  } else if (c.stockGrams < adjustedGrams * 1.5) {
    out.push(`存量偏紧（仅存${c.stockGrams}g）`);
  }

  if (c.doseFactor > 1) {
    out.push(`替代后需增量${Math.round((c.doseFactor - 1) * 100)}%（${requiredGrams}g→${adjustedGrams}g）`);
  } else if (c.doseFactor < 1) {
    out.push(`药力更猛，替代后需减量${Math.round((1 - c.doseFactor) * 100)}%（${requiredGrams}g→${adjustedGrams}g）`);
  }

  if (c.pricePerGram > minPrice * 1.3) {
    out.push(`单价偏高（${c.pricePerGram}元/g）`);
  }
  return out;
}

/**
 * 评估一张方子上某味缺货药的替代方案。
 * 候选按综合分排序，存量不够的排到后面并写明原因；
 * 所有候选都撑不下来时 feasible=false，message 明确告知配不齐。
 */
export function evaluateSubstitution(
  originalHerb: string,
  requiredGrams: number,
  candidates: SubstituteCandidate[],
): SubstitutionPlan {
  if (candidates.length === 0) {
    return {
      originalHerb,
      requiredGrams,
      evaluations: [],
      recommended: null,
      feasible: false,
      message: `「${originalHerb}」没有登记的替代药，这方子今天配不齐`,
    };
  }

  const minPrice = Math.min(...candidates.map(c => c.pricePerGram));
  const evaluations: CandidateEvaluation[] = candidates.map(c => {
    const adjustedGrams = Math.round(requiredGrams * c.doseFactor * 10) / 10;
    return {
      candidate: c,
      adjustedGrams,
      stockEnough: c.stockGrams >= adjustedGrams,
      scores: scoreCandidate(c, adjustedGrams, minPrice),
      shortcomings: listShortcomings(c, adjustedGrams, requiredGrams, minPrice),
      rank: 0,
    };
  });

  // 存量够的按综合分排前；存量不够的排后，原因已写进 shortcomings
  evaluations.sort((a, b) => {
    if (a.stockEnough !== b.stockEnough) return a.stockEnough ? -1 : 1;
    return b.scores.total - a.scores.total;
  });
  evaluations.forEach((e, i) => { e.rank = i + 1; });

  const best = evaluations.find(e => e.stockEnough) ?? null;
  const feasible = best !== null;
  const message = feasible
    ? `建议用「${best!.candidate.herb}」替代（综合${best!.scores.total}分）`
    : `「${originalHerb}」柜存不够，几个候选的存量也撑不下来，这方子今天配不齐`;

  return { originalHerb, requiredGrams, evaluations, recommended: best?.candidate.herb ?? null, feasible, message };
}

/** 方子的规范 key：同一组药+克数视为同一张方子 */
export function prescriptionKey(items: { herb: string; grams: number }[]): string {
  return items.map(i => `${i.herb}:${i.grams}`).sort().join('|');
}

/** 生成「为什么定这个」的落账理由 */
export function buildDecisionReason(
  plan: SubstitutionPlan,
  chosenHerb: string,
  reusedPrior: boolean,
): string {
  const evaluation = plan.evaluations.find(e => e.candidate.herb === chosenHerb);
  if (!evaluation) return '药师手动指定';
  const parts: string[] = [];
  if (reusedPrior) parts.push('沿用该病人上次的决定');
  parts.push(
    evaluation.rank === 1
      ? `综合分最高（${evaluation.scores.total}分）`
      : `综合第${evaluation.rank}（${evaluation.scores.total}分）`,
  );
  parts.push(`药性相近度${evaluation.scores.nature}分`);
  if (evaluation.candidate.doseFactor !== 1) {
    parts.push(`用量调整为${evaluation.adjustedGrams}g`);
  }
  if (evaluation.shortcomings.length > 0) {
    parts.push(`不足：${evaluation.shortcomings.join('；')}`);
  } else {
    parts.push('各条都合适');
  }
  return parts.join('，');
}

/** 决定落账（纯组装，持久化在 decisionLog.ts） */
export function makeDecision(
  patientId: string,
  key: string,
  plan: SubstitutionPlan,
  chosenHerb: string,
  decidedBy: string,
  reusedPrior: boolean,
): SubstitutionDecision {
  const evaluation = plan.evaluations.find(e => e.candidate.herb === chosenHerb);
  return {
    patientId,
    prescriptionKey: key,
    originalHerb: plan.originalHerb,
    chosenHerb,
    adjustedGrams: evaluation?.adjustedGrams ?? plan.requiredGrams,
    decidedBy,
    reason: buildDecisionReason(plan, chosenHerb, reusedPrior),
    decidedAt: Date.now(),
  };
}
