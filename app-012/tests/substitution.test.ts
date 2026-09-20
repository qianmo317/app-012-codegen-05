import { describe, it, expect, beforeEach } from 'vitest';
import {
  compareNature,
  buildCandidates,
  evaluateSubstitution,
  prescriptionKey,
  buildDecisionReason,
  makeDecision,
} from '../src/substitution';
import { HERB_PROFILES, getHerbProfile } from '../src/herbProfiles';
import { recordDecision, findPriorDecision, clearDecisions } from '../src/decisionLog';
import { GameManager } from '../src/game/state';
import type { SubstituteCandidate } from '../src/types';

function cand(herb: string, stockGrams: number, doseFactor = 1, pricePerGram?: number): SubstituteCandidate {
  const profile = getHerbProfile(herb)!;
  return {
    herb,
    natureScore: compareNature(HERB_PROFILES['白芍'], profile),
    stockGrams,
    pricePerGram: pricePerGram ?? profile.pricePerGram,
    doseFactor,
  };
}

describe('compareNature', () => {
  it('identical herbs score 1', () => {
    expect(compareNature(HERB_PROFILES['白芍'], HERB_PROFILES['白芍'])).toBe(1);
  });

  it('similar herbs score higher than distant ones', () => {
    const near = compareNature(HERB_PROFILES['黄芩'], HERB_PROFILES['黄连']);
    const far = compareNature(HERB_PROFILES['黄芩'], HERB_PROFILES['红花']);
    expect(near).toBeGreaterThan(far);
  });
});

describe('buildCandidates', () => {
  it('builds candidates from the substitute table with stock and price', () => {
    const inv = new Map<string, number>([['赤芍', 50], ['当归', 30]]);
    const list = buildCandidates('白芍', inv);
    expect(list.length).toBe(2);
    const chishao = list.find(c => c.herb === '赤芍')!;
    expect(chishao.stockGrams).toBe(50);
    expect(chishao.pricePerGram).toBe(HERB_PROFILES['赤芍'].pricePerGram);
    expect(chishao.doseFactor).toBe(1.0);
  });

  it('returns empty for herbs without substitutes', () => {
    expect(buildCandidates('不存在的药', new Map())).toEqual([]);
  });
});

describe('evaluateSubstitution', () => {
  it('ranks the best candidate first and recommends it', () => {
    // 赤芍：药性最近、等量、便宜、存量足 → 应排第一
    const plan = evaluateSubstitution('白芍', 12, [
      cand('赤芍', 60),
      cand('当归', 60),
    ]);
    expect(plan.feasible).toBe(true);
    expect(plan.recommended).toBe('赤芍');
    expect(plan.evaluations[0].candidate.herb).toBe('赤芍');
    expect(plan.evaluations[0].rank).toBe(1);
  });

  it('pushes insufficient-stock candidates to the back with a reason', () => {
    const plan = evaluateSubstitution('白芍', 12, [
      cand('赤芍', 3),   // 存量不够
      cand('当归', 60),
    ]);
    expect(plan.feasible).toBe(true);
    const last = plan.evaluations[plan.evaluations.length - 1];
    expect(last.candidate.herb).toBe('赤芍');
    expect(last.stockEnough).toBe(false);
    expect(last.shortcomings.some(s => s.includes('存量不足'))).toBe(true);
  });

  it('declares the prescription unfillable when no candidate can cover', () => {
    const plan = evaluateSubstitution('白芍', 20, [
      cand('赤芍', 5),
      cand('当归', 2),
    ]);
    expect(plan.feasible).toBe(false);
    expect(plan.recommended).toBeNull();
    expect(plan.message).toContain('配不齐');
  });

  it('handles herbs with no registered substitutes', () => {
    const plan = evaluateSubstitution('甘草', 10, []);
    expect(plan.feasible).toBe(false);
    expect(plan.message).toContain('配不齐');
  });

  it('applies dose factor to adjusted grams and notes it', () => {
    const plan = evaluateSubstitution('白芍', 10, [cand('当归', 60, 1.2)]);
    const e = plan.evaluations[0];
    expect(e.adjustedGrams).toBeCloseTo(12, 5);
    expect(e.shortcomings.some(s => s.includes('增量'))).toBe(true);
  });

  it('notes price and nature shortcomings', () => {
    const plan = evaluateSubstitution('白芍', 10, [
      cand('赤芍', 60),
      cand('当归', 60, 1, 9.9), // 天价
    ]);
    const expensive = plan.evaluations.find(e => e.candidate.herb === '当归')!;
    expect(expensive.shortcomings.some(s => s.includes('单价偏高'))).toBe(true);
  });
});

describe('prescriptionKey', () => {
  it('is stable regardless of item order', () => {
    const a = prescriptionKey([{ herb: '白芍', grams: 12 }, { herb: '甘草', grams: 6 }]);
    const b = prescriptionKey([{ herb: '甘草', grams: 6 }, { herb: '白芍', grams: 12 }]);
    expect(a).toBe(b);
  });

  it('differs when grams differ', () => {
    const a = prescriptionKey([{ herb: '白芍', grams: 12 }]);
    const b = prescriptionKey([{ herb: '白芍', grams: 15 }]);
    expect(a).not.toBe(b);
  });
});

