# Clackwork

Clackwork is a small browser game about short, tactile factory work. Each order moves through a chain of
machines (Cutter, Paint Booth, Stamper, Polisher, Sorter, Assembler, Packager), and every machine is a few seconds of hands-on input scored
for quality. Better quality means more coins; coins buy upgrades; XP unlocks new machines, products and
factory themes.

- Timed shifts are the main game: a 60-second clock, time won back by good results and lost by poor ones, a combo score and a best to beat. Free play is the untimed game
- Seven machines and six products, with Perfect streaks and rare Golden orders
- Machines play differently from order to order, with more variants as the factory levels up
- From Level 3 you pick each order from three cards, some with a twist (Rush, Precision, Training)
- Six upgrades to spend coins on: more value, Golden orders, easier Perfects, a streak shield, order rerolls and faster XP
- A fever meter fills on Perfects; a full meter starts Overdrive, which pays double coins on three orders
- Three daily goals, thirteen achievements and mastery stars per product, all tracked on the Goals tab
- Every level-up pays a coin bonus and announces what it unlocks; the level curve lives in `src/config/economy.ts`
- Works with mouse, pen and touch
- Light and dark modes, five factory themes, reduced-motion and sound settings
- Playable at https://diablo-1029.github.io/Clackwork/ (published with `npm run deploy`)
- Frontend only: a static site with progress saved in the browser (`localStorage`)

## Run it

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Static production build into `out/` (deploy to any static host) |
| `npm run deploy` | Builds for GitHub Pages and publishes to the `gh-pages` branch |
| `npm test` | Unit and integration tests (Vitest) |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript, no emit |

## What is in the MVP

- Machines: Cutter, Stamper, Polisher, Packager, Paint Booth, Sorter, Assembler
- The Toy Robot visits the Assembler five times: head, arms, legs, torso, then the final build
- Products: Wood Block, Soap Bar (gains a Polisher step once the Polisher unlocks), Ceramic Coaster, Crystal, Toy Robot, Gold Ingot
- Quality scoring, coins, XP, Factory Level, level-gated unlocks
- Upgrades: Better Materials, Golden Touch, Steady Hands, Streak Shield, Fresh Orders, Fast Learner (plus one scripted Golden Product at level 5)
- Perfect streak with a capped coin bonus
- Five factory themes, light/dark/system UI mode, reduced motion, particle density
- Sound settings, versioned local save with validation and a corrupt-save fallback

Every machine and product from the original design is playable. A product can be held back from
players with `released: false` in `src/config/products.ts`.

## Where things live

```text
src/config/            Balance and content: products, machines, upgrades, themes, pacing
src/game/economy/      Pure reward maths (coins, XP, multipliers, streak)
src/game/progression/  Levels, unlocks, upgrade costs
src/game/core/         Run state machine, reward resolver, run actions, game shell
src/game/machines/     One folder per machine: component + pure scoring function
src/stores/            Zustand stores and save wiring
src/lib/storage/       Versioned save service (load, migrate, write)
src/audio/             Synthesised sound (Web Audio)
```

Rewards only ever change through `src/game/core/runActions.ts`. Machines report a result; they never touch coins.

### Adding a product

Add an entry to `src/config/products.ts` (value, unlock level, machine sequence, material). If it needs a new
material, add a profile in `src/game/products/materialProfiles.ts`.

### Adding a machine

1. Create `src/game/machines/<name>/` with a component and a pure scoring function (plus tests).
2. Register the component in `src/game/machines/registry.ts`.
3. Set `implemented: true` for it in `src/config/machines.ts`.

## Notes on choices

- **Audio is synthesised** with the Web Audio API instead of Howler.js, because the project has no audio
  assets yet. `src/audio/manifests.ts` is the place to map sounds to files when recordings exist.
- **Icons and product art are inline SVG**, for the same reason: no image assets ship yet.
- **Coins are paid per finished product** (the reward formula in the design document), while each machine
  pays XP and updates the streak straight away.
- Tests cover the pure logic and the run flow. Component tests and Playwright are not set up.
