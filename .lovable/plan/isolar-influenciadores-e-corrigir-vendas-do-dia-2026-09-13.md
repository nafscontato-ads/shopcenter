# Isolar influenciadores e corrigir vendas do dia

## Objetivo
- Cada conta verá, usará, duplicará e excluirá somente os próprios influenciadores.
- O painel **Ao vivo** mostrará exatamente o mesmo faturamento do dia exibido no **Histórico**.
- Ao mudar o dia no horário de São Paulo, os eventos temporários do dia anterior serão descartados automaticamente.

## Implementação
1. Reforçar as regras do banco para que influenciadores sejam acessíveis apenas quando `user_id` for o usuário autenticado.
2. Adicionar a mesma verificação de proprietário nas leituras e ações do aplicativo, inclusive ao gerar conteúdo no Studio.
3. Vincular imagens enviadas a uma pasta exclusiva da conta para impedir mistura entre usuários.
4. Usar uma única fonte diária no Ao vivo e no Histórico, removendo a soma que hoje duplica valores simulados.
5. Detectar a virada do dia no fuso de São Paulo, limpar vendas temporárias antigas e recalcular os dois painéis.
6. Validar duas contas separadas, a igualdade dos totais e o reinício diário.

## Detalhes técnicos
- A proteção será aplicada tanto no banco quanto nas consultas, evitando vazamento mesmo se uma tela chamar a função errada.
- Registros antigos já têm proprietário; nenhum influenciador será apagado.
- Não serão alterados preços, produtos, autenticação ou regras de comissão.
