import type { GameState, GamePhase, Prescription, WeighResult, LevelConfig, SubstitutionComparison, SubstitutionDecision } from '../types';
import { getLevelConfig } from '../levels';
import { generatePrescription, generateReviewQuestion } from '../prescription';
import { judgeWeight, getWeightStatus } from '../weighing';
import { scoreRound } from '../scoring';
import { getHerbByName } from '../herbs';
import type { HerbMeta } from '../types';
import { generateInventory, deductStock, type Inventory } from '../inventory';
import { compareSubstitution, buildDecisionReason, type CandidateInput } from '../substitution';
import { prescriptionSignature, recordSubstitutionDecision, getLastSubstitutionForItem } from '../substitutionStore';
import { PatientBook } from '../patient';

export interface StartLevelOptions {
  random?: () => number;
  forceShortageFor?: string;
  forceCandidatesShort?: boolean;
  forceReturning?: boolean;
}

export class GameManager {
  state: GameState = {
    level: 1,
    score: 0,
    combo: 0,
    queue: 3,
    satisfaction: 100,
    expired: false,
  };

  phase: GamePhase = 'menu';
  endless = false;
  prescription: Prescription | null = null;
  herbs: HerbMeta[] = [];
  currentWeight = 0;
  zeroOffset = 0;
  targetGrams = 0;
  /** 当前秤上的药（可能是替代药） */
  currentHerb: string | null = null;
  weighed = new Set<string>();
  results: WeighResult[] = [];
  packages: Array<{ herb: string; grams: number; decoct: string; replaces?: string }> = [];
  reviewQuestion: ReturnType<typeof generateReviewQuestion> = null;
  reviewSelected: number | null = null;
  reviewResult: boolean | null = null;
  levelConfig: LevelConfig = getLevelConfig(1);

  // 病人与药柜
  patientBook = new PatientBook();
  patientId = '';
  isReturningPatient = false;
  inventory: Inventory | null = null;
  stock = new Map<string, number>();

  // 替药：原药 -> 候选药 / 实际应抓克数
  substituteCandidate = new Map<string, string>();
  substituteGrams = new Map<string, number>();
  /** 已定的顶替详情（含谁定的、为什么、是否沿用上次） */
  substituteInfo = new Map<string, SubstitutionDecision>();
  /** 开局带出上次决定、但还没正式确认的预览 */
  recalledPreview = new Map<string, SubstitutionDecision>();

  // 缺货比对面板状态
  shortageOriginal: string | null = null;
  comparison: SubstitutionComparison | null = null;
  selectedCandidate: string | null = null;
  recalledDecision: SubstitutionDecision | null = null;

  timeLeft: number | null = null;
  timeUsed = 0;
  lastTick = 0;

  drawerOpen = new Set<string>();
  draggingHerb: string | null = null;
  dragX = 0;
  dragY = 0;
  onScale = false;
  flashingDrawer: string | null = null;
  flashTime = 0;

  startLevel(level: number, endless = false, options?: StartLevelOptions): void {
    this.endless = endless;
    this.state.level = level;
    this.state.expired = false;
    this.levelConfig = getLevelConfig(level);

    const rng = options?.random ?? Math.random;

    // 老病人复诊：翻出他过去抓过的方子；否则新病人新方
    const visit = this.patientBook.pickReturningVisit(rng, options?.forceReturning ? 1 : undefined);
    let rx: Prescription;
    if (visit) {
      rx = { ...visit.prescription, id: `rx-${Date.now()}-${Math.floor(rng() * 1e6)}` };
      this.isReturningPatient = true;
    } else {
      rx = generatePrescription(this.levelConfig, this.patientBook.nextPatientId());
      this.isReturningPatient = false;
    }
    this.prescription = rx;
    this.patientId = rx.patientId;
    this.patientBook.register(rx.patientId, rx);

    this.inventory = generateInventory(rx, this.levelConfig.hasSimilarHerbs, {
      random: rng,
      forceShortageFor: options?.forceShortageFor,
      forceCandidatesShort: options?.forceCandidatesShort,
    });
    this.herbs = this.inventory.herbs;
    this.stock = this.inventory.stock;

    this.resetRoundState();
    this.substituteCandidate = new Map();
    this.substituteGrams = new Map();
    this.substituteInfo = new Map();
    this.recalledPreview = new Map();
    this.shortageOriginal = null;
    this.comparison = null;
    this.selectedCandidate = null;
    this.recalledDecision = null;

    this.phase = 'playing';
    // 开局先查缺货：库存撑不住的药要先定顶替方案才能抓
    this.checkShortages();
  }

  private resetRoundState(): void {
    this.currentWeight = 0;
    this.zeroOffset = 0;
    this.targetGrams = 0;
    this.currentHerb = null;
    this.weighed = new Set();
    this.results = [];
    this.packages = [];
    this.reviewQuestion = null;
    this.reviewSelected = null;
    this.reviewResult = null;
    this.timeLeft = this.levelConfig.timeLimit;
    this.timeUsed = 0;
    this.lastTick = performance.now();
    this.drawerOpen = new Set();
    this.draggingHerb = null;
  }

