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
  dispensedAs: string;
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

export type GamePhase = 'menu' | 'playing' | 'shortage' | 'weighing' | 'review' | 'result' | 'gameover' | 'unfillable';

export interface HerbMeta {
  name: string;
  color: string;
  similar?: string[];
}

/** 药性：四气五味、归经、功效标签 */
export interface HerbProperties {
  name: string;
  /** 四气：寒/微寒/凉/平/微温/温/热 */
  nature: '寒' | '微寒' | '凉' | '平' | '微温' | '温' | '热';
  /** 五味（可多选）：酸苦甘辛咸淡涩 */
  flavors: string[];
  /** 归经 */
  meridians: string[];
  /** 功效标签，用于衡量药性相近程度 */
  effects: string[];
  /** 单价（文/10g，相对价格） */
  pricePer10g: number;
}

/** 有向的用量换算：用 candidate 替代 original 时，剂量倍数（来自老药师经验） */
export type DoseRatioMap = Record<string, number>;

export interface SubstitutionCandidate {
  /** 原处方药名 */
  original: string;
  /** 候选药名 */
  candidate: string;
  /** 药性相似度 0~100 */
  similarity: number;
  /** 现有存量（克） */
  stockGrams: number;
  /** 原方用量（克） */
  requiredGrams: number;
  /** 替代后建议用量（克） */
  adjustedGrams: number;
  /** 用量增减百分比，正数=需加量 */
  doseChangePct: number;
  /** 单价（文/10g） */
  pricePer10g: number;
  /** 这剂药的药费（文） */
  totalPrice: number;
  /** 存量是否够顶这张方子 */
  sufficient: boolean;
  /** 综合得分 0~100 */
  score: number;
  /** 各维度得分明细 0~100 */
  scoreParts: {
    similarity: number;
    stock: number;
    price: number;
    dose: number;
  };
  /** 与选中药相比，差在哪几条 */
  drawbacks: string[];
}

export interface SubstitutionComparison {
  original: string;
  requiredGrams: number;
  stockGrams: number;
  candidates: SubstitutionCandidate[];
  /** 推荐候选；没有一个存量够时为 null（方子今天配不齐） */
  recommended: SubstitutionCandidate | null;
  canFulfill: boolean;
  /** 配不齐时给抓药人的话 */
  message: string;
}

/** 一次替用决定的留档 */
export interface SubstitutionDecision {
  patientId: string;
  /** 方子签名（药名+克数+煎法排序生成），用于识别"同一张方子" */
  prescriptionKey: string;
  original: string;
  candidate: string;
  grams: number;
  decidedBy: string;
  reason: string;
  decidedAt: number;
}
