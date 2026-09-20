// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest';
import { GameManager } from '../src/game/state';
import { getLevelConfig } from '../src/levels';
import { generatePrescription } from '../src/prescription';
import { clearSubstitutionHistory } from '../src/substitutionStore';
import { PatientBook } from '../src/patient';

function newLevel4(): GameManager {
  const game = new GameManager();
  game.startLevel(4, false, { random: () => 0.99, forceShortageFor: '陈皮' });
  // 丢掉 startLevel 随机生成的病人名册，测试只用 P1999 的固定方子
  game.patientBook = new PatientBook();
  return game;
}

/** 换成确定的处方，补齐各味药库存，再手动制造缺货并触发比对 */
function setupShortage(
  game: GameManager,
  items: Array<[string, number]>,
  shortage: { herb: string; own: number; candidates?: Record<string, number> },
): void {
  const rx = generatePrescription(getLevelConfig(4), 'P1999');
  rx.items = items.map(([herb, grams]) => ({ herb, grams, decoct: 'normal' }));
  game.prescription = rx;
  game.patientId = rx.patientId;
  game.patientBook.register(rx.patientId, rx);

  // 固定处方里的药默认柜存充足，再单独设置缺货药与候选存量
  for (const [herb] of items) game.stock.set(herb, 60);
  game.stock.set(shortage.herb, shortage.own);
  for (const [name, g] of Object.entries(shortage.candidates ?? {})) game.stock.set(name, g);

  game.substituteCandidate = new Map();
  game.substituteGrams = new Map();
  game.substituteInfo = new Map();
  game.shortageOriginal = null;
  game.comparison = null;
  game.selectedCandidate = null;
  game.recalledDecision = null;
  game.weighed = new Set();
  game.results = [];
  game.packages = [];
  game.phase = 'playing';
  (game as unknown as { checkShortages: () => void }).checkShortages();
}

beforeEach(() => clearSubstitutionHistory());

