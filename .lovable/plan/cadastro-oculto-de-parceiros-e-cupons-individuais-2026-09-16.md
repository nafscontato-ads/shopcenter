# Cadastro oculto de parceiros e cupons individuais

## Objetivo
Concluir a página reservada `/cadastroprodutoresespancadores` para criar parceiros com acesso completo às áreas de vendas e cupons do PAS, sem qualquer permissão administrativa.

## Alterações
- Criar o cadastro reservado com nome, e-mail, senha e confirmação, seguindo o visual e as validações do cadastro de clientes.
- Após criar a conta, ativar o perfil e vinculá-lo automaticamente a um perfil de parceiro, liberando Dashboard de Vendas, Top Seller, catálogo e demais áreas de parceiro.
- Não criar nenhuma função administrativa para o novo usuário; o painel administrativo continuará dependente exclusivamente do cadastro separado de administradores.
- Criar o parceiro inicialmente sem cupom público ativo, para o proprietário definir depois o código e os dois links de checkout no painel administrativo.
- Manter o painel de parceiros como fonte única: ao salvar código, status ou links de checkout, a página de vendas passa a resolver imediatamente aquele cupom para os links daquele parceiro.
- Garantir que o cupom do proprietário continue usando os links do próprio proprietário e que cada outro cupom use somente os links configurados para seu parceiro.
- Evitar resultados antigos no navegador ao consultar cupons, para alterações administrativas aparecerem imediatamente na página de vendas.
- Marcar a página reservada para não aparecer em buscadores e não criar links públicos para ela.

## Segurança
O cadastro concede papel de parceiro, nunca de administrador. Como a proteção solicitada é apenas pela slug oculta, qualquer pessoa que receba ou descubra esse endereço poderá criar uma conta de parceiro; o endereço não será divulgado na navegação pública.

## Validação
- Testar cadastro e entrada automática.
- Confirmar acesso ao Dashboard de Vendas e Top Seller.
- Confirmar bloqueio do painel administrativo.
- Testar dois cupons diferentes e verificar que cada um abre seus próprios checkouts, inclusive após alteração no painel.
- Conferir computador e celular.
