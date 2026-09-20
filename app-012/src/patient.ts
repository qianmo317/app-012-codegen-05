import type { Prescription } from './types';

export interface ReturningVisit {
  patientId: string;
  prescription: Prescription;
}

type Rng = () => number;

function clonePrescription(rx: Prescription): Prescription {
  return {
    id: rx.id,
    patientId: rx.patientId,
    items: rx.items.map(i => ({ ...i })),
  };
}

/**
 * 病人名册：记住每位来过的病人和他抓过的方子。
 * 病人编号在 P1001~P1020 之间轮转；老病人再上门时能翻出上次的方子。
 */
export class PatientBook {
  private counter = 1000;
  private readonly maxId = 1020;
  private records = new Map<string, Prescription[]>();

  nextPatientId(): string {
    this.counter++;
    if (this.counter > this.maxId) this.counter = 1001;
    return `P${this.counter}`;
  }

  /** 登记一次抓药（同方多次抓会都留着，默认带出最近一次） */
  register(patientId: string, rx: Prescription): void {
    const list = this.records.get(patientId) ?? [];
    list.push(clonePrescription(rx));
    if (list.length > 10) list.shift();
    this.records.set(patientId, list);
  }

  /** 这位病人以前抓过的方子（最近的在前） */
  history(patientId: string): Prescription[] {
    return (this.records.get(patientId) ?? []).slice().reverse();
  }

  hasHistory(patientId: string): boolean {
    return (this.records.get(patientId)?.length ?? 0) > 0;
  }

  /**
   * 按复诊概率抽一位老病人，带回他过去的一张方子。
   * 返回的处方是克隆，可安全用于本次抓药。
   */
  pickReturningVisit(rng: Rng = Math.random, probability = 0.35): ReturningVisit | null {
    const ids = [...this.records.keys()].filter(id => this.records.get(id)!.length > 0);
    if (ids.length === 0 || rng() >= probability) return null;
    const patientId = ids[Math.floor(rng() * ids.length)];
    const list = this.records.get(patientId)!;
    const rx = list[list.length - 1];
    return { patientId, prescription: clonePrescription(rx) };
  }
}
