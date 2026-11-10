# Corrigir e completar a integração Shopee

## Diagnóstico confirmado
- O Partner ID configurado foi testado diretamente nos endereços oficiais da Shopee.
- A Shopee retorna `invalid_partner_id` no ambiente real do Brasil e aceita o mesmo ID somente no Sandbox.
- Credenciais Sandbox não permitem que clientes conectem lojas reais. Para o fluxo final, o aplicativo precisa estar aprovado/ativo em produção na Shopee Open Platform e fornecer o Partner ID e Partner Key de produção.

## O que será ajustado
1. **Conexão individual por cliente**
   - Cada usuário continuará clicando em **Integrar minha Shopee**, entrando na própria conta Shopee e autorizando apenas sua loja.
   - A conexão, os tokens, os anúncios e os produtos sincronizados continuarão isolados por usuário.
   - Adicionar renovação automática da autorização para evitar desconexões por expiração.

2. **Diagnóstico correto das credenciais**
   - Validar o ambiente e a disponibilidade do aplicativo antes de enviar o cliente à Shopee.
   - Substituir a mensagem genérica por um aviso claro quando as credenciais forem de Sandbox, estiverem pendentes de aprovação ou não pertencerem ao ambiente brasileiro de produção.
   - Manter a URL de retorno oficial: `https://sistemapas.online/api/public/shopee/callback`.

3. **Publicar produtos do PAS**
   - Manter a seleção de produtos do catálogo com todas as imagens disponíveis.
   - Permitir editar título, descrição, imagens, preço, estoque, SKU, categoria, atributos, peso, dimensões e envio antes de publicar.
   - Buscar categorias, atributos e canais de envio diretamente da loja conectada, evitando exigir códigos digitados manualmente.

4. **Trazer produtos da própria loja Shopee**
   - Adicionar uma aba **Produtos da minha Shopee**.
   - Sincronizar os anúncios existentes da loja conectada, incluindo imagens, título, descrição, preço, estoque, variações e situação.
   - Permitir abrir, editar e atualizar esses anúncios pelo PAS.
   - A API oficial não será usada para copiar livremente anúncios de lojas de terceiros; apenas produtos do PAS e da loja que o cliente autorizou.

5. **Validação final**
   - Testar isolamento entre contas, conexão, renovação, importação, criação e atualização de anúncios.
   - Validar mensagens de erro e funcionamento em computador e celular.

## Dependência externa
A interface e o fluxo podem ser preparados agora, mas a conexão com lojas reais só funcionará após substituir as credenciais atuais de Sandbox pelas credenciais de produção aprovadas pela Shopee.
