# Página de vendas individual por parceiro

## Objetivo
Substituir o uso de cupons por um endereço individual configurável para cada parceiro, no formato `/fornecedor/slug`, ligado diretamente aos dois checkouts daquele parceiro.

## Alterações
- Adicionar ao cadastro de parceiros no Admin o campo **Slug da página**, aceitando letras minúsculas, números e hífens, com validação de endereço único.
- Mostrar no Admin o endereço completo da página individual, com opções de copiar e testar.
- Criar a página pública `/fornecedor/slug` com o visual e os planos atuais, sem campo, aviso ou lógica de cupom.
- Resolver o parceiro pelo slug no servidor e usar exclusivamente os checkouts mensal e anual/vitalício cadastrados para ele.
- Exibir indisponibilidade quando o slug não existir, o parceiro estiver inativo ou os checkouts não estiverem prontos.
- Adicionar no menu lateral do PAS um pequeno atalho **Minha página de vendas**, visível somente para parceiros ativos que já tenham slug configurado.
- Remover do fluxo de parceiros a criação, edição, compartilhamento e resolução por cupom; o endereço antigo com `?cupom=` deixa de liberar ofertas.
- Gerar slugs iniciais únicos para os parceiros já cadastrados, permitindo que o proprietário os altere depois no Admin.

## Segurança
- A página pública receberá somente nome e checkouts do parceiro ativo correspondente ao slug informado.
- A lista de parceiros, e-mails, observações e dados de outras contas continuará privada.
- A identificação do parceiro e a exibição do atalho continuarão validadas pelo acesso autenticado no servidor.

## Verificação
- Configurar e alterar uma slug no Admin e confirmar a unicidade.
- Abrir duas páginas de parceiros e confirmar que cada uma usa apenas seus próprios checkouts.
- Confirmar que o atalho aparece somente para o parceiro correto e não aparece para clientes ou administradores sem perfil de parceiro.
- Confirmar que URLs antigas com cupom não liberam mais a oferta.
- Validar em computador e celular, além da compilação atual.
