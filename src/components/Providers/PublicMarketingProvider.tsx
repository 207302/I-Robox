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
import { hasCustomerAuthCookie } from "@/lib/auth/clientCookie";
import { AUTH_CHANGED_EVENT } from "@/lib/auth/clientSession";
import type { PublicMarketingPayload } from "@/lib/marketing/publicMarketingTypes";

type PublicMarketingContextValue = {
  data: PublicMarketingPayload | null;
  isLoading: boolean;
  refresh: (opts?: { bustCache?: boolean }) => Promise<void>;
};

const PublicMarketingContext = createContext<PublicMarketingContextValue | null>(null);

const EMPTY: PublicMarketingPayload = {
  popup: null,
  firstVisitCouponCode: null,
  freeShippingThresholdInr: null,
};

async function fetchPublicMarketing(bustCache: boolean): Promise<PublicMarketingPayload> {
  const res = await fetch("/api/public/marketing", bustCache ? { cache: "no-store" } : undefined);
  if (!res.ok) return EMPTY;
  const json = (await res.json().catch(() => null)) as PublicMarketingPayload | null;
  return json ?? EMPTY;
}

type PublicMarketingProviderProps = {
  children: ReactNode;
  initialMarketing: PublicMarketingPayload;
};

export function PublicMarketingProvider({
  children,
  initialMarketing,
}: PublicMarketingProviderProps) {
  const [data, setData] = useState<PublicMarketingPayload | null>(initialMarketing);
  const [isLoading, setIsLoading] = useState(false);
  const inflightRef = useRef<Promise<void> | null>(null);
  const mountedRef = useRef(true);

  const refresh = useCallback(async (opts?: { bustCache?: boolean }) => {
    if (inflightRef.current) {
      await inflightRef.current;
      return;
    }

    const run = async () => {
      try {
        const next = await fetchPublicMarketing(Boolean(opts?.bustCache));
        if (mountedRef.current) setData(next);
      } catch {
        if (mountedRef.current) setData(EMPTY);
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
    if (hasCustomerAuthCookie()) {
      void refresh({ bustCache: true });
    }




    const onAuthChanged = () => {
      void refresh({ bustCache: true });
    };
    window.addEventListener(AUTH_CHANGED_EVENT, onAuthChanged);

    return () => {
      mountedRef.current = false;
      window.removeEventListener(AUTH_CHANGED_EVENT, onAuthChanged);
    };
  }, [refresh]);

  const value = useMemo<PublicMarketingContextValue>(
    () => ({ data, isLoading, refresh }),
    [data, isLoading, refresh]
  );

  return (
    <PublicMarketingContext.Provider value={value}>{children}</PublicMarketingContext.Provider>
  );
}

export function usePublicMarketing(): PublicMarketingContextValue {
  const ctx = useContext(PublicMarketingContext);
  if (!ctx) {
    throw new Error("usePublicMarketing must be used within PublicMarketingProvider");
  }
  return ctx;
}
