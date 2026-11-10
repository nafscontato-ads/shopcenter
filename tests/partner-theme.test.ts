import { describe, expect, it } from "vitest";
import { themeSchema, themeVars } from "@/lib/partner-theme";

describe("partner theme", () => {
  it("applies the chosen main color to buttons", () => {
    const v = themeVars({ primary: "#10B981" }) as Record<string, string>;
    expect(v["--primary"]).toBe("#10B981");
  });
  it("changes page background and text when picked", () => {
    const v = themeVars({ background: "#FFFFFF", text: "#111111" }) as Record<string, string>;
    expect(v["--background"]).toBe("#FFFFFF");
    expect(v["--foreground"]).toBe("#111111");
  });
  it("keeps the default look when nothing is customized", () => {
    expect(themeVars({})).toBeUndefined();
  });
  it("rejects invalid colors", () => {
    expect(themeSchema.safeParse({ primary: "red" }).success).toBe(false);
  });
});

import { themeVars as tv2 } from "../src/lib/partner-theme";
import { describe as d2, it as i2, expect as e2 } from "vitest";
d2("light/dark mode with partner theme", () => {
  const dark = { primary: "#6366F1", background: "#0B0B14", text: "#F2F2F2" };
  i2("light mode drops a dark theme's page colors but keeps the brand color", () => {
    const v = tv2(dark, null, "light") as Record<string, string>;
    e2(v["--background"]).toBeUndefined();
    e2(v["--primary"]).toBe("#6366F1");
  });
  i2("dark mode keeps a dark theme's page colors", () => {
    const v = tv2(dark, null, "dark") as Record<string, string>;
    e2(v["--background"]).toBe("#0B0B14");
  });
});
