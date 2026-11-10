# Publicação direta do catálogo na Shopee

## Objetivo
Permitir que cada usuário conecte a própria loja Shopee ao PAS, selecione um produto existente do Catálogo Shopee Place, revise todos os dados e publique um novo anúncio sem sair da plataforma.

## O que será criado
- Nova área **Minha loja Shopee** no menu, com estado de conexão, identificação da loja e histórico de anúncios enviados.
- Ação **Publicar na minha Shopee** nos produtos do catálogo e nos produtos salvos.
- Editor de anúncio em etapas:
  1. produto e todas as imagens disponíveis no cadastro oficial;
  2. título, descrição, preço, estoque, SKU e condição;
  3. categoria, atributos obrigatórios, variações e logística conforme as opções retornadas pela Shopee;
  4. revisão final e publicação.
- Tela de resultado com status, erros por campo, código do anúncio e link para abrir o produto publicado na Shopee.
- Edição posterior de título, descrição, preço e estoque para anúncios já publicados pelo PAS.

## Segurança e isolamento
- Cada conta verá e administrará somente a própria conexão e os próprios anúncios.
- As credenciais da loja e tokens da Shopee ficarão protegidos no servidor, nunca expostos na página.
- O retorno de autorização da Shopee validará assinatura e estado antes de vincular a loja.
- Todas as operações de publicação serão revalidadas no servidor e registradas com o retorno da Shopee.

## Dados do catálogo
- Ampliar a leitura atual para entregar descrição, SKU, marca, subcategoria, imagem principal e galeria completa.
- Eliminar imagens repetidas e manter a ordem da imagem principal seguida pelas adicionais.
- Pré-preencher o editor com os dados oficiais existentes, sem alterar o produto original do PAS quando o usuário editar seu anúncio.

## Integração oficial
- Criar o fluxo de autorização da Shopee Open Platform por usuário e o retorno público seguro.
- Implementar upload de imagens, consulta de categorias/atributos/logística, criação do produto, consulta do anúncio e atualização de dados.
- Renovar a autorização da loja quando necessário e apresentar orientação clara se a Shopee rejeitar algum campo.
- Como a Shopee não está disponível nas conexões automáticas do projeto, a publicação real exigirá o **Partner ID** e a **Partner Key** do aplicativo aprovado na Shopee Open Platform. A estrutura e a interface podem ser concluídas antes disso; a conexão real fica bloqueada até essas credenciais serem adicionadas com segurança.

## Validação
- Verificar que usuários diferentes não compartilham loja, rascunhos ou anúncios publicados.
- Testar seleção, galeria, edição, validação de campos, retorno da autorização, falhas da Shopee e abertura do anúncio publicado.
- Validar em computador e celular, além da compilação e dos registros de erro.
