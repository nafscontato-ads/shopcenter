# Corrigir falsas expirações das lojas Shopee

## Objetivo
Manter a loja conectada e publicar normalmente mesmo quando a Shopee invalidar ou trocar o token antes do horário previsto.

## Alterações
- Detectar respostas reais de autorização/token sem confundir outros erros da Shopee com loja expirada.
- Ao receber token inválido durante sincronização, consulta ou publicação, renovar automaticamente a autorização e repetir a operação uma vez.
- Proteger a renovação contra duas solicitações simultâneas, reutilizando o token novo salvo pela primeira delas.
- Preservar a conexão recém-refeita e substituir corretamente tokens antigos da mesma loja.
- Manter o pedido de reconexão apenas quando o token de renovação também tiver sido realmente recusado pela Shopee.
- Registrar a causa técnica sem expor tokens e mostrar uma mensagem clara ao cliente.

## Validação
- Confirmar renovação automática de conexão vencida.
- Confirmar que uma reconexão recente não reutiliza token antigo.
- Testar carregamento das opções da loja e início da publicação sem falsa mensagem de expiração.
- Conferir compilação e erros em execução.
