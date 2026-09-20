import { describe, it, expect } from 'vitest';
import { generateInventory, isStockSufficient, deductStock } from '../src/inventory';
import { getLevelConfig } from '../src/levels';
import { generatePrescription } from '../src/prescription';
import { HERBS } from '../src/herbs';

function rx(herb: string, grams = 15) {
  return { id: 'rx-test', patientId: 'P1001', items: [{ herb, grams, decoct: 'normal' as const }] };
}

describe('generateInventory', () => {
  it('原方药和相近候选都在柜里，药柜最多 36 屉且不重复', () => {
    const inv = generateInventory(rx('白芍'), true);
    const names = inv.herbs.map(h => h.name);
    expect(names).toContain('白芍');
    expect(names).toContain('赤芍');
    expect(inv.herbs.length).toBe(Math.min(36, HERBS.length));
    expect(new Set(names).size).toBe(names.length);
  });

  it('强制缺货时原药只剩零头，候选存量充足', () => {
    const inv = generateInventory(rx('陈皮', 20), true, { forceShortageFor: '陈皮' });
    expect(inv.stock.get('陈皮')).toBeLessThan(20);
    expect(inv.stock.get('青皮')).toBeGreaterThanOrEqual(20);
  });

  it('候选也被强制缺货时候选只剩零头', () => {
    const inv = generateInventory(rx('陈皮', 20), true, { forceShortageFor: '陈皮', forceCandidatesShort: true });
    expect(inv.stock.get('青皮')).toBeLessThan(20);
  });

  it('无相近药关卡不产生缺货', () => {
    const config = getLevelConfig(1);
    for (let i = 0; i < 30; i++) {
      const p = generatePrescription(config);
      const inv = generateInventory(p, false);
      for (const item of p.items) {
        expect(inv.stock.get(item.herb) ?? 0).toBeGreaterThanOrEqual(item.grams);
      }
    }
  });

  it('所有柜内药都有存量且为非负数', () => {
    const inv = generateInventory(rx('甘草'), true);
    inv.herbs.forEach(h => {
      const s = inv.stock.get(h.name);
      expect(s).toBeGreaterThanOrEqual(0);
      void h;
    });
    expect(inv.herbs.length).toBeLessThanOrEqual(HERBS.length);
  });
});

describe('isStockSufficient / deductStock', () => {
  it('按克数判断存量是否够', () => {
    const stock = new Map([['甘草', 9]]);
    expect(isStockSufficient(stock, '甘草', 10)).toBe(false);
    expect(isStockSufficient(stock, '甘草', 9)).toBe(true);
    expect(isStockSufficient(stock, '没有的药', 1)).toBe(false);
  });

  it('扣库存不会扣成负数，且返回最新存量', () => {
    const stock = new Map([['甘草', 10]]);
    expect(deductStock(stock, '甘草', 6)).toBe(4);
    expect(deductStock(stock, '甘草', 50)).toBe(0);
  });
});
