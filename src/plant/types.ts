import type { Store, PlantState, Pricing } from './store';
import type { StepId } from './catalog';
import type { PlaqueEngraver } from '../components/plaque';

export interface Ctx {
  root: HTMLElement;
  store: Store;
  /** env.motionAllowed() */
  motion(): boolean;
  /** 1, or 1.5 in memorial mode (everything quieter and slower) */
  speed(): number;
  memorial(): boolean;
  mobile(): boolean;
  pricing(s?: PlantState): Pricing;
  steps(): StepId[];
  go(step: StepId, opts?: { focus?: boolean }): void;
  next(): void;
  prev(): void;
  announce(msg: string): void;
  engraver(): PlaqueEngraver;
  /** move the single live plaque canvas into a slot */
  placePlaque(): void;
  /** run the mock payment and show the certificate */
  purchase(details: BuyerDetails): Promise<void>;
  /** main product label ("עץ זית", "ספסל", …) */
  mainLabel(s?: PlantState): string;
}

export interface StepView {
  id: StepId;
  el: HTMLElement;
  /** called after the step became visible */
  enter?(): void;
  leave?(): void;
  update?(s: PlantState, prev: PlantState): void;
  /** return an error message to block "next" */
  validate?(): string | null;
  /** element that receives the plaque canvas on phones (plaque step only) */
  plaqueSlot?: HTMLElement;
  /** label of the bar button on this step (default "הבא") */
  cta?(): { label: string; fruit?: boolean } | null;
  /** primary action instead of next() (checkout pays) */
  primary?(): void;
}

export interface BuyerDetails { name: string; phone: string; email: string; method: PayMethod }
export type PayMethod = 'bit' | 'apple' | 'google' | 'card';
