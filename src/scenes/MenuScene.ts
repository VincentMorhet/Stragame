import Phaser from "phaser";

export class MenuScene extends Phaser.Scene {
  constructor() {
    super("MenuScene");
  }

  create(): void {
    const { width, height } = this.scale;

    this.add
      .text(width / 2, height / 2 - 140, "STRAGAME", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "72px",
        color: "#fde68a",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height / 2 - 70, "Tower Defense Isométrique", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "22px",
        color: "#cbd5e1",
      })
      .setOrigin(0.5);

    this.makeButton(width / 2, height / 2 + 20, "Niveau 1 — Forêt", () => {
      this.scene.start("GameScene");
      this.scene.launch("UIScene");
    });

    this.add
      .text(
        width / 2,
        height - 40,
        "Clic gauche : poser une tourelle • Espace : lancer la vague",
        {
          fontFamily: "system-ui, sans-serif",
          fontSize: "14px",
          color: "#64748b",
        },
      )
      .setOrigin(0.5);
  }

  private makeButton(x: number, y: number, label: string, onClick: () => void): void {
    const bg = this.add.rectangle(x, y, 280, 56, 0x1e293b, 1);
    bg.setStrokeStyle(2, 0xfde68a, 1);
    const txt = this.add
      .text(x, y, label, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "20px",
        color: "#fde68a",
      })
      .setOrigin(0.5);

    bg.setInteractive({ useHandCursor: true });
    bg.on("pointerover", () => bg.setFillStyle(0x334155));
    bg.on("pointerout", () => bg.setFillStyle(0x1e293b));
    bg.on("pointerdown", onClick);
    txt.setInteractive({ useHandCursor: true });
    txt.on("pointerdown", onClick);
  }
}
