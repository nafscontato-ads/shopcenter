# Página de vendas exclusiva para fornecedores

## Alterações
- Manter a página principal `/` exatamente como está: preços promocionais diretos, sem campo ou lógica de cupom.
- Criar a página pública `/fornecedor` com o mesmo conteúdo e visual da página principal, mas com campo para aplicar o cupom individual do afiliado.
- Aceitar também links compartilhados no formato `/fornecedor?cupom=CODIGO`, validar o cupom no painel de parceiros e mostrar a condição correspondente.
- Após a validação, usar exclusivamente os dois checkouts cadastrados para aquele afiliado; nenhum cupom poderá cair no checkout de outro parceiro.
- Atualizar o link compartilhado na área Top Seller para apontar para `/fornecedor?cupom=CODIGO`.
- Manter os valores promocionais e benefícios já definidos para cupons válidos e informar claramente cupom inválido ou parceiro sem checkout configurado.

## Validação
- Confirmar que `/` continua sem cupom.
- Confirmar aplicação manual e automática do cupom em `/fornecedor`.
- Confirmar que os botões mensal e anual/vitalício abrem os checkouts do afiliado correto.
- Conferir o fluxo em computador e celular.
