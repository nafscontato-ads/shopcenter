import greenLogo from '@/assets/suppliers/green-sellers.webp';
import jbLogo from '@/assets/suppliers/jb-imports.webp';
import multiLogo from '@/assets/suppliers/multiplace.webp';
import promoLogo from '@/assets/suppliers/promovale.webp';
import miniprecoLogo from '@/assets/suppliers/minipreco.webp';
import demarcoLogo from '@/assets/suppliers/25demarco.webp';
import maisQueLogo from '@/assets/suppliers/mais-que-distribuidora.webp';
import donaCasaLogo from '@/assets/suppliers/dona-casa.webp';
import talentosPetLogo from '@/assets/suppliers/talentos-pet.webp';
import zentry from '@/assets/zentry-commerce.webp.asset.json';
import atlas from '@/assets/atlas-supply.webp.asset.json';
import novasource from '@/assets/novasource.webp.asset.json';
import vexon from '@/assets/vexon.webp.asset.json';
import primestock from '@/assets/primestock.webp.asset.json';
import nexora from '@/assets/nexora.webp.asset.json';
import flexora from '@/assets/flexora.webp.asset.json';
import maxvora from '@/assets/maxvora.webp.asset.json';
import upstock from '@/assets/upstock.webp.asset.json';
import nexcell from '@/assets/nexcell.webp.asset.json';
import orvex from '@/assets/orvex.webp.asset.json';

/** Black Friday prices never go below this floor (owner rule). */
export const BLACK_FRIDAY_FLOOR = 1000;

export type Supplier = {
  id: string;
  name: string;
  logo: string;
  /** "square" logos fill the round badge; "wide" logos are fitted inside it. */
  logoShape: 'square' | 'wide';
  address: string;
  /** Free for every account, including owners and existing buyers. */
  unlocked: boolean;
  /** Regular yearly price (premium suppliers only). */
  annualPrice?: number;
  /** Black Friday yearly price (premium suppliers only). */
  blackFridayPrice?: number;
  /** Supplier website whose products form this supplier's catalogue (see supplier-sites.ts). */
  catalogSource?: string;
  /** Partner closed, catalogue still being imported: the card shows "Catálogo em breve". */
  comingSoon?: boolean;
};