describe('substitution decision log', () => {
  beforeEach(() => clearDecisions());

  it('records who decided and why, and finds it for the same patient and prescription', () => {
    const plan = evaluateSubstitution('白芍', 12, [cand('赤芍', 60), cand('当归', 60)]);
    const key = prescriptionKey([{ herb: '白芍', grams: 12 }]);
    const decision = makeDecision('patient-1', key, plan, '赤芍', '当班药师', false);
    recordDecision(decision);

    expect(decision.decidedBy).toBe('当班药师');
    expect(decision.reason).toContain('综合分最高');

    const found = findPriorDecision('patient-1', key, '白芍');
    expect(found).not.toBeNull();
    expect(found!.chosenHerb).toBe('赤芍');
  });

  it('does not leak decisions across patients or prescriptions', () => {
    const plan = evaluateSubstitution('白芍', 12, [cand('赤芍', 60)]);
    const key = prescriptionKey([{ herb: '白芍', grams: 12 }]);
    recordDecision(makeDecision('patient-1', key, plan, '赤芍', '当班药师', false));

    expect(findPriorDecision('patient-2', key, '白芍')).toBeNull();
    expect(findPriorDecision('patient-1', prescriptionKey([{ herb: '白芍', grams: 99 }]), '白芍')).toBeNull();
    expect(findPriorDecision('patient-1', key, '当归')).toBeNull();
  });

  it('marks reused decisions in the reason', () => {
    const plan = evaluateSubstitution('白芍', 12, [cand('赤芍', 60)]);
    const reason = buildDecisionReason(plan, '赤芍', true);
    expect(reason).toContain('沿用');
  });
});

describe('GameManager substitution flow', () => {
  beforeEach(() => clearDecisions());

  function startUntilFeasibleSubstitute(game: GameManager, maxTries = 100): boolean {
    for (let i = 0; i < maxTries; i++) {
      game.startLevel(1, false);
      if (game.phase === 'substitute' && game.currentPlan?.feasible) return true;
    }
    return false;
  }

  it('enters substitute phase when a herb is short and confirms a candidate', () => {
    const game = new GameManager();
    expect(startUntilFeasibleSubstitute(game)).toBe(true);

    const plan = game.currentPlan!;
    const stock = game.inventory.get(plan.originalHerb)!;
    expect(stock).toBeLessThan(plan.requiredGrams);

    const chosen = game.selectedSubstitute!;
    expect(chosen).toBe(plan.recommended);
    const ok = game.confirmSubstitution();
    expect(ok).toBe(true);
    // 方子上原药被换成候选，用量按系数调整
    const item = game.prescription!.items.find(i => i.herb === chosen);
    expect(item).toBeTruthy();
    // 决定已落账：谁定的、为什么定
    const prior = findPriorDecision(game.prescription!.patientId, game.currentRxKey, plan.originalHerb);
    expect(prior).not.toBeNull();
    expect(prior!.chosenHerb).toBe(chosen);
    expect(prior!.decidedBy).toBe('当班药师');
    expect(prior!.reason.length).toBeGreaterThan(0);
  });

  it('declares unfillable and loses a patient when no candidate can cover', () => {
    const game = new GameManager();
    // 人为造一个所有候选都不够的局面
    game.startLevel(1, false);
    game.prescription!.items = [{ herb: '白芍', grams: 20, decoct: 'normal' }];
    game.currentRxKey = prescriptionKey(game.prescription!.items);
    game.inventory.set('白芍', 5);
    game.inventory.set('赤芍', 3);
    game.inventory.set('当归', 0);
    (game as any).setupSubstitutions();
    (game as any).advanceSubstitution();

    expect(game.phase).toBe('substitute');
    expect(game.currentPlan!.feasible).toBe(false);
    expect(game.currentPlan!.message).toContain('配不齐');

    const queueBefore = game.state.queue;
    game.declareUnfillable();
    expect(game.state.queue).toBe(queueBefore - 1);
  });

  it('cannot confirm a candidate with insufficient stock', () => {
    const game = new GameManager();
    game.startLevel(1, false);
    game.prescription!.items = [{ herb: '白芍', grams: 20, decoct: 'normal' }];
    game.currentRxKey = prescriptionKey(game.prescription!.items);
    game.inventory.set('白芍', 5);
    game.inventory.set('赤芍', 3);   // 不够
    game.inventory.set('当归', 60);  // 够
    (game as any).setupSubstitutions();
    (game as any).advanceSubstitution();

    expect(game.selectSubstitute('赤芍')).toBe(false);
    expect(game.selectSubstitute('当归')).toBe(true);
  });

  it('defaults to the prior choice when the same patient returns with the same prescription', () => {
    const game = new GameManager();
    expect(startUntilFeasibleSubstitute(game)).toBe(true);
    const firstChoice = game.currentPlan!.recommended!;
    game.selectSubstitute(firstChoice);
    expect(game.confirmSubstitution()).toBe(true);

    // 让这位病人一定回访：名册只留他，回访概率拉满
    const patientId = game.prescription!.patientId;
    game.recentPatients = game.recentPatients.filter(r => r.patientId === patientId);
    game.revisitChance = 1;

    // 回访后柜存重新随机，候选存量够时上次的选择会被默认带出来
    let revisited = false;
    for (let i = 0; i < 50 && !revisited; i++) {
      game.startLevel(2, false);
      if (game.phase === 'substitute' && game.priorChoice === firstChoice) {
        revisited = true;
      }
    }
    expect(revisited).toBe(true);
    expect(game.selectedSubstitute).toBe(firstChoice);
    expect(game.prescription!.patientId).toBe(patientId);
  });
});