  tick(now: number): void {
    if (this.phase !== 'playing' && this.phase !== 'weighing') return;
    const dt = (now - this.lastTick) / 1000;
    this.lastTick = now;
    this.timeUsed += dt;

    if (this.timeLeft !== null) {
      this.timeLeft -= dt;
      if (this.timeLeft <= 0) {
        this.timeLeft = 0;
        this.handleTimeout();
      }
    }

    if (this.flashTime > 0) {
      this.flashTime -= dt;
      if (this.flashTime <= 0) this.flashingDrawer = null;
    }
  }

  // ── 缺货与替药 ──────────────────────────────────────────────

  /** 实际要抓的药与克数（可能已换成顶替药） */
  effectiveFor(original: string): { herb: string; grams: number } {
    const candidate = this.substituteCandidate.get(original);
    const grams = this.substituteGrams.get(original);
    if (candidate && grams !== undefined) return { herb: candidate, grams };
    const item = this.prescription?.items.find(i => i.herb === original);
    return { herb: original, grams: item?.grams ?? 0 };
  }

  /** 抽屉上的药名反查它对应方子里的哪味药 */
  originalOf(drawerHerb: string): string | null {
    for (const [original, candidate] of this.substituteCandidate) {
      if (candidate === drawerHerb) return original;
    }
    return this.prescription?.items.some(i => i.herb === drawerHerb) ? drawerHerb : null;
  }

  private checkShortages(): void {
    if (!this.prescription) return;
    const shortItem = this.prescription.items.find(i => {
      if (this.weighed.has(i.herb)) return false;
      const eff = this.effectiveFor(i.herb);
      return (this.stock.get(eff.herb) ?? 0) < eff.grams;
    });
    if (!shortItem) return;

    const original = shortItem.herb;
    const eff = this.effectiveFor(original);
    const meta = getHerbByName(original);
    const candidateInputs: CandidateInput[] = (meta?.similar ?? [])
      .map(name => ({ name, stockGrams: this.stock.get(name) ?? 0 }));

    const comparison = compareSubstitution(original, eff.grams, candidateInputs, this.stock.get(original) ?? 0);
    this.shortageOriginal = original;
    this.comparison = comparison;

    // 同一位病人再抓同一张方子：默认把上次定的候选带出来
    const key = prescriptionSignature(this.prescription.items);
    const recalled = getLastSubstitutionForItem(this.patientId, key, original);
    this.recalledDecision = recalled;
    if (recalled && comparison.candidates.some(c => c.candidate === recalled.candidate && c.sufficient)) {
      this.selectedCandidate = recalled.candidate;
      this.recalledPreview.set(original, recalled);
    } else {
      this.selectedCandidate = comparison.recommended?.candidate ?? null;
    }
    this.phase = 'shortage';
  }

  selectCandidate(name: string): void {
    if (this.phase !== 'shortage' || !this.comparison) return;
    const c = this.comparison.candidates.find(x => x.candidate === name);
    // 存量不够的候选可以看，但不能选来定药
    if (c?.sufficient) {
      this.selectedCandidate = name;
      if (this.recalledDecision?.candidate !== name) {
        // 抓药的人改了主意，不再是"沿用上次"
        if (this.shortageOriginal) this.recalledPreview.delete(this.shortageOriginal);
      } else if (this.shortageOriginal) {
        this.recalledPreview.set(this.shortageOriginal, this.recalledDecision);
      }
    }
  }

  /** 定下顶替药并留档；返回是否成功 */
  confirmShortage(decidedBy: string = '抓药师傅'): boolean {
    if (this.phase !== 'shortage' || !this.comparison || !this.prescription || !this.shortageOriginal) return false;
    const chosen = this.comparison.candidates.find(c => c.candidate === this.selectedCandidate && c.sufficient);
    if (!chosen) return false;

    const original = this.shortageOriginal;
    this.substituteCandidate.set(original, chosen.candidate);
    this.substituteGrams.set(original, chosen.adjustedGrams);

    const recalled = this.recalledDecision?.candidate === chosen.candidate ? this.recalledDecision : null;
    const reason = recalled
      ? `沿用上次（${recalled.decidedBy}）的决定：${recalled.reason}`
      : buildDecisionReason(original, chosen);

    const decision = recordSubstitutionDecision({
      patientId: this.patientId,
      prescriptionKey: prescriptionSignature(this.prescription.items),
      original,
      candidate: chosen.candidate,
      grams: chosen.adjustedGrams,
      decidedBy,
      reason,
    });
    this.substituteInfo.set(original, decision);
    this.recalledPreview.delete(original);

    this.shortageOriginal = null;
    this.comparison = null;
    this.selectedCandidate = null;
    this.recalledDecision = null;
    this.phase = 'playing';
    // 可能还有下一味也缺货
    this.checkShortages();
    return true;
  }

