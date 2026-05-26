import Phaser from "phaser";
import towersDataRaw from "../data/towers.json";
import type { TowersData } from "../types";
import { Events } from "../types";

interface WaveInfo {
  index: number;
  total: number;
  label: string;
  active: boolean;
}

export class UIScene extends Phaser.Scene {
  private bus!: Phaser.Events.EventEmitter;
  private creditsText!: Phaser.GameObjects.Text;
  private hpText!: Phaser.GameObjects.Text;
  private hpBar!: Phaser.GameObjects.Rectangle;
  private waveText!: Phaser.GameObjects.Text;
  private startButton!: Phaser.GameObjects.Container;
  private startButtonBg!: Phaser.GameObjects.Rectangle;
  private startButtonLabel!: Phaser.GameObjects.Text;
  private buildButtons: Phaser.GameObjects.Container[] = [];
  private gameOverOverlay?: Phaser.GameObjects.Container;
  private currentWave: WaveInfo = { index: 0, total: 10, label: "—", active: false };
  private selectedTowerKey: string | null = null;
  private towersData!: TowersData;

  constructor() {
    super("UIScene");
  }

  create(): void {
    this.towersData = towersDataRaw as TowersData;
    this.bus = this.registry.get("bus") as Phaser.Events.EventEmitter;
    this.gameOverOverlay = undefined;
    this.selectedTowerKey = null;
    this.buildButtons = [];

    const { width, height } = this.scale;

    const topBar = this.add.rectangle(width / 2, 26, width, 52, 0x0f172a, 0.92);
    topBar.setStrokeStyle(1, 0x334155, 1);
    topBar.setDepth(10);

    this.creditsText = this.add
      .text(20, 26, "💰 100", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "22px",
        color: "#fde68a",
      })
      .setOrigin(0, 0.5)
      .setDepth(11);

    this.add
      .rectangle(width / 2, 26, 220, 22, 0x1e293b, 1)
      .setStrokeStyle(1, 0x475569, 1)
      .setDepth(11);
    this.hpBar = this.add
      .rectangle(width / 2 - 109, 26, 218, 18, 0xef4444, 1)
      .setOrigin(0, 0.5)
      .setDepth(12);
    this.hpText = this.add
      .text(width / 2, 26, "🏰 20 / 20", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "16px",
        color: "#fff",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(13);

    this.waveText = this.add
      .text(width - 20, 26, "Vague 0 / 10", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "20px",
        color: "#cbd5e1",
      })
      .setOrigin(1, 0.5)
      .setDepth(11);

    const bottomBar = this.add.rectangle(width / 2, height - 50, width, 100, 0x0f172a, 0.92);
    bottomBar.setStrokeStyle(1, 0x334155, 1);
    bottomBar.setDepth(10);

    this.buildBuildButtons(height);

    this.buildStartButton(width, height);

    this.buildZoomButtons(width, height);

