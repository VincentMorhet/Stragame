import Phaser from "phaser";
import { Events } from "../types";

export class EconomyManager {
  private credits: number;
  private bus: Phaser.Events.EventEmitter;

  constructor(bus: Phaser.Events.EventEmitter, startingCredits: number) {
    this.bus = bus;
    this.credits = startingCredits;
  }

  get balance(): number {
    return this.credits;
  }

  emitInitial(): void {
    this.bus.emit(Events.CreditsChanged, this.credits);
  }

  canAfford(cost: number): boolean {
    return this.credits >= cost;
  }

  spend(cost: number): boolean {
    if (!this.canAfford(cost)) return false;
    this.credits -= cost;
    this.bus.emit(Events.CreditsChanged, this.credits);
    return true;
  }

  award(amount: number): void {
    this.credits += amount;
    this.bus.emit(Events.CreditsChanged, this.credits);
  }
}
