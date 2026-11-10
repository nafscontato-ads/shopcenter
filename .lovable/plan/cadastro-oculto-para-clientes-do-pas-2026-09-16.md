# Cadastro oculto para clientes do PAS

## Objetivo
Criar a página pública `/cadastrar`, conhecida e compartilhada somente pelo proprietário, para que compradores criem sua própria conta e entrem imediatamente no PAS como clientes ativos.

## Alterações
- Criar uma página de cadastro coerente com a identidade visual do PAS, solicitando nome completo, e-mail e senha com confirmação.
- Criar a conta com e-mail e senha, gravando o nome no perfil já existente e liberando o perfil automaticamente como cliente ativo.
- Entrar automaticamente após o cadastro e levar o cliente ao Catálogo.
- Tratar e-mails já cadastrados, senhas fracas e falhas de cadastro com mensagens claras.
- Adicionar na tela de login apenas uma orientação discreta para compradores usarem o link recebido, sem divulgar nem criar navegação pública para `/cadastrar`.
- Manter Google, cadastro anônimo e qualquer outra forma de criação de conta desativados.
- Validar cadastro, acesso imediato e apresentação em computador e celular.

## Observação de segurança
A proteção será apenas pelo endereço oculto, conforme escolhido. Qualquer pessoa que receba ou descubra `/cadastrar` poderá criar uma conta ativa; o endereço não será exibido nos menus nem na página pública.