    this.bus.on(Events.CreditsChanged, (n: number) => this.onCredits(n));
    this.bus.on(Events.BaseHpChanged, (info: { hp: number; max: number }) => this.onHp(info));
    this.bus.on(Events.WaveChanged, (info: WaveInfo) => this.onWave(info));
    this.bus.on(Events.WaveCleared, (info: { bonus: number }) => this.flashMessage(`Vague terminée ! +${info.bonus} 💰`, "#4ade80"));
    this.bus.on(Events.GameOver, () => this.showEndOverlay("Défaite", "#ef4444"));
    this.bus.on(Events.GameWon, () => this.showEndOverlay("Victoire !", "#4ade80"));

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.bus.off(Events.CreditsChanged);
      this.bus.off(Events.BaseHpChanged);
      this.bus.off(Events.WaveChanged);
      this.bus.off(Events.WaveCleared);
      this.bus.off(Events.GameOver);
      this.bus.off(Events.GameWon);
    });
  }

  private buildBuildButtons(height: number): void {
    const keys = Object.keys(this.towersData);
    const startX = 20;
    const y = height - 50;
    keys.forEach((key, i) => {
      const cfg = this.towersData[key]!;
      const btn = this.makeTowerButton(startX + i * 170, y, key, cfg.name, cfg.levels[0]!.cost, parseInt(cfg.color, 16));
      this.buildButtons.push(btn);
    });

    const hint = this.add
      .text(20, height - 92, "Sélectionne une tour, clique sur une case grass • ESC pour annuler", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "12px",
        color: "#64748b",
      })
      .setDepth(11);
    hint.setOrigin(0, 0);
  }

  private makeTowerButton(
    x: number,
    y: number,
    key: string,
    label: string,
    cost: number,
    color: number,
  ): Phaser.GameObjects.Container {
    const c = this.add.container(x, y).setDepth(11);
    const bg = this.add.rectangle(0, 0, 160, 70, 0x1e293b, 1).setStrokeStyle(2, color, 1).setOrigin(0, 0.5);
    const swatch = this.add.rectangle(20, 0, 18, 18, color, 1).setStrokeStyle(1, 0x000000, 0.6);
    const title = this.add
      .text(40, -10, label, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "14px",
        color: "#fde68a",
        fontStyle: "bold",
      })
      .setOrigin(0, 0.5);
    const costTxt = this.add
      .text(40, 12, `${cost} 💰`, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "12px",
        color: "#cbd5e1",
      })
      .setOrigin(0, 0.5);
    c.add([bg, swatch, title, costTxt]);

    bg.setInteractive({ useHandCursor: true });
    bg.on("pointerdown", () => this.toggleSelect(key, bg, color));
    return c;
  }

  private toggleSelect(key: string, bg: Phaser.GameObjects.Rectangle, color: number): void {
    if (this.selectedTowerKey === key) {
      this.selectedTowerKey = null;
      this.bus.emit(Events.TowerSelected, null);
      this.refreshButtonStates();
      return;
    }
    this.selectedTowerKey = key;
    this.bus.emit(Events.TowerSelected, key);
    this.refreshButtonStates();
    bg.setFillStyle(0x334155);
    bg.setStrokeStyle(3, color, 1);
  }

  private refreshButtonStates(): void {
    const keys = Object.keys(this.towersData);
    this.buildButtons.forEach((btn, i) => {
      const key = keys[i]!;
      const cfg = this.towersData[key]!;
      const bg = btn.list[0] as Phaser.GameObjects.Rectangle;
      const color = parseInt(cfg.color, 16);
      if (key === this.selectedTowerKey) {
        bg.setFillStyle(0x334155);
        bg.setStrokeStyle(3, color, 1);
      } else {
        bg.setFillStyle(0x1e293b);
        bg.setStrokeStyle(2, color, 1);
      }
    });
  }

  private buildZoomButtons(width: number, height: number): void {
    const x = width - 36;
    const yStart = height / 2 - 60;
    const make = (offset: number, label: string, onClick: () => void) => {
      const c = this.add.container(x, yStart + offset).setDepth(11);
      const bg = this.add.rectangle(0, 0, 44, 44, 0x1e293b, 0.92).setStrokeStyle(2, 0xfde68a, 1);
      const txt = this.add
        .text(0, 0, label, {
          fontFamily: "system-ui, sans-serif",
          fontSize: "22px",
          color: "#fde68a",
          fontStyle: "bold",
        })
        .setOrigin(0.5);
      c.add([bg, txt]);
      bg.setInteractive({ useHandCursor: true });
      bg.on("pointerdown", onClick);
    };
    make(0, "+", () => this.bus.emit(Events.RequestZoomIn));
    make(52, "−", () => this.bus.emit(Events.RequestZoomOut));
    make(104, "⊙", () => this.bus.emit(Events.RequestCenterCamera));
  }

  private buildStartButton(width: number, height: number): void {
    this.startButton = this.add.container(width - 20, height - 50).setDepth(11);
    this.startButtonBg = this.add
      .rectangle(0, 0, 180, 70, 0x065f46, 1)
      .setStrokeStyle(2, 0x4ade80, 1)
      .setOrigin(1, 0.5);
    this.startButtonLabel = this.add
      .text(-90, 0, "Lancer la vague", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "16px",
        color: "#ecfccb",
        fontStyle: "bold",
      })
      .setOrigin(0.5);
    this.startButton.add([this.startButtonBg, this.startButtonLabel]);
    this.startButtonBg.setInteractive({ useHandCursor: true });
    this.startButtonBg.on("pointerdown", () => this.bus.emit(Events.RequestStartWave));
    this.startButtonBg.on("pointerover", () => this.startButtonBg.setFillStyle(0x047857));
    this.startButtonBg.on("pointerout", () => this.startButtonBg.setFillStyle(this.currentWave.active ? 0x334155 : 0x065f46));
  }

  private onCredits(n: number): void {
    this.creditsText.setText(`💰 ${n}`);
  }

  private onHp(info: { hp: number; max: number }): void {
    const ratio = Math.max(0, info.hp / info.max);
    this.hpBar.scaleX = ratio;
    this.hpText.setText(`🏰 ${info.hp} / ${info.max}`);
    if (ratio > 0.5) this.hpBar.setFillStyle(0x4ade80);
    else if (ratio > 0.25) this.hpBar.setFillStyle(0xfacc15);
    else this.hpBar.setFillStyle(0xef4444);
  }

  private onWave(info: WaveInfo): void {
    this.currentWave = info;
    const display = info.index >= info.total ? `Vague ${info.total} / ${info.total}` : `Vague ${info.index + 1} / ${info.total}`;
    this.waveText.setText(`${display} — ${info.label}`);
    if (info.active) {
      this.startButtonLabel.setText("Vague en cours…");
      this.startButtonBg.setFillStyle(0x334155);
      this.startButtonBg.disableInteractive();
    } else if (info.index >= info.total) {
      this.startButtonLabel.setText("Terminé");
      this.startButtonBg.setFillStyle(0x334155);
      this.startButtonBg.disableInteractive();
    } else {
      this.startButtonLabel.setText("Lancer la vague");
      this.startButtonBg.setFillStyle(0x065f46);
      this.startButtonBg.setInteractive({ useHandCursor: true });
    }
  }

  private flashMessage(text: string, color: string): void {
    const t = this.add
      .text(this.scale.width / 2, this.scale.height / 2, text, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "32px",
        color,
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(50)
      .setAlpha(0);
    this.tweens.add({
      targets: t,
      alpha: 1,
      duration: 200,
      yoyo: true,
      hold: 800,
      onComplete: () => t.destroy(),
    });
  }

  private showEndOverlay(text: string, color: string): void {
    if (this.gameOverOverlay) return;
    const c = this.add.container(this.scale.width / 2, this.scale.height / 2).setDepth(100);
    const dim = this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x000000, 0.7);
    const title = this.add
      .text(0, -40, text, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "64px",
        color,
        fontStyle: "bold",
      })
      .setOrigin(0.5);
    const sub = this.add
      .text(0, 30, "Clique pour retourner au menu", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "18px",
        color: "#cbd5e1",
      })
      .setOrigin(0.5);
    c.add([dim, title, sub]);
    this.gameOverOverlay = c;
    dim.setInteractive({ useHandCursor: true });
    dim.on("pointerdown", () => {
      this.scene.stop("GameScene");
      this.scene.stop("UIScene");
      this.scene.start("MenuScene");
    });
  }
}
