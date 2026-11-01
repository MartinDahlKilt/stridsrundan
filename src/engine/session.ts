import { aiDecide } from './ai';
import { runCombat, type CombatGenerator } from './combat';
import type { DecisionAnswer, DecisionRequest } from './requests';
import type { RulesConfig } from './rules';
import { byId, createCombat, type CombatantSetup, type Ctx } from './state';

/**
 * Drives a combat: answers AI decisions itself and stops when a human decision is needed.
 * The answers given so far are recorded, so a fight can be replayed exactly from its seed.
 */
export class CombatSession {
  readonly ctx: Ctx;
  private gen: CombatGenerator;
  private pendingAnswer: DecisionAnswer | undefined = undefined;
  /** Decision waiting for a human, if any. */
  pending: DecisionRequest | null = null;
  readonly answers: DecisionAnswer[] = [];

  constructor(setups: CombatantSetup[], seed: number, rules: Partial<RulesConfig> = {}) {
    this.ctx = createCombat(setups, seed, rules);
    this.gen = runCombat(this.ctx);
  }

  get state() {
    return this.ctx.state;
  }

  /**
   * Run until a human decision is needed or the fight ends.
   * mode 'step' also stops after each completed action.
   */
  advance(mode: 'untilHuman' | 'step' = 'untilHuman', maxSteps = 100000): void {
    if (this.pending) return;
    for (let i = 0; i < maxSteps; i++) {
      const r = this.gen.next(this.pendingAnswer);
      this.pendingAnswer = undefined;
      if (r.done) return;
      const y = r.value;
      if (y.type === 'pause') {
        if (mode === 'step') return;
        continue;
      }
      const actor = byId(this.ctx, y.request.actorId);
      if (actor.controller === 'human') {
        this.pending = y.request;
        return;
      }
      const answer = aiDecide(this.ctx, y.request);
      this.answers.push(answer);
      this.pendingAnswer = answer;
    }
  }

  /** Answer the pending human decision and keep going. */
  answer(a: DecisionAnswer, mode: 'untilHuman' | 'step' = 'untilHuman'): void {
    if (!this.pending) return;
    this.pending = null;
    this.answers.push(a);
    this.pendingAnswer = a;
    this.advance(mode);
  }

  /** Let the AI answer the pending human decision (e.g. "auto-play my turn"). */
  autoAnswer(mode: 'untilHuman' | 'step' = 'untilHuman'): void {
    if (!this.pending) return;
    this.answer(aiDecide(this.ctx, this.pending), mode);
  }
}

/** Run a whole AI-vs-AI fight (headless simulations and tests). */
export function simulate(setups: CombatantSetup[], seed: number, rules: Partial<RulesConfig> = {}): Ctx {
  const s = new CombatSession(
    setups.map((x) => ({ ...x, controller: 'ai' as const })),
    seed,
    rules,
  );
  s.advance();
  return s.ctx;
}
