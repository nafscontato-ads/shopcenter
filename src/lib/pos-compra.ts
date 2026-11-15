// Página pós-compra (obrigado) do Shop Center: perguntas, diagnóstico e oferta do Shop Center AI.
// Copiada do funil antigo (sistemapasia.lovable.app) para rodar no próprio shopcenter.cloud,
// sem a marca do Lovable. Módulo puro, seguro no navegador (sem window na importação).

export const SHOP_CENTER_AI_CHECKOUT_URL =
  "https://checkout.applyfy.com.br/checkout/cmtlsvw6100o201oguljarzka?offer=X83KJCH";

export const SHOP_CENTER_AI_PRICE_CENTS = 19800;

/** Para onde vai o botão "Acessar meu Shop Center": a tela única de Entrar / Criar minha conta. */
export const SHOP_CENTER_ACCESS_URL = "/auth";

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
    title: "Descobrir os produtos certos pode mudar sua operação.",
    description:
      "Encontrar bons produtos é uma das etapas mais importantes para construir uma operação competitiva. O Shop Center AI ajuda você a identificar tendências, analisar oportunidades e encontrar produtos que merecem sua atenção.",
    focusModule: 0,
  },
  pricing: {
    title: "Você precisa saber por quanto seus concorrentes estão vendendo.",
    description:
      "Compare preços praticados no mercado, avalie custos e margens e tenha mais informações antes de definir o preço dos seus produtos.",
    focusModule: 2,
  },
  competition: {
    title: "Enquanto você procura oportunidades, seus concorrentes já estão analisando o mercado.",
    description:
      "Entender como outros vendedores trabalham, quais preços praticam e quais produtos estão ganhando espaço pode ajudar você a tomar decisões muito melhores.",
    focusModule: 1,
  },
  sales: {
    title: "Não basta publicar produtos. É preciso escolher oportunidades.",
    description:
      "Tenha uma visão mais estratégica do mercado, identifique produtos em alta e analise concorrentes antes de decidir onde concentrar seus esforços.",
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
    "começar utilizando inteligência de mercado para identificar tendências e descobrir produtos que merecem sua atenção",
  pricing:
    "começar comparando os preços praticados no mercado, avaliando custos e simulando margens antes de definir seus preços",
  competition:
    "começar utilizando inteligência de mercado para comparar preços, estudar anúncios e identificar oportunidades",
  sales:
    "começar identificando produtos em alta e analisando concorrentes antes de decidir onde concentrar seus esforços",
};

/** Monta o diagnóstico a partir das respostas reais. */
export function buildDiagnosis(a: CompleteAnswers): string[] {
  return [
    `Identificamos que você ${STORE_PHRASE[a.has_shopee_store]}, ${GOAL_PHRASE[a.primary_goal]} e tem disponibilidade para trabalhar ${TIME_PHRASE[a.daily_availability]}.`,
    `Seu principal desafio hoje é ${DIFFICULTY_PHRASE[a.main_difficulty]}.`,
    `Por isso, nossa recomendação é ${RECOMMENDATION[a.main_difficulty]}.`,
  ];
}

export const AI_MODULES = [
  {
    title: "Produtos em alta",
    items: [
      "Análise de produtos populares.",
      "Identificação de tendências.",
      "Monitoramento de oportunidades.",
      "Comparação de produtos.",
    ],
  },
  {
    title: "Análise de concorrentes",
    items: [
      "Comparação de preços.",
      "Análise de anúncios concorrentes.",
      "Comparação de posicionamento.",
      "Identificação de oportunidades de diferenciação.",
    ],
  },
  {
    title: "Inteligência de preços",
    items: [
      "Comparação de preços do mercado.",
      "Análise de custos.",
      "Simulação de margens.",
      "Apoio à precificação.",
    ],
  },
  {
    title: "Assistente inteligente",
    items: [
      "Recomendações de produtos.",
      "Relatórios de mercado.",
      "Organização de oportunidades.",
      "Apoio à tomada de decisão.",
    ],
  },
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
  | "ai_offer_viewed"
  | "ai_offer_accepted"
  | "ai_offer_declined"
  | "ai_checkout_started"
  | "ai_purchase_approved";

// ---- Progresso salvo no navegador + eventos (chamar só em efeitos ou cliques) ----

export interface FunnelState {
  step: FunnelStep;
  questionIndex: number;
  answers: Answers;
  ai_offer_viewed: boolean;
  ai_offer_accepted: boolean | null;
  updated_at: string;
}

export const initialFunnelState = (): FunnelState => ({
  step: "thanks",
  questionIndex: 0,
  answers: {},
  ai_offer_viewed: false,
  ai_offer_accepted: null,
  updated_at: new Date(0).toISOString(),
});

const keyFor = (orderId: string) => `shopcenter:pos-compra:${orderId || "sem-pedido"}`;
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
