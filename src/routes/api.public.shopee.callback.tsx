import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/shopee/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const state = url.searchParams.get("state") ?? "";
        const code = url.searchParams.get("code") ?? "";
        const shopId = Number(url.searchParams.get("shop_id") ?? url.searchParams.get("shopid"));
        const providerError = url.searchParams.get("error") ?? url.searchParams.get("error_code") ?? "";
        const providerMessage = url.searchParams.get("message") ?? url.searchParams.get("error_description") ?? "";
        const destination = new URL("/shopee", "https://sistemapas.online");
        if (providerError) {
          destination.searchParams.set("connection", "error");
          destination.searchParams.set("reason", providerMessage || "A autorização foi recusada pela Shopee.");
          return Response.redirect(destination, 302);
        }
        if (!state || !code || !Number.isInteger(shopId) || shopId <= 0) {
          destination.searchParams.set("connection", "invalid");
          destination.searchParams.set("reason", !state
            ? "A Shopee não devolveu a confirmação de segurança. Inicie a conexão novamente."
            : !code
              ? "A autorização da loja não foi confirmada na Shopee."
              : "A Shopee não informou qual loja foi autorizada.");
          return Response.redirect(destination, 302);
        }
        try {
          const { exchangeShopeeCode, getShopeeShopInfo, hashOAuthState, readShopeeTokenPayload } = await import("@/lib/shopee.server");
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const stateHash = hashOAuthState(state);
          const { data: oauthState } = await supabaseAdmin
            .from("shopee_oauth_states")
            .select("id, user_id, expires_at, used_at")
            .eq("state_hash", stateHash)
            .maybeSingle();
          if (!oauthState || oauthState.used_at || new Date(oauthState.expires_at).getTime() < Date.now()) {
            throw new Error("Autorização inválida ou expirada.");
          }
          const tokenResponse = await exchangeShopeeCode(code, shopId);
          const token = readShopeeTokenPayload(tokenResponse);
          const accessToken = token.accessToken;
          const refreshToken = token.refreshToken;
          const expiresIn = token.expiresIn;
          if (!accessToken || !refreshToken) throw new Error("A Shopee não devolveu a autorização da loja.");
          let shopName: string | null = null;
          try {
            const shopResult = await getShopeeShopInfo({ shopId, accessToken });
            const nestedShopResponse = shopResult["response"] as Record<string, unknown> | undefined;
            const shopResponse = nestedShopResponse ?? shopResult;
            shopName = String(shopResponse["shop_name"] ?? "") || null;
          } catch (shopError) {
            console.warn("Shopee shop info unavailable after successful authorization:", shopError instanceof Error ? shopError.message : "unknown error");
          }
          const { error } = await supabaseAdmin.from("shopee_shop_connections").upsert({
            user_id: oauthState.user_id,
            shop_id: shopId,
            merchant_id: token.merchantId,
            access_token: accessToken,
            refresh_token: refreshToken,
            token_expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
            refresh_token_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            status: "active",
            region: "BR",
            shop_name: shopName,
          }, { onConflict: "user_id,shop_id" });
          if (error) throw error;
          await supabaseAdmin.from("shopee_oauth_states").update({ used_at: new Date().toISOString() }).eq("id", oauthState.id);
          destination.searchParams.set("connection", "success");
        } catch (error) {
          const rawMessage = error instanceof Error ? error.message : "A Shopee não concluiu a conexão.";
          const message = rawMessage.toLowerCase();
          console.error("Shopee OAuth callback failed:", rawMessage);
          destination.searchParams.set("connection", message.includes("invalid partner_id") || message.includes("invalid_partner_id") ? "invalid" : "error");
          destination.searchParams.set("reason", rawMessage.slice(0, 200));
        }
        return Response.redirect(destination, 302);
      },
    },
  },
});