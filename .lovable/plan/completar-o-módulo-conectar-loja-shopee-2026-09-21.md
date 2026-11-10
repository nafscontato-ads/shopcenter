# Completar o módulo Conectar Loja Shopee

## Objetivo
Transformar a área existente em uma central completa para cada cliente conectar e administrar sua própria loja Shopee, preservando o restante do PAS e exibindo apenas dados confirmados pela API oficial.

## O que será construído

### 1. Conexão e lojas
- Manter o OAuth oficial, sem solicitar senha da Shopee dentro do PAS.
- Exibir loja, Shop ID, região, estado da conexão e última sincronização.
- Adicionar sincronização manual, reconexão e desconexão.
- Preparar múltiplas lojas por conta, com seletor explícito e isolamento total entre lojas.

### 2. Painel da loja
- Criar uma visão resumida com produtos, pedidos, vendas, faturamento, itens ativos e sem estoque.
- Exibir saúde da integração, horário da última sincronização e erros recentes.
- Não misturar esses números com o Dashboard de Vendas simulado já existente.

### 3. Produtos e publicação
- Importar anúncios da loja conectada com fotos, SKU, categoria, preço, estoque, estado e sincronização.
- Permitir editar, duplicar, arquivar quando a API permitir, sincronizar e abrir o anúncio.
- Aprimorar o editor do catálogo PAS com atributos obrigatórios, variações, logística, imagens e validação antes do envio.
- Confirmar publicação somente após uma resposta válida da Shopee e manter estados claros de processamento, sucesso e falha.
- Criar fila segura para publicação de vários produtos e repetição apenas dos itens que falharem.

### 4. Estoque e edição em massa
- Adicionar seleção múltipla e prévia antes de alterar preço ou estoque.
- Exibir estados sem estoque, estoque baixo e normal, com limite configurável por loja.
- Disponibilizar regras automáticas somente para ações oficialmente suportadas.

### 5. Pedidos e desempenho
- Sincronizar pedidos e estados fornecidos pela Shopee, mostrando apenas informações permitidas.
- Criar filtros por situação e um painel de vendas, faturamento, ticket médio, produtos mais vendidos, cancelamentos e devoluções.
- Exibir estados vazios ou indisponíveis quando a permissão não estiver liberada, sem inventar números.

### 6. IA segura
- Adicionar melhoria de título, geração de descrição, análise do anúncio e sugestões aplicáveis.
- Usar somente informações reais do produto; a IA não poderá inventar características.
- Análise de mercado só aparecerá quando houver uma fonte oficial/autorizada de dados.

### 7. Segurança e confiabilidade
- Manter tokens somente no servidor e nunca retorná-los à tela.
- Vincular toda operação ao usuário autenticado e à loja selecionada.
- Adicionar registros de sincronização e erros, proteção contra duplicação, controle de tentativas e tratamento humano das mensagens da Shopee.
- Preparar recebimento seguro das notificações oficiais disponíveis, com validação da origem.

## Estrutura da tela
- Cabeçalho de conexão/loja ativa.
- Navegação compacta: Visão geral, Produtos, Pedidos, Desempenho, Automações e Atividade.
- Fluxo principal: escolher produto → otimizar/revisar → validar → publicar → acompanhar confirmação.
- Interface escura, minimalista, responsiva e alinhada ao PAS atual.

## Validação
- Conferir conexão OAuth, renovação de autorização, isolamento entre usuários e lojas, permissões e políticas de acesso.
- Testar publicação, edição, sincronização, erros, repetição segura e estados intermediários.
- Validar computador e celular, além da compilação e erros em execução.
- Recursos dependentes de permissões ainda não aprovadas pela Shopee ficarão identificados como indisponíveis, nunca simulados.
