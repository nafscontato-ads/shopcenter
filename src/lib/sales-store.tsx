import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
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

import { useAuth } from "@/lib/auth";
import { getSalesAccess, type SalesAccess } from "@/lib/sales-access.functions";
import {
  HISTORY_SEED,
  SalesHistoryStore,
  aggregate,
  dateKey,
  eachDay,
  metricsOfDays,
  type DailySales,
  type HistoryProduct,
  type SalesEvent,
  type SalesMetrics,
} from "@/lib/sales-history";
import { readBrowserCache, writeBrowserCache } from "@/lib/browser-cache";
import { getSalesBootstrap, type SalesBootstrapPayload } from "@/lib/sales.functions";
import { bootstrapCacheKey, keepNonEmpty, readCachedAccess, writeCachedAccess } from "@/lib/sales-resilience";
import { SalesSimulationEngine, type SimulationSettings } from "@/lib/sales-simulation";

const LIVE_KEY = "pas:sales-events";
const NOTIF_KEY = "pas:sales-notifications";

type Stored = { day: string; events: SalesEvent[] };

function readStored(key: string): SalesEvent[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Stored;
    if (parsed.day !== dateKey()) return [];
    return Array.isArray(parsed.events) ? parsed.events : [];
  } catch {
    return [];
  }
}

function writeStored(key: string, events: SalesEvent[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify({ day: dateKey(), events: events.slice(0, 200) }));
  } catch {
    /* storage cheio — ignora */
  }
}

export type RangeResult = {
  days: DailySales[];
  events: SalesEvent[];
  metrics: SalesMetrics;
};

type SalesContextValue = {
  access: SalesAccess | null;
  isPartner: boolean;
  loading: boolean;
  settings: SimulationSettings | null;
  /** Eventos criados nesta sessão/dia (mesma fonte do sino e do dashboard). */
  liveEvents: SalesEvent[];
  notifications: SalesEvent[];
  clearNotifications: () => void;
  query: (from: string, to: string) => RangeResult;
  dataSource: string;
};

const SalesContext = createContext<SalesContextValue>({
  access: null,
  isPartner: false,
  loading: true,
  settings: null,
  liveEvents: [],
  notifications: [],
  clearNotifications: () => {},
  query: () => ({ days: [], events: [], metrics: metricsOfDays([]) }),
  dataSource: "simulation",
});

