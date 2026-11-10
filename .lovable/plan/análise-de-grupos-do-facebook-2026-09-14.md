# Análise de grupos do Facebook

## Objetivo
Adicionar à área **Divulgar no Facebook** uma aba de análise diária que mostre, de forma simples, quais grupos têm maior potencial de vendas nas últimas 24 horas.

## O que será alterado
- Criar duas opções no topo da página: **Analisar grupos** e **Criar divulgação**.
- Abrir a página inicialmente em **Analisar grupos**.
- Reaproveitar todos os grupos já cadastrados no PAS e ordená-los por vendas nas últimas 24 horas.
- Destacar um ranking dos melhores grupos do dia, com posição, imagem, nome, quantidade de membros, nível de engajamento e texto **“X vendas em 24 horas”**.
- Garantir que os cinco primeiros apareçam com mais de 378 vendas; os demais terão resultados menores e variados.
- Exibir um resumo com total de grupos analisados, vendas identificadas e horário da última análise.
- Permitir abrir o grupo no Facebook ou seguir direto para a divulgação usando o grupo escolhido.
- Manter intacto o fluxo atual de escolher grupo, produto, copy e publicar.
- Ajustar a apresentação para celular e computador usando o visual atual do PAS.

## Detalhes técnicos
- Os resultados serão determinísticos por grupo e pelo dia atual, evitando números mudando a cada atualização da página.
- A ordenação e os indicadores serão calculados na interface a partir da lista existente de grupos, sem alterar os cadastros nem criar vendas reais no banco.
- A página continuará protegida pelo acesso já existente do PAS.
