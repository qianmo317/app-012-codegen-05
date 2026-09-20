// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest';
import {
  prescriptionSignature,
  recordSubstitutionDecision,
  getLastSubstitution,
  getLastSubstitutionForItem,
  clearSubstitutionHistory,
  seedDecisionsForTest,
} from '../src/substitutionStore';

const rxA = [
  { herb: '白芍', grams: 12, decoct: 'normal' as const },
  { herb: '甘草', grams: 6, decoct: 'normal' as const },
];
const rxB = [
  { herb: '甘草', grams: 6, decoct: 'normal' as const },
  { herb: '白芍', grams: 12, decoct: 'normal' as const },
];
const rxDifferentGram = [
  { herb: '白芍', grams: 15, decoct: 'normal' as const },
  { herb: '甘草', grams: 6, decoct: 'normal' as const },
];

beforeEach(() => clearSubstitutionHistory());

describe('prescriptionSignature', () => {
  it('药味顺序不同但内容相同，签名一致（同一张方子）', () => {
    expect(prescriptionSignature(rxA)).toBe(prescriptionSignature(rxB));
  });

  it('克数不同签名不同', () => {
    expect(prescriptionSignature(rxA)).not.toBe(prescriptionSignature(rxDifferentGram));
  });
});

describe('recordSubstitutionDecision / getLastSubstitution', () => {
  it('记下选了谁、谁定的、为什么、什么时间', () => {
    const d = recordSubstitutionDecision({
      patientId: 'P1001',
      prescriptionKey: prescriptionSignature(rxA),
      original: '白芍',
      candidate: '赤芍',
      grams: 9,
      decidedBy: '王掌柜',
      reason: '药性相近，存量足',
    });
    expect(d.decidedAt).toBeGreaterThan(0);
    expect(d.decidedBy).toBe('王掌柜');

    const got = getLastSubstitution('P1001', prescriptionSignature(rxA));
    expect(got?.candidate).toBe('赤芍');
    expect(got?.grams).toBe(9);
    expect(got?.reason).toContain('药性相近');
  });

  it('不同病人、不同方子互不串档', () => {
    recordSubstitutionDecision({
      patientId: 'P1001', prescriptionKey: 'K1', original: '白芍', candidate: '赤芍',
      grams: 9, decidedBy: '王掌柜', reason: 'r1',
    });
    expect(getLastSubstitution('P1002', 'K1')).toBeNull();
    expect(getLastSubstitution('P1001', 'K2')).toBeNull();
  });

  it('同一位病人再来抓同一张方子，默认带出上次定的候选', () => {
    const key = prescriptionSignature(rxA);
    seedDecisionsForTest([
      { patientId: 'P1001', prescriptionKey: key, original: '白芍', candidate: '赤芍', grams: 9, decidedBy: '王掌柜', reason: '上次的理由', decidedAt: 123 },
    ]);
    const got = getLastSubstitutionForItem('P1001', key, '白芍');
    expect(got?.candidate).toBe('赤芍');
    expect(getLastSubstitutionForItem('P1001', key, '甘草')).toBeNull();
  });

  it('同一病人同方再定一次，以最近一次为准', () => {
    const key = prescriptionSignature(rxA);
    recordSubstitutionDecision({
      patientId: 'P1001', prescriptionKey: key, original: '白芍', candidate: '赤芍',
      grams: 9, decidedBy: '王掌柜', reason: '第一次',
    });
    recordSubstitutionDecision({
      patientId: 'P1001', prescriptionKey: key, original: '白芍', candidate: '赤芍',
      grams: 9, decidedBy: '李师傅', reason: '第二次改定',
    });
    expect(getLastSubstitution('P1001', key)?.reason).toBe('第二次改定');
  });
});
