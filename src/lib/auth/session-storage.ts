const KEY = "voices-web-session";

interface Persisted {
  accessToken: string | null;
  refreshToken: string | null;
}

const EMPTY: Persisted = { accessToken: null, refreshToken: null };

function read(): Persisted {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const p = JSON.parse(raw) as Partial<Persisted>;
    return { accessToken: p.accessToken ?? null, refreshToken: p.refreshToken ?? null };
  } catch {
    return EMPTY;
  }
}

function write(next: Persisted): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable: the in-memory caller still has the tokens this tick */
  }
}

export const sessionStorage = {
  getToken: () => read().accessToken,
  getRefreshToken: () => read().refreshToken,
  setTokens: (accessToken: string, refreshToken: string) => write({ accessToken, refreshToken }),
  clear: () => write(EMPTY),
};
