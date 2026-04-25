# Stragame

Tower Defense 2D isométrique — Phaser 3 + TypeScript + Vite.

## Démarrage rapide

```bash
npm install
npm run dev
```

Ouvre ensuite l'URL affichée par Vite (http://localhost:5173 par défaut).

## Scripts

| Commande            | Description                                |
| ------------------- | ------------------------------------------ |
| `npm run dev`       | Lance le serveur de développement Vite     |
| `npm run build`     | Type-check + build de production dans `dist/` |
| `npm run preview`   | Sert le build de production en local       |
| `npm run typecheck` | Vérifie les types TypeScript               |

## État actuel (premier jet jouable)

- 4 scènes Phaser : `Boot` → `Menu` → `Game` (+ `UI` superposée).
- Grille isométrique 12×10 (tuiles 64×32) avec chemin tracé et base centrale (20 PV).
- Tourelle posable au clic sur les cases hors-chemin (coût 50 💰, crédits de départ 100).
- Spawn des ennemis (grunt pour le MVP) selon les vagues décrites dans `src/data/waves.json`.
- Détection de portée, tir automatique, projectiles, dégâts, mort de l'ennemi avec gain de crédits.
- HUD : crédits, PV de la base avec barre, vague courante, boutons d'achat des 4 tours, bouton « Lancer la vague ».
- 10 vagues progressives définies, dont la dernière avec un boss.

Les 4 types de tours et 4 types d'ennemis sont déjà décrits dans les JSON ; seules la tourelle et le grunt sont aujourd'hui pleinement testables côté équilibrage. Les autres types sont prêts à être activés.

## Contrôles

- **Clic gauche** sur un bouton de tour → mode de placement.
- **Clic gauche** sur une case grass → pose la tour (si crédits suffisants).
- **Espace** → lance la vague suivante.
- **Échap** → annule le mode de placement.

## Arborescence

```
src/
├── main.ts                # entrée Phaser, config du jeu
├── scenes/
│   ├── BootScene.ts       # init bus d'événements puis transition
│   ├── MenuScene.ts       # menu principal
│   ├── GameScene.ts       # boucle de jeu (grille, entités, input)
│   └── UIScene.ts         # HUD superposé
├── entities/
│   ├── Base.ts            # base centrale (PV)
│   ├── Enemy.ts           # ennemi + suivi de waypoints
│   ├── Tower.ts           # tour + ciblage + tir
│   └── Projectile.ts      # projectile + dégâts (et splash/slow)
├── systems/
│   ├── IsoGrid.ts         # math iso ↔ écran, helpers grille
│   ├── PathfindingHelper.ts # waypoints + tuiles du chemin
│   ├── EconomyManager.ts  # crédits, achat, gain
│   └── WaveManager.ts     # spawns programmés, fin de vague
├── data/
│   ├── map.json           # taille de la grille + waypoints
│   ├── towers.json        # stats des 4 tours (3 niveaux chacune)
│   ├── enemies.json       # stats des 4 ennemis
│   └── waves.json         # 10 vagues
└── types/
    └── index.ts           # types partagés + noms d'événements
```

## Choix techniques

- **Placeholders graphiques** : tout est dessiné via primitives Phaser (polygones, cercles), aucun asset binaire à committer pour démarrer. Remplaçable par des sprites Kenney plus tard.
- **Bus d'événements** : un `Phaser.Events.EventEmitter` partagé via `registry` relie `GameScene` et `UIScene` sans couplage dur.
- **Données externalisées** : tout l'équilibrage (tours, ennemis, vagues) vit dans `src/data/*.json`, sans toucher au code.

## Limites connues du MVP

- Une seule map.
- Pas encore de upgrade ni de revente de tour côté UI (la logique existe dans `Tower` et `EconomyManager`, à brancher).
- Pas de sauvegarde `localStorage` pour l'instant (dépendance prévue mais non implémentée).
- Le ciblage prend l'ennemi le plus avancé sur le chemin uniquement parmi ceux dans la portée.
