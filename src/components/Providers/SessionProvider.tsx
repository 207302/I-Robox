"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  AUTH_CHANGED_EVENT,
  displayNameFromUser,
  type MeApiResponse,
  type SessionUser,
} from "@/lib/auth/clientSession";

type SessionContextValue = {
  user: SessionUser | null;
  displayName: string | null;
  isLoading: boolean;
  refresh: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

async function fetchMe(signal?: AbortSignal): Promise<SessionUser | null> {
  const res = await fetch("/api/auth/me", { cache: "no-store", signal });
  const data = (await res.json().catch(() => null)) as MeApiResponse | null;
  return data?.user ?? null;
}

type SessionProviderProps = {
  children: ReactNode;
};

export function SessionProvider({ children }: SessionProviderProps) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const inflightRef = useRef<Promise<void> | null>(null);
  const mountedRef = useRef(true);

  const refresh = useCallback(async () => {
    if (inflightRef.current) {
      await inflightRef.current;
      return;
    }

    const run = async () => {
      try {
        const next = await fetchMe();
        if (mountedRef.current) setUser(next);
      } catch {
        if (mountedRef.current) setUser(null);
      } finally {
        if (mountedRef.current) setIsLoading(false);
        inflightRef.current = null;
      }
    };

    inflightRef.current = run();
    await inflightRef.current;
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    // Always call /api/auth/me — session cookie is httpOnly (not visible in document.cookie).
    // Google OAuth and other full-page redirects rely on this.
    void refresh();

    const onAuthChanged = () => {
      void refresh();
    };
    window.addEventListener(AUTH_CHANGED_EVENT, onAuthChanged);

    return () => {
      mountedRef.current = false;
      window.removeEventListener(AUTH_CHANGED_EVENT, onAuthChanged);
    };
  }, [refresh]);

  const displayName = useMemo(() => displayNameFromUser(user), [user]);

  const value = useMemo<SessionContextValue>(
    () => ({ user, displayName, isLoading, refresh }),
    [user, displayName, isLoading, refresh]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error("useSession must be used within SessionProvider");
  }
  return ctx;
}
