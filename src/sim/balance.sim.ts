import { it } from "vitest";
import { economy } from "@/config/economy";
import { machines } from "@/config/machines";
import { products } from "@/config/products";
import { shiftPacing } from "@/config/progression";
import { upgradeList, zeroUpgradeLevels } from "@/config/upgrades";
import { pickProduct, rollGolden } from "@/game/core/orders";
import { resolveMachineReward, resolveProductReward } from "@/game/core/RewardResolver";
import { applyShiftProduct, applyShiftResult, newShift, startClock, tickShift } from "@/game/core/shift";
import { applyMachineResult, emptyFever, finishOrder, isOverdrive } from "@/game/economy/fever";
import { applyPerfectAssist, getShieldMinQuality } from "@/game/economy/multipliers";
import { achievements } from "@/game/progression/achievements";
import { goalBonus, goalReward } from "@/game/progression/goals";
import { applyXp, levelUpBonus, xpRequired } from "@/game/progression/levels";
import { machinesUnlockedAt, productsUnlockedAt, resolveMachineSequence } from "@/game/progression/unlocks";
import { canPurchaseUpgrade } from "@/game/progression/upgradeLogic";
import { seededRandom } from "@/lib/math";
import type { MachineResult } from "@/types/game";

/**
 * Balance simulation: plays whole careers of shifts through the real rules and
 * prints how the game paces out. Run with `npm run simulate`. It asserts nothing;
 * it exists so that tuning the config is done against numbers, not guesses.
 */
interface Player {
  name: string;
  /** Time spent on a machine as a multiple of its normal length. */
  pace: number;
  /** Chance of each result, best first: Perfect, 96, 90, 75, 55. */
  results: [number, number, number, number, number];
}

const QUALITIES = [100, 96, 90, 75, 55];

const players: Player[] = [
  { name: "new", pace: 1.3, results: [0.25, 0.15, 0.3, 0.2, 0.1] },
  { name: "average", pace: 1.0, results: [0.45, 0.2, 0.2, 0.1, 0.05] },
  { name: "strong", pace: 0.7, results: [0.8, 0.12, 0.06, 0.02, 0] },
];

const TRANSITION_MS =
  shiftPacing.machineEnterMs + shiftPacing.machineResolveMs + shiftPacing.resultFeedbackMs + shiftPacing.machineExitMs;
/** Time between shifts: the summary, a level-up panel, a look at the upgrades. */
const BETWEEN_SHIFTS_S = 15;
const LEVEL_MARKS = [2, 3, 5, 8, 10, 12, 15, 20];
const CAREER_HOURS = 8;

function sample(player: Player, random: () => number): number {
  let roll = random();
  for (let i = 0; i < QUALITIES.length; i++) {
    roll -= player.results[i];
    if (roll < 0) return QUALITIES[i];
  }
  return QUALITIES[QUALITIES.length - 1];
}

function simulate(player: Player, seed: number) {
  const random = seededRandom(seed);
  let level = 1;
  let xp = 0;
  let coins = 0;
  let streak = 0;
  let fever = { ...emptyFever };
  const upgrades = zeroUpgradeLevels();
  let seconds = 0;
  const reached: Record<number, number> = {};
  const shifts: { seconds: number; score: number; products: number; coins: number; level: number }[] = [];
  let maxedAt: number | null = null;
  let overdrives = 0;
  /** Seconds played so far, including the shift in progress. */
  let inShift = 0;
  const now = () => seconds + inShift;

  const gain = (amount: number) => {
    const result = applyXp(level, xp, amount);
    for (const next of result.levelsGained) {
      coins += levelUpBonus(next);
      if (!(next in reached)) reached[next] = now();
    }
    level = result.level;
    xp = result.xp;
  };

  while (seconds < CAREER_HOURS * 3600) {
    let shift = startClock(newShift(false));
    let shiftSeconds = 0;
    let shiftCoins = 0;
    const startLevel = level;

    shiftLoop: while (!shift.expired) {
      const product = products[pickProduct(productsUnlockedAt(level), random)];
      const sequence = resolveMachineSequence(product, machinesUnlockedAt(level));
      const results: MachineResult[] = [];
      let shieldUsed = false;

      for (const machineId of sequence) {
        const par = machines[machineId].estimatedDurationSeconds;
        const spent = par * 1000 * player.pace + TRANSITION_MS;
        shift = tickShift(shift, spent);
        shiftSeconds += spent / 1000;
        inShift = shiftSeconds;
        // Out of time before this machine was done: the buzzer allowance is not modelled.
        if (shift.expired) break shiftLoop;

        const quality = applyPerfectAssist(sample(player, random), upgrades);
        const reward = resolveMachineReward(quality, streak, product.stepXpScale, {
          upgradeLevels: upgrades,
          shieldMinQuality: shieldUsed ? null : getShieldMinQuality(upgrades),
        });
        shieldUsed ||= reward.shieldUsed;
        streak = reward.streak;
        const step = level >= 3 ? applyMachineResult(fever, quality) : { fever, activated: false };
        fever = step.fever;
        if (step.activated) overdrives += 1;
        gain(reward.xp);
        shift = applyShiftResult(shift, quality, par);
        results.push({ machineId, productId: product.id, quality, isPerfect: quality >= 100, durationMs: par * 1000 * player.pace });
      }

      const paid = resolveProductReward({
        product,
        results,
        streak,
        upgradeLevels: upgrades,
        isGolden: rollGolden(upgrades.goldenTouch, random),
        overdrive: isOverdrive(fever),
      });
      fever = finishOrder(fever);
      coins += paid.coins;
      shiftCoins += paid.coins;
      gain(paid.completionXp);
      shift = applyShiftProduct(shift, paid.coins, paid.machineXp + paid.completionXp);
      shift = tickShift(shift, shiftPacing.rewardSummaryMs);
      shiftSeconds += shiftPacing.rewardSummaryMs / 1000;
    }

    seconds += shiftSeconds + BETWEEN_SHIFTS_S;
    inShift = 0;
    shifts.push({ seconds: shiftSeconds, score: shift.score, products: shift.products, coins: shiftCoins, level: startLevel });

    // Between shifts the player buys the cheapest upgrade they can afford, as often as they can.
    for (;;) {
      const options = upgradeList
        .map((upgrade) => ({ upgrade, check: canPurchaseUpgrade(upgrade.id, upgrades[upgrade.id], coins, level) }))
        .filter((option) => option.check.ok)
        .sort((a, b) => a.check.cost - b.check.cost);
      if (options.length === 0) break;
      coins -= options[0].check.cost;
      upgrades[options[0].upgrade.id] += 1;
    }
    if (maxedAt === null && upgradeList.every((upgrade) => upgrades[upgrade.id] >= upgrade.maxLevel)) maxedAt = seconds;
  }

  return { reached, shifts, maxedAt, level, coins, overdrives };
}

