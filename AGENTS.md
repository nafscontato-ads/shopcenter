<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Authenticated PAS appearance is browser-persisted and applies semantic theme tokens to the shell and portaled controls; restore the document theme on exit to keep public pages unchanged.
- `/fornecedores` is the authenticated supplier directory. Public main and partner sales pages reuse SellerSalesPage; partner pages at `/fornecedor/$slug` resolve prices and checkout URLs server-side so purchase ownership cannot be chosen client-side.
- Admin/owner rights come only from active `admin_users` rows bound by user id, never email (signup auto-confirms). Demo shops are server-authorized for owner and active partners. `partner_signup` metadata creates a partner row on first access; pre-registered rows are linked only by the admin panel.
- Product uploads use the private `product-media` bucket and long-lived signed URLs because public buckets are workspace-blocked; writes remain admin-only.
- The sales dashboard includes a presentation-only Shopee Seller Center masthead; its search, profile, advertising, help, and monitor controls do not navigate or mutate state.
- Saved products appear in Shopee Integration for all accounts, regardless of photos; the owner additionally sees every active catalogue product where any user's saved/published listing holds a photo absent from the catalogue (server-checked, admin client; PAS resize copies are uploaded as `adjusted-*` so they never count as new; catalogue title/description kept, nothing copied into the catalogue).
- Owner-only products are `products` rows with status `owner_exclusive`: shared catalogue queries read only `active`, RLS lets only the admin owner read them, and the owner-checked community function returns them pinned first in Publicar do PAS (partners excluded).
- Demo aliases are per user; shared reports use synthetic seeds only. Real orders, buyers and shops stay isolated.
- The public sales catalog uses a Query-primed route loader and the existing public catalog function to keep product previews and counts current.
- Supplier directory entries, their promotional pricing helper and the shared card/unlock dialog (`supplier-card.tsx`) are reused by public sales, supplier selection and the authenticated directory to prevent drift; free activation uses authenticated RPCs with server-timed sessions, ownership and suspension checks, never granting admin/partner rights.
- Marketplaces live in one list (`src/lib/marketplaces.ts`); every "Integrar" opens the Shopee integration page, the only real store connection; the other marketplaces are a browser-stored visual selection there (owner decision) and never publish anywhere.
- Sales pages show the free suppliers as already included and the plans always visible (no selection step or timer); the Black Friday "disponível até" date is computed in São Paulo time as the next day (`src/lib/black-friday.ts`) and is presentation only, never changing price, access or checkout.
- Sales pages have no coupon: the free supplier is simply free (owner decision); `/BLACK` routes only redirect old links to `/` and `/fornecedor/$slug`.
- Shopee publishing uses the current attribute-tree API and resolves shop leaf categories server-side.
- Category attributes are prepared server-side from explicit catalogue facts; send only valid available values and let Shopee decide whether missing requirements prevent acceptance, avoiding local vetoes without inventing facts.
- Public customer signup uses hosted automatic email confirmation for immediate sessions; retain the pending-session fallback for configuration drift and never grant paid access or elevated roles from signup alone.
- Shopee photos are normalized in the browser (fit on a white square ≥500px, JPEG ≤2 MB) and publishing sends only the user's selected gallery; this avoids re-adding rejected catalogue photos.
- Size charts use confirmed saved or detected gallery images; missing charts or chart-upload failures do not block submission locally, while Shopee rejections remain visible and no placeholder chart is fabricated.
- Category order: admin override, admin-pasted supplier Shopee breadcrumb (its leaf), supplier category, Shopee recommendation, then local family matching; never unrelated leaves, clear stale attributes on category change. Pasted supplier specs live on the shared compliance row and win over automatic/owner defaults for every customer.
- Promoting customer listing media into the shared catalogue needs owner-authorized review and copying approved files into product-media; never publish customer-private paths or overwrite catalogue facts automatically.
- Shopee description init prefers nonempty saved listing text over catalogue text; blank draft saves recover prior owned text first, preventing erasure.
- Product facts first, then owner codes/defaults for empty attributes only (Anatel certificates only on registered models); GTIN needs GS1 validity, egg-cooker GTIN stays exclusive, missing GTIN sends `gtin_code "00"`.
- `docs/shopee-pipeline/` holds verbatim owner-supplied Edge Function drafts as reference only (never built or run); port logic into `src/lib` server modules because this stack does not deploy Supabase Edge Functions.
- Supplier-website products are imported page by page (VTEX: full category id paths, ≤50 per page, offsets ≤2500; PrestaShop: sitemap category pages, 100 per page, deduplicated per page) into an owner-only staging table, then copied into `products` by the service-role SQL function `pas_sync_supplier_catalog`, keyed by supplier source + external id so re-syncs refresh instead of duplicating; orders link sold items to `products.supplier_url` through the seller's own listings.
- The full catalogue travels as compact JSON text (`catalog-wire.ts`) without descriptions, which load per product; served from the `catalog_snapshot` row (rebuilt when a products-statement trigger stamps `changed_at`) plus a short per-instance memory copy, never sharing in-flight promises across requests (edge runtimes cancel them); browsers keep it in IndexedDB. Owner community list uses the `pas_community_listing_candidates` prefilter.
- Server fetches of user-supplied URLs use `safe-fetch.ts` (SSRF guard).
- Producer area only: retired affiliate addresses (`platform-area.tsx`) redirect to `/shopee` in the shell.
- Promotion fees are derived, not stored: `src/lib/finance.ts` counts paid synced orders of listings with `promoted` on since `promoted_at`, so turning promotion on never bills earlier sales; recharges credit nothing until a real payment provider confirms them.
- Shipping labels come on demand from Shopee logistics (`getShopeeShippingLabel`): read live order state first, arrange shipment only via drop-off or the shop's pickup slot (`shopee-shipping.ts`), never invent sender data, stream the PDF unstored; the browser hands it over on a fresh tap since phones block delayed downloads.
- User-facing brand text is "Shop Center" while internal identifiers (`Pas*` components, `pas-*` files/classes, storage keys, demo seeds) keep the legacy PAS names; renaming them would churn code and reset stored browser state without visible benefit.
- The Shop Center editorial look lives in `sc-*` classes at the end of `src/styles.css`; public sales pages opt in with `.sc-landing`, so app screens only share the wordmark, display font and round mark.
- Product photos in lists and grids render through `ThumbImg` (`src/lib/image-thumb.ts` maps supplier URLs to their own small copies, falling back to the original on error); editors and Shopee publishing keep original URLs so listing quality is unaffected.
- Bundled brand/hero images are pre-sized WebP in `src/assets`; sitewide fonts are bundled via `@fontsource` latin files (no render-blocking Google CSS); legacy-page fonts load from that route's `head()`. Heavy pages render their state inside `<AppShell>` (shell outside the stateful component) so typing never redraws the menu.
- Partner branding: `partner_profiles` brand columns + `brand_theme` JSON (`partner-theme.ts`), saved only by partner-checked `saveMyBranding`; shell applies it except on /dashboard; public pages get name/logo only.
