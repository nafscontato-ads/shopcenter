# Vendas contínuas no painel dos parceiros

## O que será alterado
- O valor de hoje começará com as vendas já ocorridas até o horário atual, em vez de abrir sempre no total fixo do dia.
- Novas vendas demonstrativas aparecerão continuamente, com intervalos variados entre alguns segundos e 10 minutos.
- As abas **Ao vivo** e **Histórico** continuarão mostrando exatamente os mesmos totais.
- A sequência será estável ao atualizar a página e reiniciará diariamente no horário de São Paulo.

## Detalhes técnicos
- Criar uma linha do tempo diária determinística, revelando somente os eventos cujo horário já chegou.
- Distribuir os horários com intervalos aleatórios de no máximo 10 minutos, sem depender de o painel permanecer aberto.
- Remover do cálculo de hoje qualquer venda futura e atualizar automaticamente a consulta conforme o relógio avança.
- Preservar o histórico dos dias anteriores e as regras de acesso exclusivas dos parceiros.

## Validação
- Conferir crescimento do faturamento, feed, gráfico e ranking nas duas abas.
- Validar atualização e virada do dia em computador e celular.
