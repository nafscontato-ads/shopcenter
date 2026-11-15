/**
 * TEXTOS DAS PÁGINAS DO FUNIL (shopcenter.cloud/up1 e shopcenter.cloud/down1).
 *
 * Pode editar à vontade só o que está entre aspas. Não apague as aspas nem as vírgulas.
 * Para negrito, coloque o trecho entre **asteriscos duplos**.
 *
 * linkAceitar: o link do botão verde. Cole aqui o link que a Applyfy mostra na aba
 * UPSELL/DOWNSELL depois de criar o produto. Enquanto estiver vazio, o botão mostra
 * um aviso de "link ainda não configurado" em vez de levar para um lugar errado.
 * linkRecusar: para onde vai quem clica em "não quero".
 */

export type PaginaFunil = {
  selo: string;
  titulo: string;
  subtitulo: string;
  paragrafos: string[];
  beneficios: string[];
  /** Preço riscado. Deixe "" para não mostrar. */
  precoDe: string;
  precoPor: string;
  precoObs: string;
  botaoAceitar: string;
  linkAceitar: string;
  botaoRecusar: string;
  linkRecusar: string;
  regras: string[];
};

export const UPSELL_1: PaginaFunil = {
  selo: "🧡 ESPERA! Seu acesso já está garantido",
  titulo: "Só mais uma coisa antes de você começar...",
  subtitulo: "O que mais trava aluno novo não é vender. É ter dinheiro na hora de comprar do fornecedor.",
  paragrafos: [
    "Você faz a venda na Shopee, mas o pedido só sai se tiver saldo na carteira para pagar o fornecedor. É aí que muita gente perde as primeiras vendas.",
    "Por isso criamos o **Arranque Rápido**: a gente paga os seus **5 primeiros envios**. Você vende, nós compramos do fornecedor e despachamos, e você não precisa depositar nada.",
  ],
  beneficios: [
    "5 pedidos pagos por nós (até R$ 30 cada)",
    "O lucro das 5 primeiras vendas fica 100% com você",
    "Comece a vender hoje sem tirar dinheiro do bolso",
    "O crédito entra direto na sua carteira do Shop Center",
  ],
  precoDe: "",
  precoPor: "R$ 149,90",
  precoObs: "pagamento único, cobrado no mesmo cartão ou Pix da sua compra",
  botaoAceitar: "🧡 SIM, QUERO MEUS 5 ENVIOS PAGOS",
  linkAceitar: "",
  botaoRecusar: "Não, prefiro depositar na carteira por conta própria",
  linkRecusar: "/down1",
  regras: [
    "Crédito de até 5 pedidos, até R$ 30 por pedido. O que passar disso é completado pela sua carteira.",
    "O crédito só paga fornecedor e envio. Não pode ser sacado.",
    "Vale para pedidos feitos nos primeiros 60 dias.",
  ],
};

export const DOWNSELL_1: PaginaFunil = {
  selo: "🧡 Tudo bem, a gente entende!",
  titulo: "Que tal começar com 3 envios pagos por nós?",
  subtitulo: "Mesma ajuda, menor valor. Para você fazer as primeiras vendas sem depositar nada.",
  paragrafos: [
    "Com o **Arranque Rápido Lite**, a gente paga os seus **3 primeiros envios**. É o suficiente para você ver o dinheiro das primeiras vendas cair e ganhar confiança.",
  ],
  beneficios: [
    "3 pedidos pagos por nós (até R$ 30 cada)",
    "O lucro das 3 primeiras vendas fica 100% com você",
    "O crédito entra direto na sua carteira do Shop Center",
  ],
  precoDe: "R$ 149,90",
  precoPor: "R$ 97,00",
  precoObs: "pagamento único, cobrado no mesmo cartão ou Pix da sua compra",
  botaoAceitar: "🧡 SIM, QUERO MEUS 3 ENVIOS PAGOS",
  linkAceitar: "",
  botaoRecusar: "Não, obrigado. Quero ir para o meu acesso",
  linkRecusar: "/auth",
  regras: [
    "Crédito de até 3 pedidos, até R$ 30 por pedido. O que passar disso é completado pela sua carteira.",
    "O crédito só paga fornecedor e envio. Não pode ser sacado.",
    "Vale para pedidos feitos nos primeiros 60 dias.",
  ],
};
