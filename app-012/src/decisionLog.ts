import type { SubstitutionDecision } from './types';

const DECISION_KEY = 'apothecary-substitutions-v1';
const MAX_RECORDS = 200;

export function loadDecisions(): SubstitutionDecision[] {
  try {
    const raw = localStorage.getItem(DECISION_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (Array.isArray(data)) return data as SubstitutionDecision[];
    }
  } catch {
    // ignore parse error
  }
  return [];
}

export function recordDecision(decision: SubstitutionDecision): void {
  try {
    const all = loadDecisions();
    all.push(decision);
    while (all.length > MAX_RECORDS) all.shift();
    localStorage.setItem(DECISION_KEY, JSON.stringify(all));
  } catch {
    // ignore storage error
  }
}

/**
 * 查同一位病人、同一张方子、同一味原药上次定的替代。
 * 返回最近的一条，没有则 null。
 */
export function findPriorDecision(
  patientId: string,
  prescriptionKey: string,
  originalHerb: string,
): SubstitutionDecision | null {
  const all = loadDecisions();
  for (let i = all.length - 1; i >= 0; i--) {
    const d = all[i];
    if (d.patientId === patientId && d.prescriptionKey === prescriptionKey && d.originalHerb === originalHerb) {
      return d;
    }
  }
  return null;
}

export function clearDecisions(): void {
  try {
    localStorage.removeItem(DECISION_KEY);
  } catch {
    // ignore
  }
}
