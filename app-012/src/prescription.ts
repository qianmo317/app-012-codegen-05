import type { Prescription, PrescriptionItem, LevelConfig } from './types';
import { getRandomHerbs } from './herbs';

let prescriptionIdCounter = 0;

export function generatePrescription(config: LevelConfig, patientId: string = 'P1001'): Prescription {
  const herbs = getRandomHerbs(config.herbCount, config.hasSimilarHerbs);
  const items: PrescriptionItem[] = herbs.map(herb => {
    const grams = Math.floor(Math.random() * 20) + 5;
    let decoct: 'normal' | 'first' | 'last' = 'normal';
    if (config.enableDecoctSplit) {
      const r = Math.random();
      if (r < 0.15) decoct = 'first';
      else if (r < 0.3) decoct = 'last';
    }
    return { herb: herb.name, grams, decoct };
  });

  return {
    id: `rx-${++prescriptionIdCounter}-${Date.now()}`,
    patientId,
    items
  };
}

export function generateReviewQuestion(prescription: Prescription, targetOverride?: Map<string, number>): { herb: string; options: number[]; correct: number } | null {
  if (prescription.items.length === 0) return null;
  const item = prescription.items[Math.floor(Math.random() * prescription.items.length)];
  const correct = targetOverride?.get(item.herb) ?? item.grams;
  const options = new Set<number>([correct]);
  while (options.size < 3) {
    const delta = Math.floor(Math.random() * 10) - 5;
    if (delta !== 0) options.add(Math.max(1, correct + delta));
  }
  return { herb: item.herb, options: Array.from(options).sort(() => Math.random() - 0.5), correct };
}
