export type DecoctType = 'normal' | 'first' | 'last';

export interface PrescriptionItem {
  herb: string;
  grams: number;
  decoct: DecoctType;
}

export interface Prescription {
  id: string;
  patientId: string;
  items: PrescriptionItem[];
}

export interface WeighResult {
  herb: string;
  target: number;
  actual: number;
  ok: boolean;
  deltaG: number;
}

export interface GameState {
  level: number;
  score: number;
  combo: number;
  queue: number;
  satisfaction: number;
  expired: boolean;
}

export interface LevelConfig {
  level: number;
  herbCount: number;
  tolerance: number;
  timeLimit: number | null;
  hasSimilarHerbs: boolean;
  requireTare: boolean;
  requireOrganize: boolean;
  enableDecoctSplit: boolean;
}

export interface ScoreBreakdown {
  base: number;
  precisionBonus: number;
  comboBonus: number;
  timePenalty: number;
  total: number;
}

export type GamePhase = 'menu' | 'playing' | 'weighing' | 'review' | 'result' | 'gameover' | 'substitute';

export interface HerbMeta {
  name: string;
  color: string;
  similar?: string[];
}

/** 一味药的药性档案：性（寒热温凉平）、味、功效、单价（元/g） */
export interface HerbProfile {
  herb: string;
  nature: '寒' | '热' | '温' | '凉' | '平';
  flavors: string[];
  effects: string[];
  pricePerGram: number;
}

/** 替代候选：doseFactor 为替代后的用量系数（>1 需增量，<1 需减量） */
export interface SubstituteSpec {
  herb: string;
  doseFactor: number;
}

/** 一个候选药摆在一起比的四条维度 */
export interface SubstituteCandidate {
  herb: string;
  natureScore: number;   // 0..1 与原药的相近度
  stockGrams: number;
  pricePerGram: number;
  doseFactor: number;
}

export interface CandidateScores {
  nature: number;  // 0..100
  stock: number;
  price: number;
  dose: number;
  total: number;
}

export interface CandidateEvaluation {
  candidate: SubstituteCandidate;
  adjustedGrams: number;   // 替代后实际需称的克数
  stockEnough: boolean;
  scores: CandidateScores;
  shortcomings: string[];  // 差在哪一条
  rank: number;
}

export interface SubstitutionPlan {
  originalHerb: string;
  requiredGrams: number;
  evaluations: CandidateEvaluation[];
  recommended: string | null;  // 最合适候选的药名
  feasible: boolean;           // 是否有候选撑得下来
  message: string;
}

/** 落账的替代决定：谁定的、为什么定 */
export interface SubstitutionDecision {
  patientId: string;
  prescriptionKey: string;
  originalHerb: string;
  chosenHerb: string;
  adjustedGrams: number;
  decidedBy: string;
  reason: string;
  decidedAt: number;
}
