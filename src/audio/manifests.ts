import type { LoopKey, SoundKey } from "@/types/game";

export type AudioChannel = "ui" | "machine" | "reward" | "ambient";

/**
 * Every sound in the MVP is synthesised at runtime (see audioManager), so the
 * game ships no audio files. This manifest is the single place that maps a
 * sound to its channel; swapping in recorded assets later only touches here
 * and the manager.
 */
export const soundChannels: Record<SoundKey, AudioChannel> = {
  uiClick: "ui",
  uiBack: "ui",
  deny: "ui",
  cutSliceWood: "machine",
  cutSliceSoap: "machine",
  stampThunk: "machine",
  stampSoft: "machine",
  polishDone: "machine",
  sortDrop: "machine",
  sortMiss: "machine",
  snapIn: "machine",
  tapeSnap: "machine",
  boxClose: "machine",
  rewardGood: "reward",
  rewardExcellent: "reward",
  rewardPerfect: "reward",
  coin: "reward",
  purchase: "reward",
  levelUp: "reward",
  golden: "reward",
  tick: "ui",
  penalty: "reward",
  shiftStart: "reward",
  shiftEnd: "reward",
  comboUp: "reward",
};

export const loopChannels: Record<LoopKey, AudioChannel> = {
  cutLoop: "machine",
  polishLoop: "machine",
  tapeLoop: "machine",
  sprayLoop: "machine",
};
