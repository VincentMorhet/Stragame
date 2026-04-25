import Phaser from "phaser";

interface MenuButton {
  rect: Phaser.Geom.Rectangle;
  bg: Phaser.GameObjects.Rectangle;
  baseFill: number;
  hoverFill: number;
  onClick: () => void;
}

export class MenuScene extends Phaser.Scene {
  private buttons: MenuButton[] = [];
  private debugText!: Phaser.GameObjects.Text;
  private tapCount: number = 0;
  private lastTap: string = "—";

  constructor() {
    super("MenuScene");
  }

  create(): void {
    const { width, height } = this.scale;
    this.buttons = [];
    this.tapCount = 0;
    this.lastTap = "—";

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

    this.debugText = this.add
      .text(8, 8, "tap: 0  last: —", {
        fontFamily: "monospace",
        fontSize: "12px",
        color: "#475569",
      })
      .setDepth(1000);

    this.input.on("pointerup", (pointer: Phaser.Input.Pointer) => this.handleTap(pointer));
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      this.tapCount++;
      this.lastTap = `${Math.round(pointer.x)},${Math.round(pointer.y)}`;
      this.debugText.setText(`tap: ${this.tapCount}  last: ${this.lastTap}`);
    });
    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => this.handleHover(pointer));
  }

  private makeButton(x: number, y: number, label: string, onClick: () => void): void {
    const w = 280;
    const h = 56;
    const baseFill = 0x1e293b;
    const hoverFill = 0x334155;

    const bg = this.add.rectangle(x, y, w, h, baseFill, 1);
    bg.setStrokeStyle(2, 0xfde68a, 1);

    this.add
      .text(x, y, label, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "20px",
        color: "#fde68a",
      })
      .setOrigin(0.5);

    this.buttons.push({
      rect: new Phaser.Geom.Rectangle(x - w / 2, y - h / 2, w, h),
      bg,
      baseFill,
      hoverFill,
      onClick,
    });
  }

  private handleTap(pointer: Phaser.Input.Pointer): void {
    const px = pointer.x;
    const py = pointer.y;
    for (const btn of this.buttons) {
      if (Phaser.Geom.Rectangle.Contains(btn.rect, px, py)) {
        btn.onClick();
        return;
      }
    }
  }

  private handleHover(pointer: Phaser.Input.Pointer): void {
    const px = pointer.x;
    const py = pointer.y;
    for (const btn of this.buttons) {
      const inside = Phaser.Geom.Rectangle.Contains(btn.rect, px, py);
      btn.bg.setFillStyle(inside ? btn.hoverFill : btn.baseFill);
    }
  }
}
