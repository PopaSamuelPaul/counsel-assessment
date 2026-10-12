import { beforeEach, describe, expect, it } from 'vitest';
import {
  applyTheme,
  isTheme,
  persistTheme,
  resolveTheme,
  storedTheme,
  systemTheme,
  THEME_KEY,
} from './theme';

const storageWith = (value: string | null): Storage =>
  ({
    getItem: () => value,
    setItem: () => undefined,
  }) as unknown as Storage;

const queryWith = (dark: boolean) =>
  (() => ({ matches: dark }) as MediaQueryList) as (
    query: string,
  ) => MediaQueryList;

describe('theme', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('data-theme');
  });

  it('recognises only light and dark', () => {
    expect(isTheme('dark')).toBe(true);
    expect(isTheme('light')).toBe(true);
    expect(isTheme('sepia')).toBe(false);
    expect(isTheme(null)).toBe(false);
  });

  it('reads a stored theme and ignores junk', () => {
    expect(storedTheme(storageWith('dark'))).toBe('dark');
    expect(storedTheme(storageWith('sepia'))).toBeNull();
    expect(storedTheme(storageWith(null))).toBeNull();
  });

  it('follows the system preference when nothing is stored', () => {
    expect(systemTheme(queryWith(true))).toBe('dark');
    expect(systemTheme(queryWith(false))).toBe('light');
  });

  it('prefers the stored choice over the system preference', () => {
    expect(resolveTheme(storageWith('light'), queryWith(true))).toBe('light');
    expect(resolveTheme(storageWith(null), queryWith(true))).toBe('dark');
  });

  it('applies the theme to the document and theme-color meta', () => {
    const meta = document.createElement('meta');
    meta.setAttribute('name', 'theme-color');
    document.head.append(meta);
    applyTheme('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(meta.getAttribute('content')).toBe('#0f1218');
    meta.remove();
  });

  it('persists the theme under the shared key', () => {
    const writes: Record<string, string> = {};
    const storage = {
      getItem: (k: string) => writes[k] ?? null,
      setItem: (k: string, v: string) => {
        writes[k] = v;
      },
    } as unknown as Storage;
    persistTheme('dark', storage);
    expect(writes[THEME_KEY]).toBe('dark');
  });
});
