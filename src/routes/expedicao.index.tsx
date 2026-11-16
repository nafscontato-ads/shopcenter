import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";

import { SupplierPanel } from "@/components/supplier-panel";
import { useSupplierPanel } from "@/components/supplier-panel-data";
import { useAuth } from "@/lib/auth";
import { getMySupplierLabel, getMySupplierPanel, markMySupplierShipped } from "@/lib/fulfillment.functions";

/** Supplier panel for a supplier signed in through the normal Shop Center login (/auth). */
export const Route = createFileRoute("/expedicao/")({
  head: () => ({ meta: [{ title: "Expedição | Shop Center" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: SupplierAccountPanel,
});

function SupplierAccountPanel() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const panelFn = useServerFn(getMySupplierPanel);
  const labelFn = useServerFn(getMySupplierLabel);
  const shippedFn = useServerFn(markMySupplierShipped);
  useEffect(() => {
    if (!loading && !user) void navigate({ to: "/auth", search: { redirect: "/expedicao" }, replace: true });
  }, [loading, user, navigate]);
  const { common } = useSupplierPanel(`user:${user?.id ?? ""}`, Boolean(user), () => panelFn(), (id) => labelFn({ data: { id } }), (id) => shippedFn({ data: { id } }));
  const exit = async () => { await signOut(); void navigate({ to: "/auth", search: { redirect: undefined } }); };
  return <SupplierPanel {...common} loading={common.loading || loading} onSignOut={() => void exit()} />;
}
