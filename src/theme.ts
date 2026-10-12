export type Theme = 'light' | 'dark';

export const THEME_KEY = 'counsel-theme';
export const THEME_COLORS: Record<Theme, string> = {
  light: '#f7f8fa',
  dark: '#0f1218',
};

export function isTheme(value: string | null): value is Theme {
  return value === 'light' || value === 'dark';
}

export function storedTheme(
  storage: Storage | undefined = globalThis.localStorage,
): Theme | null {
  try {
    const value = storage?.getItem(THEME_KEY) ?? null;
    return isTheme(value) ? value : null;
  } catch {
    return null;
  }
}

export function systemTheme(
  query:
    | ((query: string) => MediaQueryList)
    | undefined = globalThis.matchMedia?.bind(globalThis),
): Theme {
  try {
    return query?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

export function resolveTheme(
  storage?: Storage,
  query?: (query: string) => MediaQueryList,
): Theme {
  return storedTheme(storage) ?? systemTheme(query);
}

export function applyTheme(
  theme: Theme,
  root: HTMLElement = document.documentElement,
) {
  root.dataset.theme = theme;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', THEME_COLORS[theme]);
}

export function persistTheme(
  theme: Theme,
  storage: Storage | undefined = globalThis.localStorage,
) {
  try {
    storage?.setItem(THEME_KEY, theme);
  } catch {
    /* storage unavailable: keep the in-memory theme */
  }
}
