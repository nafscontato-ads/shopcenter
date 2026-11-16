// Página pós-compra (obrigado) do Shop Center: perguntas, diagnóstico e oferta Arranque Rápido.
// Quiz copiado do funil antigo (sistemapasia.lovable.app); a oferta agora é o Arranque Rápido. Módulo puro, seguro no navegador (sem window na importação).

/** Para onde vai o botão "Acessar meu Shop Center": a tela única de Entrar / Criar minha conta. */
export const SHOP_CENTER_ACCESS_URL = "/auth";

/** Para onde vai quem aperta "voltar" na página de obrigado: a oferta Arranque Rápido de R$ 129,90. */
export const BACK_REDIRECT_URL = "/up1";

/**
 * Oferta do fim do quiz: Arranque Rápido (5 envios pagos, R$ 129,90).
 * ARRANQUE_CHECKOUT_URL = link de checkout NORMAL da oferta no Applyfy (não o link de 1 clique da /up1,
 * que só funciona logo depois da compra). Enquanto estiver vazio, o botão avisa que ainda não está disponível.
 */
export const ARRANQUE_CHECKOUT_URL = "";
export const ARRANQUE_PRICE_CENTS = 12990;

export function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export type StoreStatus = "active" | "inactive" | "none";
export type PrimaryGoal = "first_sales" | "grow" | "scale" | "extra_income";
export type DailyAvailability = "lt2" | "2to4" | "gt4";
export type MainDifficulty = "products" | "pricing" | "competition" | "sales";

export interface Answers {
  has_shopee_store?: StoreStatus;
  primary_goal?: PrimaryGoal;
  daily_availability?: DailyAvailability;
  main_difficulty?: MainDifficulty;
}

export type CompleteAnswers = Required<Answers>;

export interface Question {
  key: keyof Answers;
  title: string;
  options: { value: string; label: string }[];
}

export const QUESTIONS: Question[] = [
  {
    key: "has_shopee_store",
    title: "Você já vende na Shopee?",
    options: [
      { value: "active", label: "Sim, já tenho uma loja ativa." },
      { value: "inactive", label: "Tenho loja, mas ainda não vendo." },
      { value: "none", label: "Ainda não comecei." },
    ],
  },
  {
    key: "primary_goal",
    title: "Qual é seu principal objetivo?",
    options: [
      { value: "first_sales", label: "Fazer minhas primeiras vendas." },
      { value: "grow", label: "Aumentar minhas vendas atuais." },
      { value: "scale", label: "Escalar e profissionalizar minha operação." },
      { value: "extra_income", label: "Criar uma renda extra." },
    ],
  },
  {
    key: "daily_availability",
    title: "Quanto tempo você pretende dedicar à sua loja?",
    options: [
      { value: "lt2", label: "Menos de 2 horas por dia." },
      { value: "2to4", label: "De 2 a 4 horas por dia." },
      { value: "gt4", label: "Mais de 4 horas por dia." },
    ],
  },
  {
    key: "main_difficulty",
    title: "Qual é sua maior dificuldade hoje?",
    options: [
      { value: "products", label: "Encontrar produtos com potencial." },
      { value: "pricing", label: "Saber o preço certo para vender." },
      { value: "competition", label: "Analisar a concorrência." },
      { value: "sales", label: "Conseguir vendas e escalar." },
    ],
  },
];

export function isComplete(a: Answers): a is CompleteAnswers {
  return QUESTIONS.every((q) => Boolean(a[q.key]));
}

export interface Profile {
  title: string;
  description: string;
  /** Módulo (0-3) destacado primeiro. */
  focusModule: number;
}

const PROFILES: Record<MainDifficulty, Profile> = {
  products: {
    title: "Você já tem os produtos. Agora falta fazer as primeiras vendas saírem.",
    description:
      "No Shop Center você já encontra catálogos de fornecedores prontos para anunciar. O que mais trava quem está começando é ter saldo para pagar o fornecedor quando a venda chega.",
    focusModule: 0,
  },
  pricing: {
    title: "Preço certo e pedido saindo: é assim que a loja ganha ritmo.",
    description:
      "O Shop Center calcula o preço com as taxas da Shopee. Falta só garantir que as primeiras vendas sejam enviadas sem você precisar tirar dinheiro do bolso.",
    focusModule: 0,
  },
  competition: {
    title: "Quem vende primeiro ganha avaliação e sai na frente da concorrência.",
    description:
      "As primeiras vendas trazem avaliações, e avaliações trazem mais vendas. Por isso o mais importante agora é não perder nenhum pedido no começo.",
    focusModule: 0,
  },
  sales: {
    title: "Não basta publicar produtos. É preciso que as primeiras vendas saiam rápido.",
    description:
      "Venda que não é enviada vira cancelamento e prejudica a loja. Garantir os primeiros envios é o que faz a operação pegar ritmo.",
    focusModule: 0,
  },
};

export function getProfile(difficulty: MainDifficulty): Profile {
  return PROFILES[difficulty];
}

const STORE_PHRASE: Record<StoreStatus, string> = {
  active: "já possui uma loja ativa",
  inactive: "já tem uma loja, mas ainda não começou a vender",
  none: "está começando sua jornada na Shopee",
};

