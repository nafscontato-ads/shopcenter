import { expect, test } from "bun:test";

test("novos clientes recebem confirmação automática e cadastro permanece aberto", async () => {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Missing public auth configuration");
  const response = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } });
  expect(response.status).toBe(200);
  const settings = await response.json();
  expect(settings.mailer_autoconfirm).toBe(true);
  expect(settings.disable_signup).toBe(false);
  expect(settings.external.anonymous_users).not.toBe(true);
});