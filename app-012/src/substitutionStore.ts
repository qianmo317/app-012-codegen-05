import type { PrescriptionItem, SubstitutionDecision } from './types';

const STORE_KEY = 'apothecary-substitutions-v1';

type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

type DecisionMap = Record<string, SubstitutionDecision>;

/** 存储键：病人 + 方内每味药（药名/克数/煎法）排序后的稳定签名 */
function decisionMapKey(patientId: string, prescriptionKey: string): string {
  return `${patientId}::${prescriptionKey}`;
}

function getStorage(): StorageLike | null {
  try {
    if (typeof localStorage !== 'undefined') return localStorage;
  } catch {
    // 测试环境（node）下没有 localStorage
  }
  return null;
}

function loadMap(): DecisionMap {
  const storage = getStorage();
  if (!storage) return memoryFallback;
  try {
    const raw = storage.getItem(STORE_KEY);
    if (raw) return JSON.parse(raw) as DecisionMap;
  } catch {
    // 存档损坏时视为空，不阻塞抓药
  }
  return {};
}

function persist(map: DecisionMap): void {
  const storage = getStorage();
  try {
    if (storage) storage.setItem(STORE_KEY, JSON.stringify(map));
  } catch {
    // 写入失败（隐私模式/配额）时仅留在内存
  }
  memoryFallback = map;
}

// node 环境或写入失败时的进程内兜底
let memoryFallback: DecisionMap = {};

/**
 * 同一张方子的签名：把药名+克数+煎法排序后拼接。
 * 只认方子内容，不认处方流水号——同一位病人再抓同一张方子能对上。
 */
export function prescriptionSignature(items: Pick<PrescriptionItem, 'herb' | 'grams' | 'decoct'>[]): string {
  return items
    .map(i => `${i.herb}#${i.grams}#${i.decoct}`)
    .sort()
    .join('|');
}

/** 记一笔：最终用了哪个候选顶哪味药、谁定的、为什么 */
export function recordSubstitutionDecision(decision: Omit<SubstitutionDecision, 'decidedAt'> & { decidedAt?: number }): SubstitutionDecision {
  const full: SubstitutionDecision = { ...decision, decidedAt: decision.decidedAt ?? Date.now() };
  const map = loadMap();
  map[decisionMapKey(full.patientId, full.prescriptionKey)] = full;
  persist(map);
  return full;
}

/** 同一位病人再来抓同一张方子时，默认带出上次定的那个候选 */
export function getLastSubstitution(patientId: string, prescriptionKey: string): SubstitutionDecision | null {
  const map = loadMap();
  return map[decisionMapKey(patientId, prescriptionKey)] ?? null;
}

/** 查某味原药上次顶替用的是哪味（给处方上的每味药逐个找） */
export function getLastSubstitutionForItem(
  patientId: string,
  prescriptionKey: string,
  original: string,
): SubstitutionDecision | null {
  const d = getLastSubstitution(patientId, prescriptionKey);
  return d && d.original === original ? d : null;
}

export function clearSubstitutionHistory(): void {
  memoryFallback = {};
  persist({});
}

/** 测试辅助：直接喂一份存档 */
export function seedDecisionsForTest(decisions: SubstitutionDecision[]): void {
  const map: DecisionMap = {};
  for (const d of decisions) map[decisionMapKey(d.patientId, d.prescriptionKey)] = d;
  persist(map);
}
