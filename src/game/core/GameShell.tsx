"use client";

import { MotionConfig } from "framer-motion";
import { useEffect, type CSSProperties } from "react";
import { audio } from "@/audio/audioManager";
import { TopBar } from "@/components/counters/TopBar";
import { ErrorBoundary } from "@/components/feedback/ErrorBoundary";
import { Toast } from "@/components/feedback/Toast";
import { BottomNav } from "@/components/navigation/BottomNav";
import { StartScreen } from "@/components/overlays/StartScreen";
import { ProductsScreen } from "@/components/screens/ProductsScreen";
import { SettingsScreen } from "@/components/screens/SettingsScreen";
import { ThemesScreen } from "@/components/screens/ThemesScreen";
import { UpgradesScreen } from "@/components/screens/UpgradesScreen";
import { Button } from "@/components/ui/Button";
import { themes } from "@/config/themes";
import { initPersistence } from "@/stores/persistence";
import { useSettingsStore } from "@/stores/settingsStore";
import { useUiStore } from "@/stores/uiStore";
import { FactoryBackdrop } from "./FactoryBackdrop";
import { ProductionRunController } from "./ProductionRunController";

function FactoryScreen() {
  const sessionStarted = useUiStore((s) => s.sessionStarted);
  const themeId = useSettingsStore((s) => s.selectedFactoryTheme);
  // Factory theme variables are scoped to the gameplay area, never the menus.
  const themeVars = (themes[themeId] ?? themes.defaultFactory).vars as CSSProperties;

  return (
    <div className="h-full" style={themeVars}>
      {sessionStarted ? (
        <ProductionRunController />
      ) : (
        <div className="sf-stage relative h-full overflow-hidden rounded-3xl">
          <FactoryBackdrop />
          <StartScreen />
        </div>
      )}
    </div>
  );
}

export function GameShell() {
  const hydrated = useUiStore((s) => s.hydrated);
  const screen = useUiStore((s) => s.screen);
  const themeMode = useSettingsStore((s) => s.themeMode);
  const reducedMotion = useSettingsStore((s) => s.reducedMotion);
  const audioSettings = useSettingsStore((s) => s.audio);

  // Load the save once on the client. A bad save never blocks play.
  useEffect(() => {
    const status = initPersistence();
    if (status === "corrupt") {
      useUiStore.getState().showToast("Your save could not be read, so a fresh factory was started.");
    }
  }, []);

  // "System" leaves the attribute off so the CSS media query decides.
  useEffect(() => {
    if (!hydrated) return;
    const root = document.documentElement;
    if (themeMode === "system") delete root.dataset.mode;
    else root.dataset.mode = themeMode;
  }, [themeMode, hydrated]);

  useEffect(() => {
    audio.applySettings(audioSettings);
  }, [audioSettings]);

  // Nothing keeps sounding or fails while the tab is in the background.
  useEffect(() => {
    const onVisibility = () => audio.setHidden(document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  return (
    <MotionConfig reducedMotion={reducedMotion ? "always" : "never"}>
      <div className="flex h-dvh w-full flex-col overflow-hidden" data-reduced-motion={reducedMotion}>
        <TopBar />

        <div className="flex min-h-0 flex-1 flex-col lg:flex-row-reverse">
          <main className="min-h-0 min-w-0 flex-1 px-2 sm:px-4 lg:pr-6 lg:pb-5 lg:pl-4">
            {!hydrated ? (
              <div className="h-full rounded-3xl bg-surface-2" aria-busy="true" aria-label="Loading your factory" />
            ) : (
              <ErrorBoundary
                fallback={(retry) => (
                  <div className="flex h-full flex-col items-center justify-center gap-3 rounded-3xl bg-surface p-6 text-center">
                    <p className="font-bold">Something on the factory floor stopped. Your progress is saved.</p>
                    <Button variant="secondary" onClick={retry}>
                      Restart the line
                    </Button>
                  </div>
                )}
              >
                {screen === "factory" && <FactoryScreen />}
                {screen === "products" && <ProductsScreen />}
                {screen === "upgrades" && <UpgradesScreen />}
                {screen === "themes" && <ThemesScreen />}
                {screen === "settings" && <SettingsScreen />}
              </ErrorBoundary>
            )}
          </main>

          <BottomNav />
        </div>
        <Toast />
      </div>
    </MotionConfig>
  );
}
