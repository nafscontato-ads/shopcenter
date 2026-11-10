export type Product = {
  id: string;
  name: string;
  price: number;
  commission: number;
  rating: number;
  reviews: string;
  category: string;
  viral: boolean;
  score: number;
  image: string | null;
  url: string | null;
  promoPrice: number | null;
  soldCount: number;
  brand: string | null;
  description: string | null;
  subcategory: string | null;
  sku: string | null;
  images: string[];
  videoUrl: string | null;
  /** Supplier website the product comes from (see supplier-sites.ts). */
  supplierSource?: string | null;
  /** Price on the supplier website, used as the product cost. */
  supplierCost?: number | null;
};

export const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const kpis = [
  { label: "Vendas de Hoje", value: 73.14, orders: 4, delta: 10.8 },
  { label: "Últimos 7 Dias", value: 743.57, orders: 47, delta: 9.3 },
  { label: "Últimos 30 Dias", value: 2588.04, orders: 160, delta: 12.7 },
  { label: "Vendas Totais", value: 8799.34, orders: 480, delta: 12.7 },
];

export const salesSeries = [
  62, 88, 71, 154, 96, 74, 68, 82, 112, 220, 78, 60, 92, 140, 88, 130, 168, 104,
  86, 118, 96, 74, 128, 96, 82, 150, 186, 110, 96, 148, 205, 132,
].map((v, i) => ({
  day: `${String((i % 28) + 5).padStart(2, "0")}/08`,
  value: v,
}));

export const latestSales = [
  { name: "Tênis Esportivo Leve Unissex", city: "Recife, PE", time: "09:32", value: 21.02 },
  { name: "Kit 3 Camisetas Dry Fit Masculina", city: "Fortaleza, CE", time: "05:35", value: 9.28 },
  { name: "Kit Skincare Vitamina C", city: "Recife, PE", time: "04:47", value: 29.95 },
  { name: "Kit Skincare Vitamina C", city: "Salvador, BA", time: "22:40", value: 12.89 },
  { name: "Organizador de Geladeira 6 Peças", city: "Fortaleza, CE", time: "19:47", value: 8.75 },
  { name: "Fone Bluetooth TWS Pro 5.3", city: "Manaus, AM", time: "15:05", value: 18.25 },
  { name: "Luminária LED de Mesa Dobrável", city: "Fortaleza, CE", time: "15:00", value: 2.67 },
  { name: "Smartwatch D20 Monitor Cardíaco", city: "Manaus, AM", time: "12:45", value: 2.06 },
];

export const topProducts = [
  { name: "Fone Bluetooth TWS Pro 5.3", orders: 4, value: 91.96 },
  { name: "Tênis Esportivo Leve Unissex", orders: 3, value: 67.62 },
  { name: "Kit Skincare Vitamina C", orders: 2, value: 42.84 },
  { name: "Organizador de Geladeira 6 Peças", orders: 2, value: 29.62 },
  { name: "Caixa de Som Portátil 20W", orders: 2, value: 22.16 },
];

export const categories = [
  "Todas",
  "Acessórios de Celular",
  "Automotivo",
  "Beleza e Cuidados",
  "Casa e Cozinha",
  "Eletrônicos",
  "Ferramentas",
  "Fitness e Suplementos",
  "Games",
];


export const facebookGroups = [
  { name: "Achadinhos Shopee Brasil", members: "412 mil", heat: "Alta" },
  { name: "Promoções e Cupons Shopee", members: "287 mil", heat: "Alta" },
  { name: "Ofertas do Dia — Casa e Cozinha", members: "132 mil", heat: "Média" },
  { name: "Tech Barato Brasil", members: "96 mil", heat: "Média" },
];
