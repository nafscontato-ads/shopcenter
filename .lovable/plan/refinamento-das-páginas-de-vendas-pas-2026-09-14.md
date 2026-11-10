# Refinamento das páginas de vendas PAS

## Objetivo
Deixar as páginas `/` e `/v2` mais bonitas, comerciais e curtas, mantendo as informações, preços e destinos de compra atuais. A V2 seguirá uma composição mais direta inspirada na densidade visual da Multiplace, sem copiar identidade ou conteúdo.

## Página oficial (`/`)
- Compactar o topo, os blocos de benefícios, catálogo, funcionamento, recursos, planos e dúvidas, reduzindo espaços excessivos e repetições visuais sem remover as informações existentes.
- Reforçar a hierarquia comercial: resultado financeiro e benefícios primeiro, demonstração do produto em seguida e planos mais fáceis de comparar.
- Preservar integralmente os preços e regras atuais: sem cupom, Vitalício R$ 597,90 e Mensal R$ 319,90; com cupom válido, Vitalício R$ 295,90 à vista ou 12x de R$ 31,53 e Mensal R$ 179,90/mês.
- Preservar os checkouts já configurados e o campo de cupom somente nesta página.
- Após aplicar um cupom válido, mostrar um aviso destacado com contagem regressiva de 10 minutos e a mensagem de que outras 9 pessoas também estão vendo o cupom.
- Iniciar a contagem no navegador quando o cupom for validado, mantê-la correta ao atualizar a página e remover o aviso ao retirar ou trocar o cupom.
- Ao chegar a zero, informar que o período terminou e permitir reaplicar o cupom, sem alterar a validade real configurada no sistema.

## Página V2 (`/v2`)
- Manter a página totalmente sem campo, aviso ou lógica de cupom.
- Criar uma apresentação mais enxuta e direta: topo forte, benefícios consolidados, visão do produto, planos, garantia e dúvidas em sequência curta.
- Reorganizar informações hoje espalhadas em muitos blocos para reduzir o comprimento, sem alterar o significado do conteúdo.
- Manter exatamente os preços atuais: Vitalício R$ 597,90 à vista ou 12x de R$ 63,71; Mensal R$ 197,90/mês.
- Manter exatamente os dois links de checkout atuais.

## Direção visual
- Preservar a identidade PAS já definida: grafite quente, laranja Shopee, terracota e verde de confirmação.
- Usar a tipografia comercial atual, números grandes e composição mais editorial, com menos caixas repetidas e menos espaços vazios.
- Dar destaque aos planos sem transformar toda a página em cartões iguais.
- Manter uma única animação coordenada no painel demonstrativo e respeitar a preferência por movimento reduzido.

## Validação
- Conferir `/` com e sem cupom válido, incluindo persistência e término do relógio de 10 minutos.
- Confirmar que `/v2` não possui nenhuma opção de cupom.
- Verificar preços, links de compra e conteúdo nas duas páginas.
- Testar visual e navegação em computador e celular, sem cortes, sobreposições ou erros.
