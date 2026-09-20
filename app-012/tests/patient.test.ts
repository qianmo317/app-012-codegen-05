import { describe, it, expect } from 'vitest';
import { PatientBook } from '../src/patient';
import type { Prescription } from '../src/types';

function rx(id: string, patientId: string): Prescription {
  return { id, patientId, items: [{ herb: '甘草', grams: 10, decoct: 'normal' }] };
}

describe('PatientBook', () => {
  it('新病人编号依次递增', () => {
    const book = new PatientBook();
    expect(book.nextPatientId()).toBe('P1001');
    expect(book.nextPatientId()).toBe('P1002');
    expect(book.hasHistory('P1001')).toBe(false);
  });

  it('登记后能翻出病史', () => {
    const book = new PatientBook();
    const id = book.nextPatientId();
    book.register(id, rx('rx-1', id));
    expect(book.hasHistory(id)).toBe(true);
    expect(book.history(id)).toHaveLength(1);
  });

  it('没有老病人时复诊抽取为空', () => {
    const book = new PatientBook();
    expect(book.pickReturningVisit(() => 0)).toBeNull();
  });

  it('抽中复诊时带回该病人上次的方子（克隆，不共享引用）', () => {
    const book = new PatientBook();
    const id = book.nextPatientId();
    book.register(id, rx('rx-1', id));
    const visit = book.pickReturningVisit(() => 0, 0.5);
    expect(visit).not.toBeNull();
    expect(visit!.patientId).toBe(id);
    expect(visit!.prescription.items[0].herb).toBe('甘草');
    visit!.prescription.items[0].grams = 999;
    expect(book.history(id)[0].items[0].grams).toBe(10);
  });

  it('概率未抽中时返回 null', () => {
    const book = new PatientBook();
    const id = book.nextPatientId();
    book.register(id, rx('rx-1', id));
    expect(book.pickReturningVisit(() => 0.9, 0.5)).toBeNull();
  });
});