const GOAL_PHRASE: Record<PrimaryGoal, string> = {
  first_sales: "quer conquistar suas primeiras vendas",
  grow: "quer aumentar suas vendas atuais",
  scale: "quer escalar e profissionalizar sua operação",
  extra_income: "quer criar uma renda extra",
};

const TIME_PHRASE: Record<DailyAvailability, string> = {
  lt2: "menos de 2 horas por dia",
  "2to4": "de 2 a 4 horas por dia",
  gt4: "mais de 4 horas por dia",
};

const DIFFICULTY_PHRASE: Record<MainDifficulty, string> = {
  products: "encontrar produtos com potencial",
  pricing: "saber o preço certo para vender",
  competition: "entender a concorrência",
  sales: "conseguir vendas e escalar",
};

const RECOMMENDATION: Record<MainDifficulty, string> = {
  products:
    "anunciar os produtos do catálogo e garantir que as 5 primeiras vendas sejam enviadas sem você depositar nada",
  pricing:
    "usar o preço calculado pelo Shop Center e garantir que as 5 primeiras vendas sejam enviadas sem você depositar nada",
  competition:
    "sair na frente com as primeiras vendas e avaliações, com os 5 primeiros envios pagos por nós",
  sales:
    "fazer as primeiras vendas saírem rápido, com os 5 primeiros envios pagos por nós",
};

/** Monta o diagnóstico a partir das respostas reais. */
export function buildDiagnosis(a: CompleteAnswers): string[] {
  return [
    `Identificamos que você ${STORE_PHRASE[a.has_shopee_store]}, ${GOAL_PHRASE[a.primary_goal]} e tem disponibilidade para trabalhar ${TIME_PHRASE[a.daily_availability]}.`,
    `Seu principal desafio hoje é ${DIFFICULTY_PHRASE[a.main_difficulty]}.`,
    `Por isso, nossa recomendação é ${RECOMMENDATION[a.main_difficulty]}.`,
  ];
}

export const ARRANQUE_BENEFITS = [
  "5 pedidos pagos por nós (até R$ 30 cada)",
  "O lucro das 5 primeiras vendas fica 100% com você",
  "Comece a vender hoje sem tirar dinheiro do bolso",
  "O crédito entra direto na sua carteira do Shop Center",
] as const;

export const ARRANQUE_RULES = [
  "Crédito de até 5 pedidos, até R$ 30 por pedido. O que passar disso é completado pela sua carteira.",
  "O crédito só paga fornecedor e envio. Não pode ser sacado.",
  "Vale para pedidos feitos nos primeiros 60 dias.",
] as const;

export type FunnelStep = "thanks" | "diagnostic" | "processing" | "offer" | "declined";

export const STEP_INDEX: Record<FunnelStep, number> = {
  thanks: 0,
  diagnostic: 1,
  processing: 1,
  offer: 2,
  declined: 3,
};

export const STEP_LABELS = ["Agradecimento", "Diagnóstico", "Oferta", "Confirmação"] as const;

export type FunnelEvent =
  | "purchase_confirmed"
  | "thank_you_viewed"
  | "diagnostic_started"
  | "diagnostic_completed"
  | "offer_viewed"
  | "offer_accepted"
  | "offer_declined"
  | "offer_checkout_started";

// ---- Progresso salvo no navegador + eventos (chamar só em efeitos ou cliques) ----

export interface FunnelState {
  step: FunnelStep;
  questionIndex: number;
  answers: Answers;
  offer_viewed: boolean;
  offer_accepted: boolean | null;
  updated_at: string;
}

export const initialFunnelState = (): FunnelState => ({
  step: "thanks",
  questionIndex: 0,
  answers: {},
  offer_viewed: false,
  offer_accepted: null,
  updated_at: new Date(0).toISOString(),
});

const keyFor = (orderId: string) => `shopcenter:pos-compra-v2:${orderId || "sem-pedido"}`;
const EVENTS_KEY = "shopcenter:pos-compra:events";

export function loadFunnelState(orderId: string): FunnelState | null {
  try {
    const raw = window.localStorage.getItem(keyFor(orderId));
    return raw ? { ...initialFunnelState(), ...JSON.parse(raw) } : null;
  } catch {
    return null;
  }
}

export function saveFunnelState(orderId: string, state: FunnelState) {
  try {
    window.localStorage.setItem(keyFor(orderId), JSON.stringify({ ...state, updated_at: new Date().toISOString() }));
  } catch {
    /* sem armazenamento (aba anônima): o funil segue em memória */
  }
}

type DataLayerWindow = Window & { dataLayer?: Record<string, unknown>[] };

export function trackEvent(
  event: FunnelEvent,
  props: Record<string, unknown> = {},
  { once = false }: { once?: boolean } = {},
) {
  try {
    const raw = window.localStorage.getItem(EVENTS_KEY);
    const events: { event: string; order_id?: unknown; at: string }[] = raw ? JSON.parse(raw) : [];
    if (once && events.some((e) => e.event === event && e.order_id === props["order_id"])) return;
    events.push({ event, ...props, at: new Date().toISOString() });
    window.localStorage.setItem(EVENTS_KEY, JSON.stringify(events.slice(-200)));
  } catch {
    /* ignora */
  }
  const w = window as DataLayerWindow;
  w.dataLayer = w.dataLayer ?? [];
  w.dataLayer.push({ event, ...props });
}
