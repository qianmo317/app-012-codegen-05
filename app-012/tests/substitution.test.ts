import { describe, it, expect } from 'vitest';
import { herbSimilarity, adjustedDose, compareSubstitution, describeDrawbacks, buildDecisionReason, SCORE_WEIGHTS } from '../src/substitution';
import { getDoseRatio } from '../src/herbProperties';

describe('herbSimilarity', () => {
  it('同一味药相似度为 100', () => {
    expect(herbSimilarity('白芍', '白芍')).toBe(100);
  });

  it('性味归经功效都接近的药对相似度较高', () => {
    expect(herbSimilarity('黄芩', '黄连')).toBeGreaterThanOrEqual(50);
    expect(herbSimilarity('陈皮', '青皮')).toBeGreaterThanOrEqual(40);
  });

  it('药性差得远的相似度更低', () => {
    const close = herbSimilarity('生地', '熟地');
    const far = herbSimilarity('薄荷', '五味子');
    expect(close).toBeGreaterThan(far);
  });

  it('查无档案的药相似度为 0', () => {
    expect(herbSimilarity('白芍', '不存在的药')).toBe(0);
  });
});

describe('adjustedDose', () => {
  it('未收录换算表的药对默认等量顶替', () => {
    expect(getDoseRatio('黄芪', '甘草')).toBe(1);
    expect(adjustedDose('黄芪', '甘草', 10)).toBe(10);
  });

  it('按经验换算表折算并四舍五入到整克', () => {
    expect(getDoseRatio('生地', '熟地')).toBeCloseTo(1.3);
    expect(adjustedDose('生地', '熟地', 10)).toBe(13);
    expect(adjustedDose('熟地', '生地', 10)).toBe(7);
    expect(adjustedDose('苍术', '白术', 15)).toBe(12);
  });
});

describe('compareSubstitution', () => {
  it('按药性/存量/单价/用量综合打分并推荐最高分', () => {
    const cmp = compareSubstitution('白芍', 10, [
      { name: '赤芍', stockGrams: 40 },
    ]);
    expect(cmp.canFulfill).toBe(true);
    expect(cmp.recommended?.candidate).toBe('赤芍');
    expect(cmp.recommended?.adjustedGrams).toBe(9);
    const r = cmp.recommended!;
    const expectScore =
      r.similarity * SCORE_WEIGHTS.similarity +
      r.scoreParts.stock * SCORE_WEIGHTS.stock +
      r.scoreParts.price * SCORE_WEIGHTS.price +
      r.scoreParts.dose * SCORE_WEIGHTS.dose;
    expect(r.score).toBeCloseTo(Math.round(expectScore * 10) / 10);
  });

  it('存量不够的候选直接排到后面并说明原因', () => {
    const cmp = compareSubstitution('陈皮', 20, [
      { name: '青皮', stockGrams: 5 },
    ]);
    expect(cmp.canFulfill).toBe(false);
    expect(cmp.recommended).toBeNull();
    expect(cmp.candidates[0].sufficient).toBe(false);
    expect(cmp.candidates[0].drawbacks.join('')).toContain('存量');
    expect(cmp.message).toContain('今天配不齐');
    expect(cmp.message).toContain('青皮');
  });

  it('够的候选排在不够的前面，即使不够的药性更近', () => {
    // 白芍原药，唯一候选赤芍缺货
    const cmp = compareSubstitution('白芍', 15, [
      { name: '赤芍', stockGrams: 2 },
    ]);
    expect(cmp.candidates[0].candidate).toBe('赤芍');
    expect(cmp.candidates[0].sufficient).toBe(false);
    expect(cmp.canFulfill).toBe(false);
  });

  it('多个够量候选时选综合得分最高的', () => {
    const cmp = compareSubstitution('黄芩', 10, [
      { name: '黄连', stockGrams: 100 },
      { name: '黄柏', stockGrams: 100 },
    ]);
    expect(cmp.canFulfill).toBe(true);
    const byScore = [...cmp.candidates].sort((a, b) => b.score - a.score);
    expect(cmp.recommended?.candidate).toBe(byScore[0].candidate);
    // 落选者要写清差在哪一条
    const loser = cmp.candidates.find(c => c.candidate !== cmp.recommended!.candidate)!;
    expect(loser.drawbacks.length).toBeGreaterThan(0);
  });

  it('没有候选时明确告诉抓药人无法顶替', () => {
    const cmp = compareSubstitution('甘草', 10, [], 3);
    expect(cmp.canFulfill).toBe(false);
    expect(cmp.message).toContain('甘草');
    expect(cmp.message).toContain('没有药性相近的药');
  });

  it('用量增减在候选结果中体现', () => {
    const cmp = compareSubstitution('生地', 10, [{ name: '熟地', stockGrams: 30 }]);
    const c = cmp.candidates[0];
    expect(c.doseChangePct).toBe(30);
    expect(c.adjustedGrams).toBe(13);
  });

  it('药费 = 单价折算后的总价', () => {
    const cmp = compareSubstitution('黄芩', 10, [{ name: '黄连', stockGrams: 30 }]);
    const c = cmp.candidates[0];
    expect(c.totalPrice).toBeCloseTo(c.pricePer10g / 10 * c.adjustedGrams);
  });
});

describe('describeDrawbacks / buildDecisionReason', () => {
  it('选中候选没有缺点，未选候选给出对比', () => {
    const cmp = compareSubstitution('黄芩', 10, [
      { name: '黄连', stockGrams: 80 },
      { name: '黄柏', stockGrams: 80 },
    ]);
    const rec = cmp.recommended!;
    expect(describeDrawbacks(rec, rec)).toEqual([]);
    const other = cmp.candidates.find(c => c.candidate !== rec.candidate)!;
    const drawbacks = describeDrawbacks(other, rec);
    expect(drawbacks.length).toBeGreaterThan(0);
  });

  it('定药理由包含药性、存量、用量、药费', () => {
    const cmp = compareSubstitution('生地', 10, [{ name: '熟地', stockGrams: 40 }]);
    const reason = buildDecisionReason('生地', cmp.recommended!);
    expect(reason).toContain('药性相似度');
    expect(reason).toContain('存量');
    expect(reason).toContain('加30%');
    expect(reason).toContain('文');
  });
});
