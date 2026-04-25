import Phaser from "phaser";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("BootScene");
  }

  create(): void {
    if (!this.registry.get("bus")) {
      this.registry.set("bus", new Phaser.Events.EventEmitter());
    }
    this.scene.start("MenuScene");
  }
}
