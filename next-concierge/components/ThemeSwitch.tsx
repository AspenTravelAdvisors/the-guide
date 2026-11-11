"use client";

// The Auto · Light · Dark switch in the site footer. See lib/theme.ts.
//
// Rendered on the server with nothing selected: the server cannot know the
// visitor's choice, and a wrong guess would flash. The selection appears on
// hydration, read from <html data-theme-pref>, which the head script set.

import { useEffect, useSyncExternalStore } from "react";
import { setPref, watchTheme, THEME_EVENT, type ThemePref } from "@/lib/theme";

const OPTIONS: { value: ThemePref; label: string; title: string }[] = [
  { value: "auto", label: "Auto", title: "Match this device's light or dark setting" },
  { value: "light", label: "Light", title: "Always use the light theme" },
  { value: "dark", label: "Dark", title: "Always use the dark theme" },
];

function subscribe(cb: () => void) {
  document.documentElement.addEventListener(THEME_EVENT, cb);
  return () => document.documentElement.removeEventListener(THEME_EVENT, cb);
}

function getPref(): ThemePref | null {
  const p = document.documentElement.dataset.themePref;
  return p === "light" || p === "dark" || p === "auto" ? p : "auto";
}

export default function ThemeSwitch() {
  const pref = useSyncExternalStore(subscribe, getPref, () => null);

  return (
    <div className="theme-switch" role="radiogroup" aria-label="Appearance">
      <span className="theme-switch-label" aria-hidden="true">
        Appearance
      </span>
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={pref === o.value}
          title={o.title}
          onClick={() => setPref(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Mounted once in the root layout, so every page, including the atlases that
 * have no footer, follows the device while the preference is Auto.
 */
export function ThemeWatcher() {
  useEffect(() => watchTheme(), []);
  return null;
}
