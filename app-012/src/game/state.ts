import type { GameState, GamePhase, Prescription, PrescriptionItem, WeighResult, LevelConfig, SubstitutionPlan } from '../types';
import { getLevelConfig } from '../levels';
import { generatePrescription, generateReviewQuestion, prescriptionKey } from '../prescription';
import { judgeWeight, getWeightStatus } from '../weighing';
import { scoreRound } from '../scoring';
import { getRandomHerbs, getHerbByName } from '../herbs';
import { getSubstituteSpecs } from '../herbProfiles';
import { buildCandidates, evaluateSubstitution, makeDecision } from '../substitution';
import { recordDecision, findPriorDecision } from '../decisionLog';
import type { HerbMeta } from '../types';

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
  currentHerb: string | null = null;
  weighed = new Set<string>();
  results: WeighResult[] = [];
  packages: Array<{ herb: string; grams: number; decoct: string }> = [];
  reviewQuestion: ReturnType<typeof generateReviewQuestion> = null;
  reviewSelected: number | null = null;
  reviewResult: boolean | null = null;
  levelConfig: LevelConfig = getLevelConfig(1);

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

  /** 药柜存量（g） */
  inventory = new Map<string, number>();
  /** 待处理的替代方案队列（一张方子可能缺好几味） */
  substitutionQueue: SubstitutionPlan[] = [];
  currentPlan: SubstitutionPlan | null = null;
  selectedSubstitute: string | null = null;
  /** 这位病人这张方子上次定的候选，默认带出来 */
  priorChoice: string | null = null;
  currentRxKey = '';
  decidedBy = '当班药师';
  /** 老病人回访概率：拿着同一张方子再来抓 */
  revisitChance = 0.35;
  /** 最近抓过药的病人名册，回访从这里抽 */
  recentPatients: Array<{ patientId: string; items: PrescriptionItem[] }> = [];

  startLevel(level: number, endless = false): void {
    this.endless = endless;
    this.state.level = level;
    this.state.expired = false;
    this.levelConfig = getLevelConfig(level);

    // 一定概率：名册里的老病人拿着同一张方子再来抓药
    if (this.recentPatients.length > 0 && Math.random() < this.revisitChance) {
      const p = this.recentPatients[Math.floor(Math.random() * this.recentPatients.length)];
      this.prescription = {
        id: `rx-revisit-${Date.now()}`,
        patientId: p.patientId,
        items: p.items.map(i => ({ ...i })),
      };
    } else {
      this.prescription = generatePrescription(this.levelConfig);
      this.recentPatients = this.recentPatients.filter(r => r.patientId !== this.prescription!.patientId);
      this.recentPatients.push({
        patientId: this.prescription.patientId,
        items: this.prescription.items.map(i => ({ ...i })),
      });
      if (this.recentPatients.length > 5) this.recentPatients.shift();
    }
    this.currentRxKey = prescriptionKey(this.prescription);

    // 药柜抽屉：处方上的药必须找得到，再补些干扰项
    const cabinetCount = this.levelConfig.herbCount + (this.levelConfig.hasSimilarHerbs ? 2 : 0);
    const fillers = getRandomHerbs(cabinetCount, this.levelConfig.hasSimilarHerbs);
    const merged: HerbMeta[] = [];
    for (const item of this.prescription.items) {
      const meta = getHerbByName(item.herb);
      if (meta && !merged.some(m => m.name === meta.name)) merged.push(meta);
    }
    for (const h of fillers) {
      if (!merged.some(m => m.name === h.name)) merged.push(h);
    }
    this.herbs = merged;
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

    this.setupInventory();
    this.setupSubstitutions();

    if (this.substitutionQueue.length > 0) {
      this.advanceSubstitution();
    } else {
      this.currentPlan = null;
      this.phase = 'playing';
    }
  }

  /** 盘点柜存：每味柜中药 20~89g，缺货的药单独压到不够抓 */
  private setupInventory(): void {
    this.inventory = new Map();
    for (const h of this.herbs) {
      this.inventory.set(h.name, 20 + Math.floor(Math.random() * 70));
    }
    if (!this.prescription) return;

    const shortHerbs = new Set<string>();
    // 老病人回访：上次定过替代的那味药，柜里这次还是不够
    for (const item of this.prescription.items) {
      if (findPriorDecision(this.prescription.patientId, this.currentRxKey, item.herb)) {
        shortHerbs.add(item.herb);
      }
    }
    // 否则六成概率随机挑一味有替代表的药缺货
    if (shortHerbs.size === 0 && Math.random() < 0.6) {
      const substitutable = this.prescription.items.filter(i => getSubstituteSpecs(i.herb).length > 0);
      if (substitutable.length > 0) {
        shortHerbs.add(substitutable[Math.floor(Math.random() * substitutable.length)].herb);
      }
    }
    for (const herb of shortHerbs) {
      const item = this.prescription.items.find(i => i.herb === herb);
      if (item) {
        this.inventory.set(herb, Math.floor(item.grams * (0.1 + Math.random() * 0.4)));
      }
    }
    // 候选药也摆进柜子、给个存量（有的候选存量也不够，会被排到后面）
    for (const herb of shortHerbs) {
      for (const spec of getSubstituteSpecs(herb)) {
        if (!this.inventory.has(spec.herb)) {
          this.inventory.set(spec.herb, Math.floor(Math.random() * 90));
        }
        if (!this.herbs.some(h => h.name === spec.herb)) {
          const meta = getHerbByName(spec.herb);
          if (meta) this.herbs.push(meta);
        }
      }
    }
  }

  /** 对照方子和柜存，把不够的味逐一建成替代方案 */
  private setupSubstitutions(): void {
    this.substitutionQueue = [];
    if (!this.prescription) return;
    for (const item of this.prescription.items) {
      const stock = this.inventory.get(item.herb) ?? 0;
      if (stock < item.grams) {
        const plan = evaluateSubstitution(item.herb, item.grams, buildCandidates(item.herb, this.inventory));
        this.substitutionQueue.push(plan);
      }
    }
  }

  private advanceSubstitution(): void {
    this.currentPlan = this.substitutionQueue.shift() ?? null;
    if (!this.currentPlan || !this.prescription) {
      this.currentPlan = null;
      this.selectedSubstitute = null;
      this.priorChoice = null;
      this.phase = 'playing';
      return;
    }
    // 同一位病人同一张方子：默认带出上次定的候选
    const prior = findPriorDecision(this.prescription.patientId, this.currentRxKey, this.currentPlan.originalHerb);
    this.priorChoice = prior && this.currentPlan.evaluations.some(e => e.candidate.herb === prior.chosenHerb && e.stockEnough)
      ? prior.chosenHerb
      : null;
    this.selectedSubstitute = this.priorChoice ?? this.currentPlan.recommended;
    this.phase = 'substitute';
  }

  selectSubstitute(herb: string): boolean {
    if (!this.currentPlan) return false;
    const evaluation = this.currentPlan.evaluations.find(e => e.candidate.herb === herb);
    if (!evaluation || !evaluation.stockEnough) return false;
    this.selectedSubstitute = herb;
    return true;
  }

  /** 定下替代：落账（谁定的、为什么定），改方，推进下一味缺的药 */
  confirmSubstitution(): boolean {
    if (!this.currentPlan || !this.prescription || !this.selectedSubstitute) return false;
    const plan = this.currentPlan;
    const evaluation = plan.evaluations.find(e => e.candidate.herb === this.selectedSubstitute);
    if (!evaluation || !evaluation.stockEnough) return false;

    const reused = this.priorChoice !== null && this.priorChoice === evaluation.candidate.herb;
    const decision = makeDecision(
      this.prescription.patientId,
      this.currentRxKey,
      plan,
      evaluation.candidate.herb,
      this.decidedBy,
      reused,
    );
    recordDecision(decision);

    const item = this.prescription.items.find(i => i.herb === plan.originalHerb);
    if (item) {
      item.herb = evaluation.candidate.herb;
      item.grams = Math.round(evaluation.adjustedGrams);
    }

    this.advanceSubstitution();
    return true;
  }

  /** 几个候选都撑不下来：明确告诉抓药的人这方子今天配不齐，病人离开 */
  declareUnfillable(): void {
    this.substitutionQueue = [];
    this.currentPlan = null;
    this.selectedSubstitute = null;
    this.priorChoice = null;
    this.state.queue--;
    this.state.satisfaction -= 15;
    this.state.combo = 0;
    if (this.state.queue <= 0 || this.state.satisfaction <= 0) {
      this.phase = 'gameover';
    } else {
      this.startLevel(this.state.level, this.endless);
    }
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

  selectDrawer(herb: string): boolean {
    if (!this.prescription) return false;
    const needed = this.prescription.items.find(i => i.herb === herb && !this.weighed.has(i.herb));
    if (!needed) {
      this.flashingDrawer = herb;
      this.flashTime = 0.5;
      return false;
    }
    this.drawerOpen.add(herb);
    this.currentHerb = herb;
    this.targetGrams = needed.grams;
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
    const result = judgeWeight(this.currentWeight, this.targetGrams, this.levelConfig.tolerance);
    result.herb = this.currentHerb;
    this.results.push(result);

    const status = getWeightStatus(result, this.levelConfig.tolerance);
    const timeLimit = this.levelConfig.timeLimit;
    const breakdown = scoreRound(result, this.levelConfig.tolerance, this.state.combo, this.timeUsed, timeLimit);

    if (status === 'fail') {
      this.state.combo = 0;
    } else {
      this.state.combo++;
      this.state.score += breakdown.total;
      this.weighed.add(this.currentHerb);
      const item = this.prescription.items.find(i => i.herb === this.currentHerb);
      if (item) {
        this.packages.push({ herb: item.herb, grams: this.currentWeight, decoct: item.decoct });
      }
      const stock = this.inventory.get(this.currentHerb);
      if (stock !== undefined) {
        this.inventory.set(this.currentHerb, Math.max(0, stock - this.currentWeight));
      }
    }

    this.drawerOpen.delete(this.currentHerb);
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
    this.reviewQuestion = generateReviewQuestion(this.prescription);
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
