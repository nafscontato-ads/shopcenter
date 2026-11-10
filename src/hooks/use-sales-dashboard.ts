import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";

import { createSimulationSalesProvider, type SimulatedSale } from "@/lib/sales-data";
import { getSalesBootstrap } from "@/lib/sales.functions";
import { SalesSimulationEngine } from "@/lib/sales-simulation";

/**
 * Conecta o dashboard ao SalesDataProvider e liga o motor de vendas simuladas
 * conforme as regras definidas pelo administrador.
 */
export function useSalesDashboard() {
  const bootstrapFn = useServerFn(getSalesBootstrap);
  const query = useQuery({
    queryKey: ["sales-bootstrap"],
    queryFn: () => bootstrapFn({ data: undefined }),
    staleTime: 60_000,
  });

  const [sessionSales, setSessionSales] = useState<SimulatedSale[]>([]);
  const engineRef = useRef<SalesSimulationEngine | null>(null);
  const data = query.data;

  useEffect(() => {
    if (!data?.settings) return;
    const engine = new SalesSimulationEngine({
      settings: data.settings,
      products: data.products,
      productSettings: data.productSettings,
      onSale: (sale) => setSessionSales((prev) => [sale, ...prev].slice(0, 100)),
    });
    engineRef.current = engine;
    if (data.settings.enabled && data.settings.mode !== "manual") engine.start();
    return () => {
      engine.stop();
      engineRef.current = null;
    };
  }, [data]);

  const provider = useMemo(() => {
    if (!data) return null;
    const applies = data.settings?.chart_updates_enabled !== false;
    return createSimulationSalesProvider(
      { months: data.months, currentProducts: data.currentProducts, dataSource: data.dataSource },
      applies ? sessionSales : [],
    );
  }, [data, sessionSales]);

  return {
    provider,
    sessionSales,
    settings: data?.settings ?? null,
    isLoading: query.isLoading,
    engine: engineRef,
  };
}
