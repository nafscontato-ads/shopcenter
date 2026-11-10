# Fechar cadastros e liberar clientes manualmente

## Objetivo
Impedir que qualquer pessoa crie uma conta ou acesse a plataforma sem autorização. Somente o administrador poderá liberar um e-mail comprado.

## Alterações
- Desativar novos cadastros no serviço de autenticação, incluindo criação automática por Google.
- Remover a página pública `/cadastro` e qualquer botão ou texto de criação de conta.
- Exigir sessão válida e conta ativa em todas as páginas internas; manter públicas apenas vendas, login e recuperação de senha.
- Fazer o login Google funcionar somente para contas já liberadas, recusando e removendo qualquer criação não autorizada.
- Adicionar na área administrativa de usuários um formulário para liberar um cliente por nome, Gmail e senha temporária.
- Criar a conta pelo servidor, marcar o perfil como ativo e registrar a ação administrativa.
- Ao suspender uma conta, encerrar seu acesso e bloquear as funções privadas no servidor.
- Revisar os caminhos de geração e dados privados para garantir validação de acesso no servidor.

## Resultado esperado
Uma compra não cria acesso sozinha. Você cadastra o Gmail do cliente no painel administrativo e entrega a senha; fora disso, ninguém entra gratuitamente.

## Observação técnica
A proteção será aplicada tanto nas telas quanto nas operações privadas. A página de vendas continuará pública, e login/recuperação continuarão disponíveis apenas para contas já criadas.