  /** 候选都撑不下来：这方子今天配不齐，送走病人 */
  ackUnfillable(): void {
    this.state.queue--;
    this.state.satisfaction = Math.max(0, this.state.satisfaction - 20);
    this.state.combo = 0;
    if (this.state.queue <= 0 || this.state.satisfaction <= 0) {
      this.phase = 'gameover';
    } else {
      this.startLevel(this.state.level + 1, this.endless);
    }
  }

  // ── 称量 ────────────────────────────────────────────────────

  selectDrawer(herb: string): boolean {
    if (!this.prescription) return false;
    const original = this.originalOf(herb);
    if (!original || this.weighed.has(original)) {
      this.flashingDrawer = herb;
      this.flashTime = 0.5;
      return false;
    }
    const eff = this.effectiveFor(original);
    if ((this.stock.get(eff.herb) ?? 0) < eff.grams) {
      // 库存又不够（理论上开局已拦），闪一下
      this.flashingDrawer = herb;
      this.flashTime = 0.5;
      return false;
    }
    this.drawerOpen.add(herb);
    this.currentHerb = eff.herb;
    this.targetGrams = eff.grams;
    this.currentWeight = 0;
    this.phase = 'weighing';
    return true;
  }

  setWeight(w: number): void {
    this.currentWeight = Math.max(0, w);
  }

  addWeight(delta: number): void {
    this.currentWeight = Math.max(0, parseFloat((this.currentWeight + delta).toFixed(1)));
  }

  tare(): void {
    this.zeroOffset = this.currentWeight;
  }

  confirmWeight(): WeighResult | null {
    if (!this.currentHerb || !this.prescription) return null;
    const dispensedAs = this.currentHerb;
    const original = this.originalOf(dispensedAs) ?? dispensedAs;
    const result = judgeWeight(this.currentWeight, this.targetGrams, this.levelConfig.tolerance);
    result.herb = original;
    result.dispensedAs = dispensedAs;
    this.results.push(result);

    const status = getWeightStatus(result, this.levelConfig.tolerance);
    const timeLimit = this.levelConfig.timeLimit;
    const breakdown = scoreRound(result, this.levelConfig.tolerance, this.state.combo, this.timeUsed, timeLimit);

    if (status === 'fail') {
      this.state.combo = 0;
    } else {
      this.state.combo++;
      this.state.score += breakdown.total;
      this.weighed.add(original);
      const item = this.prescription.items.find(i => i.herb === original);
      if (item) {
        this.packages.push({
          herb: dispensedAs,
          grams: this.currentWeight,
          decoct: item.decoct,
          replaces: dispensedAs !== original ? original : undefined,
        });
        deductStock(this.stock, dispensedAs, this.currentWeight);
      }
    }

    this.drawerOpen.delete(dispensedAs);
    this.currentHerb = null;
    this.currentWeight = 0;
    this.zeroOffset = 0;

    if (this.weighed.size >= this.prescription.items.length) {
      this.startReview();
    } else {
      this.phase = 'playing';
    }

    return result;
  }

  startReview(): void {
    if (!this.prescription) return;
    const targetOverride = new Map<string, number>();
    this.substituteGrams.forEach((grams, original) => targetOverride.set(original, grams));
    this.reviewQuestion = generateReviewQuestion(this.prescription, targetOverride);
    this.reviewSelected = null;
    this.reviewResult = null;
    this.phase = 'review';
  }

  answerReview(answer: number): boolean {
    if (!this.reviewQuestion || this.reviewSelected !== null) return false;
    this.reviewSelected = answer;
    const correct = answer === this.reviewQuestion.correct;
    this.reviewResult = correct;
    if (!correct) {
      this.state.satisfaction -= 10;
      this.state.combo = 0;
    } else {
      this.state.satisfaction = Math.min(100, this.state.satisfaction + 5);
    }
    setTimeout(() => this.finishLevel(), 1500);
    return correct;
  }

  finishLevel(): void {
    const passed = this.results.every(r => r.ok) && this.state.satisfaction > 0;
    if (passed) {
      this.state.queue = Math.min(10, this.state.queue + 1);
    } else {
      this.state.queue--;
      this.state.satisfaction = Math.max(0, this.state.satisfaction - 20);
    }

    if (this.state.queue <= 0 || this.state.satisfaction <= 0) {
      this.phase = 'gameover';
    } else {
      this.phase = 'result';
    }
  }

  nextLevel(): void {
    this.startLevel(this.state.level + 1, this.endless);
  }

  retryLevel(): void {
    this.startLevel(this.state.level, this.endless);
  }

  handleTimeout(): void {
    this.state.queue--;
    this.state.satisfaction -= 15;
    this.state.combo = 0;
    if (this.state.queue <= 0 || this.state.satisfaction <= 0) {
      this.phase = 'gameover';
    } else {
      this.startLevel(this.state.level, this.endless);
    }
  }

  getTimeLeft(): number | null {
    return this.timeLeft;
  }

  isDrawerOpen(herb: string): boolean {
    return this.drawerOpen.has(herb);
  }
}
