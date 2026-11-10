# Unificar o painel de vendas

## O que será alterado
- Remover “Vendas em Tempo Real” do menu lateral.
- Adicionar duas abas dentro de “Dashboard de Vendas”: **Ao vivo** e **Histórico**.
- Abrir o dashboard diretamente na aba **Ao vivo**, com visual escuro premium inspirado na foto: faixa laranja, faturamento do dia em destaque, relógio, indicadores, gráfico, vendas recentes e ranking de produtos.
- Manter o dashboard atual completo na aba **Histórico**, sem remover filtros, calendário, métricas ou tabela.
- Fazer o endereço antigo de vendas em tempo real levar ao dashboard, evitando página quebrada.

## Dados e comportamento
- Reutilizar exatamente a fonte de vendas, cálculos, permissões e atualização automática já existentes.
- Não alterar banco de dados, pedidos, checkout, produtos, comissões, autenticação ou regras de acesso.
- Não usar valores fixos: faturamento, pedidos, unidades, conversão, gráfico e ranking continuarão derivados dos dados atuais.

## Verificação
- Conferir desktop e celular, incluindo abas, legibilidade, gráfico e ausência de sobreposição.
- Confirmar que usuários comuns continuam sem acesso ao painel e que parceiros/admins veem os mesmos dados existentes.
- Validar o endereço antigo, o carregamento sem erros e o funcionamento dos controles do histórico.
