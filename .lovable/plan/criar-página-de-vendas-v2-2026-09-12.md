# Criar página de vendas V2

## Objetivo
Criar uma cópia independente da página de vendas em `/v2`, sem alterar preços, cupons ou checkouts da página atual.

## Alterações
- Reutilizar o mesmo conteúdo e visual da página de vendas atual em uma nova rota pública `/v2`.
- Na V2, ocultar a aplicação de cupons para manter o teste isolado.
- Exibir o plano Vitalício por **12x de R$ 63,71** ou **R$ 597,90 à vista**, apontando para o checkout vitalício informado.
- Exibir o plano Mensal por **R$ 197,90/mês**, apontando para o checkout mensal informado.
- Adicionar metadados próprios da página V2 e validar os dois botões de compra.

## Fora do escopo
- Nenhuma alteração na página atual `/`.
- Nenhuma alteração no banco, nos preços oficiais, nos cupons ou nos acessos dos usuários.
