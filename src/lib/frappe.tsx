/**
 * Drop-in replacement for the `frappe-react-sdk` hooks.
 *
 * Same names, same signatures — the pages only change their import path. The
 * difference is that every call routes through `backend.call()`, so each screen
 * keeps working when Frappe is unreachable instead of rendering an empty state.
 *
 * (The upstream SDK talks over axios and has no fallback path, which is why the
 * whole storefront went blank whenever the bench was down.)
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { call, detectMode, currentMode, onModeChange, db } from './backend';
import type { Mode } from './backend';

// ─── provider ────────────────────────────────────────────────────────────────

interface AuthCtx {
  currentUser: string | null;
  isLoading: boolean;
  refresh: () => Promise<void>;
  setUser: (u: string | null) => void;
}

const Ctx = createContext<AuthCtx>({
  currentUser: null,
  isLoading: true,
  refresh: async () => {},
  setUser: () => {},
});

/** Live backend mode, for UI that needs to say "demo data" out loud. */
export function useBackendMode(): Mode | null {
  const [mode, setMode] = useState<Mode | null>(currentMode());
  useEffect(() => {
    let alive = true;
    detectMode().then(m => alive && setMode(m));
    const off = onModeChange(m => alive && setMode(m));
    return () => {
      alive = false;
      off();
    };
  }, []);
  return mode;
}

export function FrappeProvider({ children }: { url?: string; enableSocket?: boolean; children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [isLoading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const mode = await detectMode();
      if (mode === 'demo') {
        setCurrentUser(db.currentSession());
      } else {
        // Frappe drops a user_id cookie on login; reading it avoids a round trip
        // and works even where frappe.auth.get_logged_user isn't whitelisted.
        const cookie = document.cookie.match(/(?:^|;\s*)user_id=([^;]+)/)?.[1];
        const fromCookie = cookie ? decodeURIComponent(cookie) : null;
        if (fromCookie && fromCookie !== 'Guest') {
          setCurrentUser(fromCookie);
        } else {
          const res = await call('frappe.auth.get_logged_user', {}, { method: 'GET' }).catch(() => null);
          const u = res?.message;
          setCurrentUser(u && u !== 'Guest' ? u : null);
        }
      }
    } catch {
      setCurrentUser(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo<AuthCtx>(
    () => ({ currentUser, isLoading, refresh, setUser: setCurrentUser }),
    [currentUser, isLoading, refresh]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

// ─── auth ────────────────────────────────────────────────────────────────────

export function useFrappeAuth() {
  const { currentUser, isLoading, refresh, setUser } = useContext(Ctx);

  const login = useCallback(
    async (creds: { username: string; password: string }) => {
      const res = await call('login', { usr: creds.username, pwd: creds.password });
      await refresh();
      // Frappe's cookie can lag a tick behind the response; trust the response.
      setUser(res?.user || creds.username);
      return res;
    },
    [refresh, setUser]
  );

  const logout = useCallback(async () => {
    await call('logout', {}, { method: 'GET' }).catch(() => {});
    setUser(null);
  }, [setUser]);

  return { currentUser, isLoading, login, logout, updateCurrentUser: refresh };
}

// ─── data hooks ──────────────────────────────────────────────────────────────

interface QueryResult<T> {
  data: T | undefined;
  error: Error | null;
  isLoading: boolean;
  isValidating: boolean;
  mutate: () => void;
}

/**
 * Minimal SWR-alike: fetch on key change, expose a manual refetch.
 * `key === null` means "don't fetch yet" (same contract as the SDK).
 */
function useQuery<T>(key: string | null, fetcher: () => Promise<T>): QueryResult<T> {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setLoading] = useState(key !== null);
  const [tick, setTick] = useState(0);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    if (key === null) {
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);
    fetcherRef.current()
      .then(d => {
        if (!alive) return;
        setData(d);
        setError(null);
      })
      .catch(e => {
        if (!alive) return;
        setError(e instanceof Error ? e : new Error(String(e)));
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [key, tick]);

  const mutate = useCallback(() => setTick(t => t + 1), []);
  return { data, error, isLoading, isValidating: isLoading, mutate };
}

export function useFrappeGetDocList<T>(
  doctype: string,
  args?: Record<string, unknown>
): QueryResult<T[]> {
  const key = args === undefined ? null : `list:${doctype}:${JSON.stringify(args)}`;
  return useQuery<T[]>(key, async () => {
    const res = await call('frappe.client.get_list', {
      doctype,
      fields: args?.fields,
      filters: args?.filters,
      limit: args?.limit,
      limit_start: args?.limit_start,
      order_by: args?.orderBy
        ? `${(args.orderBy as any).field} ${(args.orderBy as any).order || 'asc'}`
        : args?.order_by,
    });
    return (res.message ?? []) as T[];
  });
}

export function useFrappeGetDoc<T>(doctype: string, name?: string): QueryResult<T> {
  const key = name ? `doc:${doctype}:${name}` : null;
  return useQuery<T>(key, async () => {
    const res = await call('frappe.client.get', { doctype, name });
    return res.message as T;
  });
}

export function useFrappeGetCall<T>(
  method: string,
  params?: Record<string, unknown>,
  swrKey?: string | null
): QueryResult<T> {
  const key = swrKey === null ? null : swrKey || `call:${method}:${JSON.stringify(params ?? {})}`;
  return useQuery<T>(key, () => call(method, params ?? {}, { method: 'GET' }) as Promise<T>);
}

export function useFrappePostCall<T>(method: string) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const run = useCallback(
    async (params?: Record<string, unknown>): Promise<T> => {
      setLoading(true);
      setError(null);
      try {
        return (await call(method, params ?? {})) as T;
      } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e));
        setError(err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [method]
  );

  return { call: run, loading, error, result: undefined as T | undefined, reset: () => setError(null) };
}

// ─── mutations ───────────────────────────────────────────────────────────────

export function useFrappeCreateDoc() {
  const [loading, setLoading] = useState(false);
  const createDoc = useCallback(async (doctype: string, doc: Record<string, unknown>) => {
    setLoading(true);
    try {
      const res = await call('frappe.client.insert', { doc: { doctype, ...doc } });
      return res.message;
    } finally {
      setLoading(false);
    }
  }, []);
  return { createDoc, loading };
}

export function useFrappeUpdateDoc() {
  const [loading, setLoading] = useState(false);
  const updateDoc = useCallback(async (doctype: string, name: string, doc: Record<string, unknown>) => {
    setLoading(true);
    try {
      const res = await call('frappe.client.set_value', { doctype, name, fieldname: doc });
      return res.message;
    } finally {
      setLoading(false);
    }
  }, []);
  return { updateDoc, loading };
}

export function useFrappeDeleteDoc() {
  const [loading, setLoading] = useState(false);
  const deleteDoc = useCallback(async (doctype: string, name: string) => {
    setLoading(true);
    try {
      return await call('frappe.client.delete', { doctype, name });
    } finally {
      setLoading(false);
    }
  }, []);
  return { deleteDoc, loading };
}

export { call, detectMode, db };