/** Shared factual availability; no integration is implied by a directory entry. */
export const supplierDirectory: Supplier[] = [
  { id: 'minipreco', name: 'Minipreço', logo: miniprecoLogo, logoShape: 'wide', address: 'Avenida dos Estados, 1250 — Mooca, São Paulo – SP, CEP 03105-000', unlocked: true, catalogSource: 'minipreco' },
  { id: '25demarco', name: '25 de Março Online', logo: demarcoLogo, logoShape: 'wide', address: 'Rua do Gasômetro, 845 — Brás, São Paulo – SP, CEP 03004-001', unlocked: true, catalogSource: '25demarco' },
  { id: 'mais-que-distribuidora', name: 'Mais Que Distribuidora', logo: maisQueLogo, logoShape: 'wide', address: 'Ibitinga – SP · cama, mesa, banho e decoração', unlocked: true, comingSoon: true },
  { id: 'dona-casa', name: 'Dona Casa Distribuidora', logo: donaCasaLogo, logoShape: 'square', address: 'Ibitinga – SP · cama, mesa e decoração', unlocked: true, comingSoon: true },
  { id: 'talentos-pet', name: 'Talentos Pet', logo: talentosPetLogo, logoShape: 'square', address: 'Iacanga – SP · produtos pet', unlocked: true, comingSoon: true },
  { id: 'zentry-commerce', name: 'Zentry Commerce', logo: zentry.url, logoShape: 'square', address: 'Rua das Palmeiras, 184 — Centro, São Paulo – SP, CEP 01042-120', annualPrice: 1589, blackFridayPrice: 1089, unlocked: false },
  { id: 'atlas-supply', name: 'Atlas Supply', logo: atlas.url, logoShape: 'square', address: 'Avenida Nova Esperança, 725 — Jardim América, São Paulo – SP, CEP 01428-310', annualPrice: 2190, blackFridayPrice: 1490, unlocked: false },
  { id: 'novasource', name: 'Novasource Distribuidora', logo: novasource.url, logoShape: 'square', address: 'Rua dos Ipês, 392 — Vila Industrial, Campinas – SP, CEP 13035-240', annualPrice: 2690, blackFridayPrice: 1790, unlocked: false },
  { id: 'vexon', name: 'VEXON Distribuidora', logo: vexon.url, logoShape: 'square', address: 'Avenida Horizonte Azul, 1080 — Centro, Curitiba – PR, CEP 80025-180', annualPrice: 3190, blackFridayPrice: 2190, unlocked: false },
  { id: 'primestock', name: 'PrimeStock Supply', logo: primestock.url, logoShape: 'square', address: 'Rua Monte Verde, 256 — Boa Vista, Porto Alegre – RS, CEP 90450-320', annualPrice: 3590, blackFridayPrice: 2390, unlocked: false },
  { id: 'nexora', name: 'Nexora Supply', logo: nexora.url, logoShape: 'square', address: 'Avenida das Nações, 1540 — Centro, Joinville – SC, CEP 89201-450', annualPrice: 4290, blackFridayPrice: 2890, unlocked: false },
  { id: 'flexora', name: 'Flexora Distribuição', logo: flexora.url, logoShape: 'square', address: 'Rua Aurora do Sul, 613 — Savassi, Belo Horizonte – MG, CEP 30140-090', annualPrice: 4998, blackFridayPrice: 3290, unlocked: false },
  { id: 'maxvora', name: 'MAXVORA Supply', logo: maxvora.url, logoShape: 'square', address: 'Avenida Central do Comércio, 960 — Centro, Ribeirão Preto – SP, CEP 14010-080', annualPrice: 2390, blackFridayPrice: 1590, unlocked: false },
  { id: 'upstock', name: 'UPSTOCK Brasil', logo: upstock.url, logoShape: 'square', address: 'Rua das Acácias, 521 — Jardim Europa, São José dos Campos – SP, CEP 12243-180', annualPrice: 2890, blackFridayPrice: 1890, unlocked: false },
  { id: 'nexcell', name: 'NEXCELL Imports', logo: nexcell.url, logoShape: 'square', address: 'Avenida Parque Industrial, 1330 — Distrito Industrial, Sorocaba – SP, CEP 18087-110', annualPrice: 3790, blackFridayPrice: 2490, unlocked: false },
  { id: 'orvex', name: 'ORVEX Commerce', logo: orvex.url, logoShape: 'square', address: 'Rua Portal do Sol, 445 — Centro, Londrina – PR, CEP 86010-260', annualPrice: 4490, blackFridayPrice: 2990, unlocked: false },
  { id: 'green-sellers', name: 'Green Sellers', logo: greenLogo, logoShape: 'wide', address: 'Rua Barão de Duprat, 287 — Sala 204, 2º andar, Centro, São Paulo — SP, 01023-000', annualPrice: 3978, blackFridayPrice: 2690, unlocked: false },
  { id: 'multiplace', name: 'Multiplace', logo: multiLogo, logoShape: 'wide', address: 'Rua Florêncio de Abreu, 451 — Sala 712, 7º andar, Centro, São Paulo — SP, 01029-000', annualPrice: 4250, blackFridayPrice: 2890, unlocked: false },
  { id: 'promovale', name: 'PromoVale', logo: promoLogo, logoShape: 'wide', address: 'Rua do Comércio, 126 — Sala 305, 3º andar, Centro, São Paulo — SP, 01012-000', annualPrice: 4690, blackFridayPrice: 3190, unlocked: false },
  { id: 'jb-imports', name: 'JB Imports', logo: jbLogo, logoShape: 'wide', address: 'Rua General Carneiro, 338 — Sala 508, 5º andar, Centro, São Paulo — SP, 01022-000', annualPrice: 4990, blackFridayPrice: 3390, unlocked: false },
];

/** Price shown to customers: Black Friday price, never below the floor. */
export function supplierPricing(s: Supplier) {
  if (s.unlocked || !s.annualPrice) return null;
  const promo = Math.max(BLACK_FRIDAY_FLOOR, s.blackFridayPrice ?? s.annualPrice);
  const price = Math.min(promo, s.annualPrice);
  return { original: s.annualPrice, price, discountPct: Math.round((1 - price / s.annualPrice) * 100) };
}
