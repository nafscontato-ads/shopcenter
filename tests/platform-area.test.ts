import { describe, expect, it } from "vitest";
import { isRetiredAffiliatePath } from "@/lib/platform-area";

describe("affiliate area is retired (producer only)", () => {
  it("treats Influenciadores, Studio and Facebook pages as retired", () => {
    expect(isRetiredAffiliatePath("/influencer")).toBe(true);
    expect(isRetiredAffiliatePath("/studio/cena")).toBe(true);
    expect(isRetiredAffiliatePath("/facebook")).toBe(true);
  });

  it("keeps the producer pages open", () => {
    expect(isRetiredAffiliatePath("/shopee")).toBe(false);
    expect(isRetiredAffiliatePath("/produtos")).toBe(false);
    expect(isRetiredAffiliatePath("/fornecedores")).toBe(false);
  });
});
