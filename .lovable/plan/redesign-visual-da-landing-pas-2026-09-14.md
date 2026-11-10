# Redesign visual da landing PAS

## Objetivo
Dar à página pública do PAS uma identidade própria de afiliados de e-commerce brasileiro, mantendo exatamente a estrutura, os textos e o funcionamento atuais.

## Alterações visuais
- Criar uma paleta de landing com grafite quente, laranja Shopee, terracota de apoio e verde mais discreto, sem afetar as áreas internas do PAS.
- Adotar uma fonte display condensada e comercial nos títulos e uma fonte de leitura com números tabulares no restante da página.
- Redesenhar o topo sem o badge genérico em cápsula e sem seta no botão principal.
- Transformar o painel financeiro no principal elemento visual, destacando primeiro a comissão e diferenciando faturamento e pedidos por peso e composição.
- Dar protagonismo aos três diferenciais “Sem precisar aparecer”, “Sem gravar vídeo” e “Funciona pelo celular”.
- Variar cantos, bordas, profundidade e composição dos blocos conforme a importância, reduzindo a aparência repetitiva de cards iguais.
- Remover orbes decorativos e fades genéricos; concentrar movimento em uma única animação coordenada do gráfico e dos números do painel, respeitando redução de movimento.

## Escopo técnico
- Ajustar os tokens e utilitários exclusivos da landing em `src/styles.css`.
- Atualizar a composição visual em `src/routes/index.tsx` e o painel em `src/components/pas/landing.tsx`.
- Carregar as duas famílias tipográficas pela configuração de cabeçalho existente.
- Não alterar preços, links, textos, seções, autenticação, dados ou a página `/v2`.

## Validação
- Conferir a landing em desktop e celular, incluindo legibilidade, hierarquia do painel e ausência de sobreposição.
- Confirmar que o conteúdo e as ações continuam iguais e que a página abre sem erros.
