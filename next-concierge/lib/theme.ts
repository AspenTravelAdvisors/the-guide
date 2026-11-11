// Light and dark themes.
//
// Two palettes: the original dark one (near-black and antique gold) and a light
// one (warm ivory, blush and dusty rose with champagne gold). Which one shows
// is a three-way preference:
//
//   "auto"  follow the device's light/dark setting, live (the default)
//   "light" always light
//   "dark"  always dark
//
// The preference lives in localStorage under THEME_KEY. The resolved theme is
// written to <html data-theme="light|dark">, and every color in globals.css
// reads from tokens that `:root[data-theme="light"]` redefines.
//
// THEME_SCRIPT runs inline in <head>, before the first paint, so a light-theme
// visitor never sees a flash of the dark page while the app hydrates. It is a
// plain string because it has to run before any bundle loads; keep it in step
// with resolve()/apply() below.

export type ThemePref = "auto" | "light" | "dark";
export type Theme = "light" | "dark";

export const THEME_KEY = "ebl.theme";
/** Fired on <html> whenever the resolved theme changes. */
export const THEME_EVENT = "ebl:themechange";

/** The browser chrome color (address bar on phones) for each theme. */
const CHROME: Record<Theme, string> = { dark: "#09090b", light: "#fbf6f3" };

export const THEME_SCRIPT = `(function(){try{var p=localStorage.getItem(${JSON.stringify(
  THEME_KEY,
)});}catch(e){}if(p!=="light"&&p!=="dark")p="auto";var t=p==="auto"?(window.matchMedia&&matchMedia("(prefers-color-scheme: light)").matches?"light":"dark"):p;var d=document.documentElement;d.dataset.theme=t;d.dataset.themePref=p;d.style.colorScheme=t;var m=document.querySelector('meta[name="theme-color"]');if(!m){m=document.createElement("meta");m.name="theme-color";document.head.appendChild(m);}m.content=t==="light"?${JSON.stringify(
  CHROME.light,
)}:${JSON.stringify(CHROME.dark)};})();`;

export function readPref(): ThemePref {
  try {
    const p = localStorage.getItem(THEME_KEY);
    if (p === "light" || p === "dark") return p;
  } catch {
    /* storage unavailable: follow the device */
  }
  return "auto";
}

function systemTheme(): Theme {
  return typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-color-scheme: light)").matches
    ? "light"
    : "dark";
}

export function resolve(pref: ThemePref): Theme {
  return pref === "auto" ? systemTheme() : pref;
}

/** The theme currently on the page. Dark when called on the server. */
export function currentTheme(): Theme {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

function apply(pref: ThemePref) {
  const d = document.documentElement;
  const before = d.dataset.theme;
  const prefBefore = d.dataset.themePref;
  const theme = resolve(pref);
  d.dataset.theme = theme;
  d.dataset.themePref = pref;
  d.style.colorScheme = theme;
  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = "theme-color";
    document.head.appendChild(meta);
  }
  meta.content = CHROME[theme];
  // Fired on a preference change too, even when the colors stay the same
  // (dark → auto on a dark device), so the switch can redraw its selection.
  if (before !== theme || prefBefore !== pref) {
    d.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: theme }));
  }
}

/** Save the visitor's choice and apply it now. */
export function setPref(pref: ThemePref) {
  try {
    if (pref === "auto") localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, pref);
  } catch {
    /* storage unavailable: the choice still applies to this page */
  }
  apply(pref);
}

/**
 * Follow the device setting while the preference is "auto", and pick up a
 * choice made in another tab. Returns the cleanup.
 */
export function watchTheme(): () => void {
  const mq = window.matchMedia?.("(prefers-color-scheme: light)");
  const onSystem = () => {
    if (readPref() === "auto") apply("auto");
  };
  const onStorage = (e: StorageEvent) => {
    if (e.key === THEME_KEY) apply(readPref());
  };
  mq?.addEventListener?.("change", onSystem);
  window.addEventListener("storage", onStorage);
  return () => {
    mq?.removeEventListener?.("change", onSystem);
    window.removeEventListener("storage", onStorage);
  };
}
