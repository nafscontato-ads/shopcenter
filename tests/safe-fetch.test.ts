import { describe, expect, it } from "vitest";
import { publicHttpUrl } from "@/lib/safe-fetch";

describe("image downloads only reach public sites", () => {
  it("accepts supplier photo addresses", () => {
    expect(publicHttpUrl("https://minipreco.vteximg.com.br/arquivos/ids/1/foto.jpg")?.hostname).toBe("minipreco.vteximg.com.br");
  });

  it("refuses local and internal addresses", () => {
    for (const url of [
      "http://localhost/admin",
      "http://127.0.0.1/",
      "http://169.254.169.254/latest/meta-data",
      "http://[::1]/",
      "http://2130706433/",
      "http://servidor.internal/",
      "https://site.com:8443/foto.jpg",
      "https://user:pass@site.com/foto.jpg",
      "file:///etc/passwd",
    ]) {
      expect(publicHttpUrl(url)).toBeNull();
    }
  });
});
