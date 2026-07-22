import { Product, ProductPriceTable } from '../../drizzle/schema';

export type ProductStarRating = 'A' | 'B' | 'C';

/**
 * Mapeamento fixo entre o nível de estrela do lead (contato) e a segmentação
 * de preço/mídia do produto: 1→C (padrão), 2→B (intermediário), 3→A (premium).
 * Regra de negócio original em frontend-spec-star-level-e-tabela-precos.md,
 * seção "Mapeamento lead → tier de produto" — mesmo mapeamento usado pelo
 * bot de cotação individual (ai.service.ts `starLevelToProductTier`) e pela
 * tela de Tabelas de Preços do painel.
 */
export function mapStarLevelToProductRating(
  starLevel: number | string,
): ProductStarRating {
  const level = String(starLevel);
  if (level === '3') return 'A';
  if (level === '2') return 'B';
  return 'C';
}

/** Remove zeros decimais desnecessários (ex: "10.000" -> "10", "1.500" -> "1.5"). */
function formatQuantity(value: string): string {
  return String(parseFloat(value));
}

export interface CampaignCatalogProduct {
  product: Product;
  priceEntries: ProductPriceTable[];
}

/**
 * Monta o texto consolidado da tabela de preços enviado no disparo recorrente.
 * O preço exibido depende do starRating do PRODUTO (A/B/C), calculado a partir
 * do starLevel do lead que vai receber — cada contato pode ver uma faixa
 * diferente mesmo dentro do mesmo ciclo (campanha "Todos").
 *
 * `omitFooter`: quando a campanha tem mensagem de salve própria (script "Salve",
 * SCRIPT_SALVE_SLICE.md seção 3), o rodapé fixo de call-to-action é omitido —
 * a chamada já foi feita pela mensagem do usuário.
 */
export function buildCatalogMessage(
  catalogProducts: CampaignCatalogProduct[],
  starRating: ProductStarRating,
  options: { omitFooter?: boolean } = {},
): string {
  const blocks: string[] = [];

  for (const { product, priceEntries } of catalogProducts) {
    const entriesForRating = priceEntries.filter(
      (e) => e.starRating === starRating || e.starRating === 'TODOS',
    );
    if (entriesForRating.length === 0) continue;

    const lines = [`📦 ${product.name}`];
    if (product.description) {
      lines.push(product.description);
    }

    for (const entry of entriesForRating) {
      const min = formatQuantity(entry.minQuantity);
      const max = entry.maxQuantity ? formatQuantity(entry.maxQuantity) : null;
      const range = max ? `${min}–${max}` : `${min}+`;
      const discount =
        Number(entry.maxDiscountPct) > 0
          ? ` (desc. até ${Number(entry.maxDiscountPct)}%)`
          : '';
      lines.push(
        `• ${range} ${product.unit}: R$ ${Number(entry.unitPrice).toFixed(2)}/${product.unit}${discount}`,
      );
    }

    blocks.push(lines.join('\n'));
  }

  const parts = [
    'Tabela de Preços',
    'Condições especiais para clientes ⭐',
    '',
    blocks.join('\n\n'),
  ];

  if (!options.omitFooter) {
    parts.push(
      '',
      'Preços válidos hoje. Da um salve se quiser fechar batida com nós! 💬',
    );
  }

  return parts.join('\n');
}