const mean = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0);
const minutes = (seconds: number | undefined) => (seconds === undefined ? "  —  " : (seconds / 60).toFixed(0).padStart(4) + "m");

it("prints the balance report", () => {
  const lines: string[] = [];
  lines.push("");
  lines.push(`Level curve: base ${economy.level.base}, step ${economy.level.step}, exponent ${economy.level.exponent}`);
  lines.push(`XP to leave level 1/5/10/15: ${[1, 5, 10, 15].map(xpRequired).join(" / ")}`);
  lines.push("");

  for (const player of players) {
    const runs = Array.from({ length: 30 }, (_, i) => simulate(player, 1000 + i));
    const early = runs.flatMap((run) => run.shifts.filter((shift) => shift.level <= 3));
    const late = runs.flatMap((run) => run.shifts.filter((shift) => shift.level >= 10));
    const row = (label: string, list: typeof early) =>
      `  ${label}: ${mean(list.map((s) => s.seconds)).toFixed(0)}s, score ${mean(list.map((s) => s.score)).toFixed(0)}, ` +
      `${mean(list.map((s) => s.products)).toFixed(1)} products, ${mean(list.map((s) => s.coins)).toFixed(0)} coins`;

    lines.push(`${player.name.toUpperCase()} player`);
    lines.push(row("shift at levels 1-3", early));
    lines.push(row("shift at level 10+ ", late));
    lines.push(
      "  time to level " +
        LEVEL_MARKS.map((mark) => `L${mark}:${minutes(mean(runs.map((run) => run.reached[mark]).filter((v) => v !== undefined)) || undefined)}`).join(" "),
    );
    const maxed = runs.map((run) => run.maxedAt).filter((value): value is number => value !== null);
    lines.push(
      `  all upgrades maxed: ${maxed.length ? (mean(maxed) / 3600).toFixed(1) + "h" : `not within ${CAREER_HOURS}h`} ` +
        `(${maxed.length}/${runs.length} runs); level after ${CAREER_HOURS}h: ${mean(runs.map((run) => run.level)).toFixed(0)}; ` +
        `Overdrives per hour: ${(mean(runs.map((run) => run.overdrives)) / CAREER_HOURS).toFixed(1)}`,
    );
    lines.push("");
  }

  const upgradeTotal = upgradeList.reduce((sum, upgrade) => {
    let cost = 0;
    for (let level = 0; level < upgrade.maxLevel; level++) cost += Math.round(upgrade.baseCost * Math.pow(upgrade.costGrowth, level));
    return sum + cost;
  }, 0);
  lines.push(`Coins to max every upgrade: ${upgradeTotal.toLocaleString("en-US")}`);
  lines.push(
    `Not simulated, on top of the above: achievements pay ${achievements.reduce((sum, a) => sum + a.reward, 0).toLocaleString("en-US")} in total; ` +
      `a full day of goals pays ${3 * goalReward(5) + goalBonus(5)} at level 5 and ${3 * goalReward(12) + goalBonus(12)} at level 12.`,
  );
  console.log(lines.join("\n"));
});