export function SalesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const accessFn = useServerFn(getSalesAccess);
  const bootstrapFn = useServerFn(getSalesBootstrap);

  const userId = user?.id ?? null;
  // Last good answers saved in this browser: a network failure (or a reload while
  // offline) keeps showing the running balance instead of dropping it to zero.
  const [cachedAccess, setCachedAccess] = useState<SalesAccess | null>(null);
  const [cachedBootstrap, setCachedBootstrap] = useState<SalesBootstrapPayload | null>(null);

  useEffect(() => {
    setCachedAccess(userId ? readCachedAccess(userId) : null);
    setCachedBootstrap(null);
    if (!userId) return;
    let alive = true;
    void readBrowserCache(bootstrapCacheKey(userId)).then((raw) => {
      if (!alive || !raw) return;
      try {
        setCachedBootstrap(JSON.parse(raw) as SalesBootstrapPayload);
      } catch {
        /* cópia corrompida — ignora */
      }
    });
    return () => {
      alive = false;
    };
  }, [userId]);

  const accessQuery = useQuery({
    queryKey: ["sales-access", userId ?? "anon"],
    enabled: Boolean(user),
    // Errors are thrown (not turned into "not a partner") so the last good answer stays on screen.
    queryFn: () => accessFn({ data: undefined }),
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    // Partner approval rarely changes; checking every minute (and on focus) keeps the database light.
    refetchInterval: user ? 60_000 : false,
    retry: 3,
    retryDelay: (attempt) => Math.min(1_000 * 2 ** attempt, 10_000),
  });

  useEffect(() => {
    if (userId && accessQuery.data) writeCachedAccess(userId, accessQuery.data);
  }, [userId, accessQuery.data]);

  const access = accessQuery.data ?? cachedAccess;
  const isPartner = Boolean(access?.allowed);

  const bootstrap = useQuery({
    queryKey: ["sales-bootstrap"],
    queryFn: () => bootstrapFn({ data: undefined }),
    staleTime: 5 * 60_000,
    enabled: isPartner,
    retry: 3,
    retryDelay: (attempt) => Math.min(1_000 * 2 ** attempt, 10_000),
  });

  useEffect(() => {
    if (!userId || !bootstrap.data || bootstrap.data.products.length === 0) return;
    void writeBrowserCache(bootstrapCacheKey(userId), JSON.stringify(bootstrap.data));
  }, [userId, bootstrap.data]);

  const bootstrapData = bootstrap.data ?? cachedBootstrap;
  const lastProductsRef = useRef<HistoryProduct[]>([]);

  const products = useMemo<HistoryProduct[]>(() => {
    const fresh = (bootstrapData?.products ?? [])
      .filter((p) => p.price > 0)
      .map((p) => ({
        id: p.id,
        name: p.name,
        image: p.image,
        price: p.price,
        commission: p.commission,
      }));
    const kept = keepNonEmpty(fresh, lastProductsRef.current);
    lastProductsRef.current = kept;
    return kept;
  }, [bootstrapData]);

  const store = useMemo(
    () => new SalesHistoryStore(products, HISTORY_SEED),
    [products],
  );

  const [liveEvents, setLiveEvents] = useState<SalesEvent[]>([]);
  const [notifications, setNotifications] = useState<SalesEvent[]>([]);
  const [salesClock, setSalesClock] = useState(() => Date.now());
  const engineRef = useRef<SalesSimulationEngine | null>(null);
  const activeDayRef = useRef(dateKey());

  // Recupera as vendas do dia após um F5.
  useEffect(() => {
    setLiveEvents(readStored(LIVE_KEY));
    setNotifications(readStored(NOTIF_KEY));
  }, []);

  // Atualiza os totais conforme cada venda programada chega e limpa o dia anterior.
  useEffect(() => {
    const id = window.setInterval(() => {
      const nextDay = dateKey();
      if (nextDay !== activeDayRef.current) {
        activeDayRef.current = nextDay;
        setLiveEvents([]);
        setNotifications([]);
        writeStored(LIVE_KEY, []);
        writeStored(NOTIF_KEY, []);
      }
      setSalesClock(Date.now());
    }, 10_000);
    return () => window.clearInterval(id);
  }, []);

  const settings = useMemo<SimulationSettings | null>(() => {
    const configured = bootstrapData?.settings as SimulationSettings | null | undefined;
    if (!configured) return null;
    return {
      ...configured,
      enabled: true,
      mode: "automatic",
      precise_mode: false,
      interval_min_seconds: 5,
      interval_max_seconds: 600,
      daily_sales_limit: null,
      daily_revenue_target: null,
      daily_commission_target: null,
      schedule_enabled: false,
      weekdays: [0, 1, 2, 3, 4, 5, 6],
    };
  }, [bootstrapData?.settings]);

  useEffect(() => {
    if (!isPartner || !settings || !bootstrapData) return;
    const engine = new SalesSimulationEngine({
      settings,
      products: bootstrapData.products,
      productSettings: bootstrapData.productSettings,
      onSale: (sale) => {
        const event: SalesEvent = {
          id: sale.id,
          productId: sale.productId,
          productName: sale.name,
          productImage: sale.image,
          quantity: sale.quantity,
          unitPrice: sale.unitPrice,
          gross: sale.gross,
          commission: sale.commission,
          at: sale.at,
          dateKey: dateKey(new Date(sale.at)),
          source: "simulation",
          status: "confirmed",
        };
        setLiveEvents((prev) => {
          const next = [event, ...prev].slice(0, 200);
          writeStored(LIVE_KEY, next);
          return next;
        });
        setNotifications((prev) => {
          const next = [event, ...prev].slice(0, 50);
          writeStored(NOTIF_KEY, next);
          return next;
        });
      },
    });
    engineRef.current = engine;
    if (settings.enabled && settings.mode !== "manual") engine.start();
    return () => {
      engine.stop();
      engineRef.current = null;
    };
  }, [isPartner, settings, bootstrapData]);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
    writeStored(NOTIF_KEY, []);
  }, []);

  const query = useCallback(
    (from: string, to: string): RangeResult => {
      if (!isPartner) return { days: [], events: [], metrics: metricsOfDays([]) };
      void salesClock;
      const todayKey = dateKey();
      const end = to > todayKey ? todayKey : to;
      // O histórico determinístico é a fonte única dos totais exibidos.
      // Eventos locais alimentam somente o sino e nunca alteram o faturamento.
      const events = store.eventsForRange(from, end).sort((a, b) => b.at.localeCompare(a.at));

      const byDay = new Map<string, SalesEvent[]>();
      for (const e of events) {
        const list = byDay.get(e.dateKey) ?? [];
        list.push(e);
        byDay.set(e.dateKey, list);
      }
      const days = eachDay(from, end).map((d) => aggregate(byDay.get(d) ?? [], d));
      return { days, events, metrics: metricsOfDays(days) };
    },
    [isPartner, salesClock, store],
  );

  const value = useMemo<SalesContextValue>(
    () => ({
      access,
      isPartner,
      loading: (!access && accessQuery.isLoading) || (isPartner && !bootstrapData && bootstrap.isLoading),
      settings,
      liveEvents,
      notifications,
      clearNotifications,
      query,
      dataSource: bootstrapData?.dataSource ?? "simulation",
    }),
    [
      access,
      accessQuery.isLoading,
      isPartner,
      bootstrap.isLoading,
      bootstrapData,
      settings,
      liveEvents,
      notifications,
      clearNotifications,
      query,
    ],
  );

  return <SalesContext.Provider value={value}>{children}</SalesContext.Provider>;
}

export function useSales() {
  return useContext(SalesContext);
}
