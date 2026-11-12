/* localStorage that never throws (private mode, blocked storage, previews). */
export const storage = {
  get<T = string>(key: string, fallback: T): T {
    try {
      const v = window.localStorage.getItem(`of:${key}`);
      return v == null ? fallback : (JSON.parse(v) as T);
    } catch { return fallback; }
  },
  set(key: string, value: unknown): void {
    try { window.localStorage.setItem(`of:${key}`, JSON.stringify(value)); } catch { /* ignore */ }
  },
  remove(key: string): void {
    try { window.localStorage.removeItem(`of:${key}`); } catch { /* ignore */ }
  },
};
export const session = {
  get(key: string): string | null { try { return window.sessionStorage.getItem(`of:${key}`); } catch { return null; } },
  set(key: string, v: string): void { try { window.sessionStorage.setItem(`of:${key}`, v); } catch { /* ignore */ } },
};