describe('缺货替药流程（GameManager 集成）', () => {
  it('缺货时进入比对面板，默认选推荐候选，定药后按调整后的克数抓药并扣库存', () => {
    const game = newLevel4();
    setupShortage(game, [['陈皮', 20], ['甘草', 10]], { herb: '陈皮', own: 3, candidates: { 青皮: 40 } });

    expect(game.phase).toBe('shortage');
    expect(game.shortageOriginal).toBe('陈皮');
    expect(game.comparison?.canFulfill).toBe(true);
    expect(game.selectedCandidate).toBe('青皮');
    // 比对面板上已算出替代后的建议用量：20g × 0.8 = 16g（定药后才生效）
    expect(game.comparison?.recommended?.adjustedGrams).toBe(16);
    expect(game.effectiveFor('陈皮')).toEqual({ herb: '陈皮', grams: 20 });

    // 存量不够/不存在的候选选不上
    game.stock.set('不存在', 0);
    game.selectCandidate('不存在');
    expect(game.selectedCandidate).toBe('青皮');

    const ok = game.confirmShortage('王掌柜');
    expect(ok).toBe(true);
    expect(game.phase).toBe('playing');
    expect(game.effectiveFor('陈皮')).toEqual({ herb: '青皮', grams: 16 });
    const info = game.substituteInfo.get('陈皮')!;
    expect(info.decidedBy).toBe('王掌柜');
    expect(info.candidate).toBe('青皮');
    expect(info.grams).toBe(16);

    // 点青皮抽屉，目标是替代后的 16g
    expect(game.selectDrawer('青皮')).toBe(true);
    expect(game.targetGrams).toBe(16);
    game.setWeight(16);
    const result = game.confirmWeight();
    expect(result?.ok).toBe(true);
    expect(result?.herb).toBe('陈皮');
    expect(result?.dispensedAs).toBe('青皮');
    expect(game.stock.get('青皮')).toBe(24);
    // 药包上标注代了谁
    expect(game.packages[0].replaces).toBe('陈皮');

    // 再抓完剩下的甘草，进入复核
    expect(game.selectDrawer('甘草')).toBe(true);
    game.setWeight(10);
    game.confirmWeight();
    expect(game.phase).toBe('review');
  });

  it('候选存量都不够时无法定药，只能告知病人配不齐并送走', () => {
    const game = newLevel4();
    setupShortage(game, [['陈皮', 20]], { herb: '陈皮', own: 2, candidates: { 青皮: 3 } });

    expect(game.phase).toBe('shortage');
    expect(game.comparison?.canFulfill).toBe(false);
    expect(game.selectedCandidate).toBeNull();
    expect(game.comparison?.message).toContain('今天配不齐');
    expect(game.comparison?.message).toContain('青皮');
    expect(game.confirmShortage()).toBe(false);

    const queueBefore = game.state.queue;
    const satisfactionBefore = game.state.satisfaction;
    game.ackUnfillable();
    expect(game.state.queue).toBe(queueBefore - 1);
    expect(game.state.satisfaction).toBe(satisfactionBefore - 20);
  });

  it('同一位病人再来抓同一张方子，默认带出上次定的候选并标注沿用', () => {
    const first = newLevel4();
    setupShortage(first, [['陈皮', 20]], { herb: '陈皮', own: 2, candidates: { 青皮: 40 } });
    expect(first.selectedCandidate).toBe('青皮');
    first.confirmShortage('王掌柜');

    // 同一病人 P1999、同一张方子复诊
    const second = new GameManager();
    second.patientBook = first.patientBook;
    second.startLevel(4, false, { random: () => 0, forceReturning: true });
    expect(second.prescription?.patientId).toBe('P1999');
    expect(second.prescription?.items.some(i => i.herb === '陈皮')).toBe(true);

    second.stock.set('陈皮', 1);
    second.stock.set('青皮', 40);
    second.phase = 'playing';
    (second as unknown as { checkShortages: () => void }).checkShortages();

    expect(second.phase).toBe('shortage');
    expect(second.recalledDecision?.candidate).toBe('青皮');
    expect(second.selectedCandidate).toBe('青皮');

    second.confirmShortage('李师傅');
    const info = second.substituteInfo.get('陈皮')!;
    expect(info.candidate).toBe('青皮');
    expect(info.reason).toContain('沿用上次');
    expect(info.reason).toContain('王掌柜');
  });

  it('上次的候选这次存量不够时不默认带出，明确判为配不齐', () => {
    const first = newLevel4();
    setupShortage(first, [['陈皮', 20]], { herb: '陈皮', own: 2, candidates: { 青皮: 40 } });
    first.confirmShortage('王掌柜');

    const second = new GameManager();
    second.patientBook = first.patientBook;
    second.startLevel(4, false, { random: () => 0, forceReturning: true });
    second.stock.set('陈皮', 1);
    second.stock.set('青皮', 2); // 上次的青皮这次也不够
    second.phase = 'playing';
    (second as unknown as { checkShortages: () => void }).checkShortages();

    expect(second.comparison?.canFulfill).toBe(false);
    expect(second.selectedCandidate).toBeNull();
    expect(second.comparison?.message).toContain('今天配不齐');
  });

  it('抓药人改选/定药时，留档记录实际定药人与理由', () => {
    const game = newLevel4();
    setupShortage(game, [['黄芩', 10]], { herb: '黄芩', own: 2, candidates: { 黄连: 60 } });
    expect(game.comparison?.canFulfill).toBe(true);
    game.confirmShortage('抓药的赵姑娘');
    const info = game.substituteInfo.get('黄芩')!;
    expect(info.candidate).toBe('黄连');
    expect(info.decidedBy).toBe('抓药的赵姑娘');
    expect(info.reason).not.toContain('沿用上次');
  });

  it('无缺货时正常开局，不弹比对面板', () => {
    const game = new GameManager();
    game.startLevel(1, false, { random: () => 0.5 });
    expect(game.phase).toBe('playing');
    expect(game.comparison).toBeNull();
  });
});
