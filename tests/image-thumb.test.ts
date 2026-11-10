import { expect, test } from "bun:test";
import { thumbUrl } from "../src/lib/image-thumb";

test("foto do Minipreço vira cópia 300x300 para listas", () => {
  expect(thumbUrl("https://minipreco.vteximg.com.br/arquivos/ids/216008/foto.jpg?v=1")).toBe("https://minipreco.vteximg.com.br/arquivos/ids/216008-300-300/foto.jpg?v=1");
});
test("foto da 25 de Março usa o tamanho de vitrine", () => {
  expect(thumbUrl("https://dcduh12ikx9w9.cloudfront.net/img/p/2/4/242532-large_default.jpg")).toBe("https://dcduh12ikx9w9.cloudfront.net/img/p/2/4/242532-home_default.jpg");
});
test("outras fotos (enviadas pelo dono ou clientes) ficam como estão", () => {
  const own = "https://example.supabase.co/storage/v1/object/sign/product-media/a.jpg?token=x";
  expect(thumbUrl(own)).toBe(own);
  expect(thumbUrl(null)).toBe("");
});
