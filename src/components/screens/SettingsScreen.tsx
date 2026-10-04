"use client";

import { useRef, useState, type ReactNode } from "react";
import { audio } from "@/audio/audioManager";
import { DebugPanel } from "@/components/overlays/DebugPanel";
import { Button } from "@/components/ui/Button";
import { Panel, Ribbon } from "@/components/ui/Chunky";
import { Icon, type IconName } from "@/components/ui/Icon";
import { APP_VERSION } from "@/lib/appPath";
import { SECRET_TAP_WINDOW_MS, SECRET_TAPS } from "@/lib/debugAccess";
import { resetGame } from "@/stores/persistence";
import { usePlayerStore } from "@/stores/playerStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useUiStore } from "@/stores/uiStore";
import type { ParticleDensity, ThemeMode } from "@/types/settings";
import { FeedbackPanel } from "./FeedbackPanel";
import { ScreenFrame } from "./ScreenFrame";

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex min-h-14 flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-line py-2 last:border-b-0">
      <div className="min-w-0">
        <p className="font-extrabold">{label}</p>
        {hint && <p className="text-xs font-bold text-muted">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => {
        onChange(!checked);
        audio.play("uiClick");
      }}
      className="flex h-11 w-16 shrink-0 items-center"
    >
      <span
        className={`flex h-8 w-14 items-center rounded-full border-2 p-0.5 transition-colors ${
          checked ? "border-brand-deep bg-brand" : "sf-inset border-line"
        }`}
      >
        <span
          className={`size-6 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-6" : ""}`}
        />
      </span>
    </button>
  );
}

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string; icon?: IconName }[];
  onChange: (value: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="sf-inset flex shrink-0 rounded-2xl p-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          onClick={() => {
            onChange(option.value);
            audio.play("uiClick");
          }}
          className={`flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-extrabold transition-colors ${
            value === option.value ? "sf-tile sf-tone-deep" : "text-muted"
          }`}
        >
          {option.icon && <Icon name={option.icon} size={16} />}
          {option.label}
        </button>
      ))}
    </div>
  );
}

function Volume({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  disabled: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <input
      type="range"
      min={0}
      max={1}
      step={0.05}
      value={value}
      disabled={disabled}
      aria-label={label}
      onChange={(event) => onChange(Number(event.target.value))}
      // Preview the new level once the slider is released.
      onPointerUp={() => audio.play("uiClick")}
      className="w-40 disabled:opacity-40"
    />
  );
}

export function SettingsScreen() {
  const settings = useSettingsStore();
  const totalProducts = usePlayerStore((s) => s.totalProductsCompleted);
  const totalPerfects = usePlayerStore((s) => s.totalPerfects);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const debugTools = useUiStore((s) => s.debugTools);
  const taps = useRef<number[]>([]);

  // Tapping the header icon quickly, several times, toggles the hidden debug tools.
  const secretTap = () => {
    const now = Date.now();
    taps.current = [...taps.current.filter((time) => now - time < SECRET_TAP_WINDOW_MS), now];
    if (taps.current.length >= SECRET_TAPS) {
      taps.current = [];
      useUiStore.getState().toggleDebugTools();
    }
  };
  const { audio: sound } = settings;

  return (
    <ScreenFrame title="Settings" icon="settings" narrow onIconTap={secretTap}>
      <Panel className="p-4">
        <Ribbon tone="blue">Sound</Ribbon>
        <Row label="Sound">
          <Toggle
            label="Sound"
            checked={sound.masterEnabled}
            onChange={(masterEnabled) => {
              if (masterEnabled) audio.unlock();
              settings.setAudio({ masterEnabled });
            }}
          />
        </Row>
        <Row label="Master volume">
          <Volume
            label="Master volume"
            value={sound.masterVolume}
            disabled={!sound.masterEnabled}
            onChange={(masterVolume) => settings.setAudio({ masterVolume })}
          />
        </Row>
        <Row label="Sound effects">
          <div className="flex items-center gap-2">
            <Volume
              label="Sound effects volume"
              value={sound.sfxVolume}
              disabled={!sound.masterEnabled || !sound.sfxEnabled}
              onChange={(sfxVolume) => settings.setAudio({ sfxVolume })}
            />
            <Toggle
              label="Sound effects"
              checked={sound.sfxEnabled}
              onChange={(sfxEnabled) => settings.setAudio({ sfxEnabled })}
            />
          </div>
        </Row>
        <Row label="Factory ambience" hint="A quiet background hum.">
          <div className="flex items-center gap-2">
            <Volume
              label="Ambience volume"
              value={sound.musicVolume}
              disabled={!sound.masterEnabled || !sound.musicEnabled}
              onChange={(musicVolume) => settings.setAudio({ musicVolume })}
            />
            <Toggle
              label="Factory ambience"
              checked={sound.musicEnabled}
              onChange={(musicEnabled) => {
                if (musicEnabled) audio.unlock();
                settings.setAudio({ musicEnabled });
              }}
            />
          </div>
        </Row>
      </Panel>

      <Panel className="mt-4 p-4">
        <Ribbon tone="orange">Display</Ribbon>
        <Row label="Appearance" hint="Menus and panels. Factory themes are separate.">
          <Segmented<ThemeMode>
            label="Appearance"
            value={settings.themeMode}
            onChange={settings.setThemeMode}
            options={[
              { value: "light", label: "Light", icon: "sun" },
              { value: "dark", label: "Dark", icon: "moon" },
              { value: "system", label: "System" },
            ]}
          />
        </Row>
        <Row label="Reduced motion" hint="Fewer particles, fades instead of slides.">
          <Toggle label="Reduced motion" checked={settings.reducedMotion} onChange={settings.setReducedMotion} />
        </Row>
        <Row label="Vibration" hint="A short buzz on Perfects and at the end of a shift, on phones that support it.">
          <Toggle label="Vibration" checked={settings.vibration} onChange={settings.setVibration} />
        </Row>
        <Row label="Particles">
          <Segmented<ParticleDensity>
            label="Particle density"
            value={settings.particleDensity}
            onChange={settings.setParticleDensity}
            options={[
              { value: "low", label: "Low" },
              { value: "medium", label: "Medium" },
              { value: "high", label: "High" },
            ]}
          />
        </Row>
      </Panel>

      <Panel className="mt-4 p-4">
        <Ribbon tone="green">Factory</Ribbon>
        <Row label="Products completed">
          <span className="font-black tabular-nums">{totalProducts.toLocaleString("en-US")}</span>
        </Row>
        <Row label="Perfect results">
          <span className="font-black tabular-nums">{totalPerfects.toLocaleString("en-US")}</span>
        </Row>
        <Row
          label="Where your progress lives"
          hint="Only in this browser, on this device. Clearing site data or browsing privately erases it."
        >
          <span className="sr-only">Saved in this browser</span>
        </Row>
        <Row label="Reset progress" hint="Erases coins, levels, upgrades and settings on this device.">
          {confirmingReset ? (
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setConfirmingReset(false)}>
                Keep
              </Button>
              <Button
                variant="secondary"
                className="!bg-red-600"
                onClick={() => {
                  setConfirmingReset(false);
                  resetGame();
                }}
              >
                Erase everything
              </Button>
            </div>
          ) : (
            <Button variant="ghost" onClick={() => setConfirmingReset(true)}>
              Reset
            </Button>
          )}
        </Row>
      </Panel>

      <FeedbackPanel />

      {debugTools && <DebugPanel />}

      <p className="mt-4 text-center text-xs font-bold text-muted">Clackwork {APP_VERSION}</p>
    </ScreenFrame>
  );
}
