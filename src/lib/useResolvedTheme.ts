import { useLayoutEffect, useState } from "react";
import { DARK_THEME_MEDIA_QUERY, resolveTheme } from "./appearance";
import type { ResolvedTheme, ThemePreference } from "./appearance";

export function useResolvedTheme(
  preference: ThemePreference,
  matchMedia: typeof window.matchMedia = systemMatchMedia,
): ResolvedTheme {
  const [resolved, setResolved] = useState<ResolvedTheme>(() => resolveInitial(preference, matchMedia));

  useLayoutEffect(() => {
    if (preference !== "system") {
      setResolved(preference);
      return;
    }

    let query: MediaQueryList;
    try {
      query = matchMedia(DARK_THEME_MEDIA_QUERY);
    } catch {
      setResolved("light");
      return;
    }
    const update = (event: MediaQueryListEvent) => setResolved(resolveTheme("system", event.matches));
    setResolved(resolveTheme("system", query.matches));
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, [matchMedia, preference]);

  return preference === "system" ? resolved : preference;
}

function systemMatchMedia(query: string): MediaQueryList {
  return window.matchMedia(query);
}

function resolveInitial(preference: ThemePreference, matchMedia: typeof window.matchMedia): ResolvedTheme {
  if (preference !== "system") return preference;
  try {
    return resolveTheme("system", matchMedia(DARK_THEME_MEDIA_QUERY).matches);
  } catch {
    return "light";
  }
}
