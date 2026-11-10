# Roadmap

## Teste de venda e etiqueta (07/11)
- [x] Venda claramente simulada com PDF demonstrativo, sem chamadas à Shopee
- [x] Conferir geração e download dentro da conta autenticada e no celular

## Novo (31/10 — Black Friday na página de vendas)
- [x] 2 fornecedores (Minipreço e 25 de Março) já incluídos, sem selecionar; planos sempre visíveis
- [x] "Aproveite a Black Friday e pegue 2 fornecedores gratuitos!" com "disponível até" sempre o dia seguinte

## Novo (31/10 — Site mais rápido e celular)
- [x] Fotos menores nas listas, logo/foto principal/logos de fornecedor leves, só as fontes usadas
- [x] Conferir todas as telas no celular e corrigir as que passavam da largura

## Novo (31/10 — Reformulação Shop Center)
- [x] Trocar o nome PAS por Shop Center em todas as telas
- [x] Logo nova redonda
- [x] Tirar o fornecedor Shopee Place; "Catálogo Shopee Place" vira "Catálogos"
- [x] Página de vendas com layout novo, clássico e profissional, mesmas cores
- [x] Visual do painel refinado (menu, topo), funções iguais

## Novo (29/10 — Filtros do catálogo)
- [x] Filtro "Menor custo" (custo do fornecedor do menor ao maior) e "Top Produtos" com bolinha + vendas (300 a 988)

## Novo (29/10 — Tirar cupom BLACK)
- [x] Cupom, aba BLACK FRIDAY, páginas /BLACK e preço de R$ 1.897,89 removidos; Shopee Place volta a aparecer grátis e só selecionar
- [x] Links dos parceiros voltam para /fornecedor; /BLACK antigo redireciona

## Novo (29/10 — Cupom BLACK fixo e /BLACK)
- [x] Aba BLACK FRIDAY: cupom BLACK já selecionado (sem digitar nome), sem "Passe para o pessoal"; parceiro escolhe 1 a 10 usos e aplica
- [x] /BLACK e /BLACK/<número do parceiro> abrem com o cupom aplicado; aplicar BLACK no site muda o endereço para /BLACK
- [x] Links dos parceiros trocados de /fornecedor para /BLACK (links antigos continuam abrindo)

## Novo (29/10 — Mais 4 fornecedores e Integrar fornecedor)
- [x] MAXVORA, UPSTOCK, NEXCELL e ORVEX com logos redondas, endereços na ordem e Black Friday
- [x] Botão INTEGRAR FORNECEDOR no topo de Fornecedores com API DO FORNECEDOR e PDF DO CATÁLOGO (somente visual)

## Novo (29/10 — Publicar do PAS do dono com fotos de todos)
- [x] Só na conta do dono: lista mostra todos os produtos com 2+ fotos escolhidas por qualquer usuário, com título e descrição do catálogo (171 produtos)

## Novo (29/10 — Cupom BLACK e aba BLACK FRIDAY)
- [x] Fornecedores em fileira deslizante, 4 por vez
- [x] Seção CUPOM: BLACK libera a Shopee Place (de R$ 1.897,89/ano para grátis) e mostra FORNECEDOR DESBLOQUEADO!; planos PAS iguais
- [x] Tempo de 5 minutos para usar o cupom; página /black com o cupom já preenchido; ?cupom= em qualquer página de vendas
- [x] Aba BLACK FRIDAY só para dono e parceiros: um cupom próprio com até 10 usos e link para compartilhar

## Novo (29/10 — Fornecedores novos, Black Friday e Vender)
- [x] 7 fornecedores novos com logos redondas, endereços na ordem e preços de R$ 1.589 a R$ 4.998
- [x] Black Friday em todos os premium, nunca abaixo de R$ 1.000 (teste em tests/supplier-directory.test.ts)
- [x] Botão "Desbloquear fornecedor" abre janela com marketplaces e "Selecionar fornecedor"
- [x] Shopee Place liberada para todos com botão "Vender" → tela de marketplaces; Shopee leva à integração
- [x] Logos reais dos 6 marketplaces (inclui Meli+) em quadradinhos com botão Integrar → tela de integração
- [x] Bolinhas de marketplaces na integração (somente visual; Shopee sempre marcada)

## Novo (21/10 — Tirar todas as travas)
- [x] Nenhuma trava local de publicação; selo Indisponível desligado
- [x] Fabricante ausente preenchido com a marca ou TUDO POR MENOS
- [ ] Publicar o site para os clientes receberem as correções (aguarda o dono clicar em Publicar)

## Novo (21/10 — Colar dados da página da Shopee por produto)
- [x] Caixa "Dados da página da Shopee" na aba Shopee / Exigências: lê categoria, características e descrição e salva no catálogo para todos os alunos
- [x] Publicação e checagem usam a trilha colada para a categoria e os valores colados nas características (substituem padrões)
- [x] Cozedor de ovos 110V colado e salvo; testes com o texto real
- [ ] Publicação real de teste: aguarda reconectar a Loja Tudo dih Bom (desconectada hoje às 10:04)

## Novo (21/10 — Juntar o novo pipeline Shopee ao PAS)
- [x] Trava contra clique duplo e histórico por loja/produto (shopee_publications), com leitura pelo aluno das próprias lojas
- [x] Publicação usa os dados de exigências do catálogo (EAN, ANATEL, ANVISA, INMETRO, peça, tabela, categoria) antes dos padrões do dono
- [x] Travar só documentos: homologação, ANVISA, INMETRO, EAN obrigatório e declaração de rádio; o resto segue para a Shopee
- [x] Resultado por status na tela do aluno (publicado, aviso, parcial, em andamento, erro), sem inglês e sem dica de admin
- [x] Aba "Shopee / Exigências" no produto do admin, com checagem individual e upload da tabela de medidas
- [x] Página "Checagem Shopee" no admin: lotes, progresso, filtro e CSV (validada com 8 produtos; checagem completa fica a critério do dono)
- [x] Selo "Indisponível na Shopee no momento" e botão desabilitado no catálogo do aluno
- [x] Remover mensagens antigas que mandam falar com o grupo

## Novo (19/10 — Shopee Place pré-selecionada na página de vendas)
- [x] Abrir a página de vendas com a Shopee Place já selecionada, sem exigir clique, mantendo a janela de 5 minutos da aba
- [x] Isolar a regra em `src/lib/supplier-selection.ts` e cobri-la com testes (abertura, aba preservada, expiração, dado inválido)
- [x] Validar em `/` e `/fornecedor/1`: planos visíveis na abertura, cronômetro em execução, sem erros de execução

## Novo (17/10 — Cadastro sem confirmação por e-mail)
- [x] Ativar confirmação automática das novas contas sem permitir cadastro anônimo nem alterar privilégios
- [x] Atualizar a orientação em `/cadastrar` para entrada imediata
- [x] Validar configuração hospedada e cadastro real: resposta 200, sessão imediata, e-mail automaticamente confirmado e entrada no PAS em `/produtos` com seleção inicial da área; sem erros de execução

## Novo (16/10 — Publicar todo o catálogo, autorizado pelo proprietário)
- [x] Conferir a conta autenticada: a única conexão real disponível é Loja Tudo dih Bom; as demais lojas exibidas são demonstrativas
- [x] Proprietário confirmou Loja Tudo dih Bom como destinatária
- [x] Processar os 506 produtos do catálogo: 291 publicados e confirmados, 23 produtos existentes preservados, 191 recusados pela Shopee e 1 sem foto disponível
- [x] Conferir a lista oficial: 320 anúncios NORMAL; lista de produtos da loja validada na interface
- [x] Retestar e confirmar anúncios preservados 58270452120 (variações) e 58220308933 (umidificador), sem criar duplicatas
- [ ] Completar 192 pendências com fatos do fornecedor: 110 tabelas de medidas, 23 Item Code, 23 fabricantes, 13 Registration ID, 7 GTIN, 7 Assembly, 4 Electrical Cables, 2 Auto-Part Number, 1 incompatibilidade fabricante/modelo/registro, 1 Connection Type e 1 produto sem foto; exigências externas não podem ser removidas pelo PAS

## Novo (15/10 — Remover bloqueios internos de publicação)
- [x] Melhorar a resolução oficial de categorias sem escolher categorias sem relação; corrigir família de creatina e ampliar correspondência por caminho
- [x] Enviar dados confirmados mesmo quando faltam atributos ou tabela de medidas, deixando a Shopee decidir a aceitação
- [x] Validar 39 testes e abrir preparação autenticada do pijama com loja conectada; compilação sem erros
- [x] Aceitação real testada em todo o catálogo em 16/10: Shopee confirmou publicações e recusou 191 produtos por seus próprios requisitos; 1 sem foto

## Novo (14/10 — Variações completas de produtos)
- [x] Adicionar editor opcional de cores e tamanhos com combinações automáticas, preço, estoque, SKU, imagem, status e disponibilidade
- [x] Vincular cada combinação ao estoque programado, limitando ajustes a 1.000 unidades para baixo ou para cima
- [x] Persistir e restaurar as combinações por rascunho e loja, preservando produtos simples
- [x] Publicar e confirmar modelos pela API oficial sem duplicar anúncios em retentativas; indicar a etapa exata da falha
- [x] Testar produto simples, só cores, só tamanhos, cores+tamanhos, valores, imagens, limites e persistência autenticada; 15 testes passaram
- [x] Publicação real com variações confirmada em 16/10: retentativa reutilizou e confirmou o anúncio 58270452120

## Novo (14/10 — Erros de publicação dos clientes)
- [x] Categoria pela recomendação oficial da Shopee (12 de 19 produtos travados liberados na simulação)
- [x] Ler ANVISA/homologação/INMETRO/fabricante das descrições e fotos de embalagem
- [ ] Cosméticos, suplementos e fones: aguardam códigos reais do fornecedor

## Novo (14/10 — Códigos ANVISA e GTIN)
- [x] Preencher automaticamente ANVISA e GTIN quando o código real estiver identificado no cadastro ou nos dados estruturados do fornecedor
- [x] Validar formato e dígito verificador de GTIN-8/12/13/14 e rejeitar números inventados, inválidos ou sem identificação
- [x] Vincular o GTIN confirmado 0789888568900 ao cozedor elétrico de ovos e enviá-lo automaticamente no atributo exigido pela Shopee, sem reutilizá-lo em produtos diferentes
- [ ] Completar no catálogo os códigos ausentes com dados oficiais dos fornecedores; as páginas públicas atuais não disponibilizam esses identificadores

## Novo (12/10 — Preservar descrições)
- [x] Restaurar descrições salvas, reutilizar o anúncio anterior ao preparar um produto e impedir substituição por texto vazio
- [x] Incorporar 21 descrições dos alunos em produtos gerais sem texto; preservar descrições gerais existentes e versões diferentes nos anúncios dos alunos, sem juntar textos conflitantes
- [x] Validar salvamento vazio e reabertura autenticados de descrição com 1537 caracteres, inclusive pelo atalho do produto; 20 testes passaram, sem publicar anúncios

## Novo (12/10 — Teste completo autorizado)
- [x] Testar sessão autenticada, sincronização oficial, preparação com título/margem/MAX e publicação real: oito produtos distintos; cinco confirmados na Shopee (arranjo, escova de limpeza, ferramentas, sanduicheira e porta-retrato)
- [x] Corrigir seleção automática que confundia famílias/categorias e atributos antigos em atualizações; 16 testes passaram e cinco anúncios confirmados na interface e pela consulta oficial
- [ ] Fone: fornecedor precisa informar fabricante; umidificador ainda exige GTIN real; cozedor usa o GTIN confirmado pelo proprietário
- [ ] Retirar anúncios de teste do umidificador e cozedor criados antes da correção de categoria: atualização para categoria adequada exige GTIN; desativação recusada pela Shopee e tentativa de zerar estoque também recusada. Titular precisa retirar esses dois anúncios pela Central de Vendedores
- [ ] Matching geral ainda precisa revisão por tipo: auditoria de leitura identificou títulos ambíguos em roupas e outros produtos; cinco publicações válidas não garantem todo o catálogo

## Novo (12/10 — Preparação automática e catálogo compartilhado)
- [x] Simplificar preparação para título, margem e MAX; resolver categoria automaticamente no servidor sem contornar regras da Shopee
- [x] Conferir contribuições de anúncios publicados: preencher 221 descrições vazias e copiar 99 fotos revisadas de 28 produtos ao acervo geral, preservando dados existentes
- [x] Validar preparação autenticada com título, margem e MAX e salvar rascunho; testes passaram, sem publicar anúncios reais

## Novo (09/10 — Erros dos clientes)
- [x] Levantar erros persistidos de geração, publicação e sincronização e registros publicados da última hora
- [x] Corrigir janela de pedidos, duplicação nas fronteiras, descrição vazia e aviso enganoso de sucesso parcial; 12 testes passaram
- [x] Validar sincronização real autenticada: 14 produtos, zero pedidos retornados, sem aviso de período inválido; nenhum anúncio publicado
- [x] Explicar pendências externas e limites do histórico disponível
- [ ] Geração de imagens: créditos do projeto Google esgotados; depende de recarga pelo proprietário
- [ ] Lojas com cadastro/KYC pendente e produtos sem fatos obrigatórios/fotos válidas: dependem do titular ou fornecedor

## Novo (09/10 — Cadastro público)
- [x] Corrigir erro de cadastro e permitir novas contas sem link reservado
- [x] Manter perfis existentes e orientar uso do e-mail da compra
- [x] Verificar cadastro real: resposta 200, estado de confirmação exibido e nenhum erro de execução; privilégios preservados

## Novo (09/10 — Simplificar publicação)
- [x] Retirar características e editor de cores/tamanhos; manter categoria simples com sugestão automática
- [x] Preencher características nos bastidores somente com dados explícitos do catálogo
- [x] Validar editor autenticado: categoria automática, zero campos de características e zero editor de variações
- [ ] Liberação de publicação: cadastro de vendedor precisa ser concluído pelo titular na Shopee

## Novo (09/10 — Publicação Shopee: categorias e variações)
- [x] Corrigir seleção de categorias finais e consultar atributos pela API atual get_attribute_tree
- [x] Recuperar cores/tamanhos explícitos e permitir revisar combinações reais sem inventar grades
- [x] Implementar envio de variações pela API oficial e preservar referência em falhas parciais
- [x] Validar preparação autenticada, troca de categoria e bloqueios; 8 testes unitários passaram, sem publicar
- [ ] Confirmar envio real de variações na Shopee quando autorizado; fornecedor pode não disponibilizar opções públicas

## Novo (08/10 — Seleção interativa de fornecedores)
- [x] Manter seleção na página, iniciar cinco minutos imediatamente e revelar preços sem abrir login
- [x] Adicionar seleção única e resumo antes dos planos, com todos os fornecedores e preços existentes
- [x] Confirmar escopo do acesso gratuito à Shopee Place: toda a plataforma para clientes, sem privilégios administrativos
- [x] Validar ativação gratuita real com prazo de cinco minutos e persistência após atualizar a página
- [ ] Contratação premium: bloqueada até o proprietário enviar os links próprios dos fornecedores
- [x] Validar seleção, troca de fornecedor, celular e preservação dos planos dos parceiros

## Novo (08/10 — Ecossistema PAS)
- [x] Colocar Como funciona e catálogo antes do primeiro preço, retirar atalhos ao login e destacar margem de até 65% em produtos selecionados
- [x] Reformular a página principal com fornecedores reais e apresentação premium escura
- [x] Repetir cartões idênticos de preços cedo e no final, preservando checkouts
- [x] Confirmar quantidade real do catálogo e disponibilidade dos fornecedores
- [x] Validar navegação, links de compra e apresentação em computador e celular
- [x] Atualizar páginas dos parceiros preservando preços e checkouts individuais
- [ ] Novos fornecedores: aguardando nomes, dados e integrações enviados pelo usuário

## Em andamento
- [x] Limites de geração por usuário (25/dia, período inicial livre de 8 dias, liberação/bloqueio pelo admin)
- [x] Aba Pagamentos / Recarga da plataforma (só o dono paga)
- [ ] Painel de limites na lista e no detalhe do usuário (admin)

## Novo (01/10 — Landing PAS para vendedores)
- [x] Reformular a página principal como sistema de logística e gestão para sellers Shopee
- [x] Adicionar apresentação visual da operação, integração, fornecedores, recursos e garantia
- [x] Exibir somente os planos Mensal R$ 179,90 e Vitalício R$ 295,90 com os checkouts atuais
- [x] Antecipar os preços para a terceira parte e repetir a comparação completa no final
- [x] Validar a página completa em computador e celular

## Novo (30/09 — Página individual dos parceiros)
- [x] Criar slug único e editável para cada parceiro
- [x] Criar `/fornecedor/slug` sem campo ou lógica de cupom
- [x] Padronizar links em `logistica-NN`, com links antigos redirecionando (08/11)
- [x] Vincular cada página somente aos checkouts do parceiro correspondente
- [x] Adicionar atalho discreto no PAS somente para parceiros
- [x] Validar Admin, páginas individuais e permissões em computador e celular

## Novo (28/09 — Fotos mínimas para publicar)
- [x] Mostrar imediatamente na Integração todo produto salvo, em qualquer conta
- [x] Preservar os dados locais do produto quando um registro antigo não tiver sua cópia completa
- [x] Permitir abrir diretamente no editor qualquer produto salvo

## Novo (27/09 — Topo da Central de Vendedores)
- [x] Adicionar a barra visual da Central de Vendedores na Dashboard
- [x] Incluir logo Shopee, busca, perfil, anúncio, notificações, ajuda e monitor
- [x] Adicionar a navegação visual secundária sem alterar as funções do painel

## Novo (26/09 — Mídias do catálogo pelo Admin)
- [x] Permitir enviar até 9 fotos JPG/PNG por produto
- [x] Permitir enviar ou trocar um vídeo MP4 por produto
- [x] Atualizar capa, galeria e vídeo no catálogo compartilhado
- [x] Validar envio real e visualização em computador e celular

## Novo (26/09 — Área de Produtores dos clientes)
- [x] Ocultar todas as lojas demonstrativas das contas de clientes
- [x] Manter para clientes somente a conexão da própria loja Shopee
- [x] Ocultar o Dashboard de Vendas no menu de Produtor sem acesso de parceiro
- [x] Validar conta proprietária e conta comum em computador e celular

## Novo (pedido 03/09 16:32)
- [ ] Cada conta com perfil próprio: nome + foto editáveis, e-mail/senha próprios
- [ ] Aba de cadastro/login clara, salvando no Cloud
- [ ] Corrigir vazamento: influencers sem dono aparecem para todos (ex.: "Ana Julia")
- [ ] Exigir login nas áreas de geração (influencer/studio)
- [ ] Aba de Saúde/Erros no admin: falhas de geração, créditos acabando, produtos sem foto, links quebrados
- [ ] Pente-fino geral (build, tipos, Playwright em todas as rotas)

## Novo (pedido 03/09 17:28)
- [x] Dados de vendas Jan–Set/2026 no dashboard (provider + gráficos + métricas + notificações simuladas)
- [x] Central de Vendas Automáticas 100% configurável no admin
- [x] Cadastrar produto "Gelatina Slim sabor Morango 90g" (R$ 107,10 · comissão 61% = R$ 65,33 · link s.shopee.com.br/AAGsU4Z2gd) com a imagem enviada

## Novo (04/09)
- [x] Dashboard de Vendas e notificações exclusivos de parceiros aprovados (checagem no servidor)
- [x] Histórico diário determinístico 01/01/2026 → hoje (média ~R$2.300, teto R$5.000)
- [x] Sino de vendas recentes com "Limpar tudo" e mesma fonte de eventos do dashboard
- [x] Filtros de período + calendário + tabela paginada de vendas
- [x] Unificar Vendas em Tempo Real no Dashboard de Vendas com abas Ao vivo e Histórico
- [x] Aplicar tema branco ao Dashboard de Vendas e destacar o perfil no cabeçalho

## Novo (04/09 — proteção de vídeo)
- [x] Aplicar continuidade temporal, física e visual automática em todos os prompts do Studio
- [x] Validar travas de produto, pessoa, objetos, câmera, timeline e quadro final
- [x] Verificar geração do prompt no fluxo atual do Studio

## Novo (07/09 — seletor visual de estilo)
- [x] Substituir opções de roupas, peças e acessórios por imagens editoriais realistas
- [x] Preservar limites e comportamento das seleções atuais
- [x] Validar a etapa Estilo em desktop

## Novo (12/09 — página de vendas V2)
- [x] Criar `/v2` isolada com preços e checkouts de teste, sem alterar a página principal

## Novo (14/09 — Dashboard de Vendas)
- [x] Unificar o faturamento diário das abas Ao vivo e Histórico
- [x] Garantir o reset diário pelo horário de São Paulo
- [x] Adicionar a logo Shopee enviada ao indicador de atualização em tempo real

## Novo (14/09 — Catálogo de Fornecedores)
- [x] Renomear Produtos Virais para Catálogo no menu
- [x] Adicionar seleção com cinco fornecedores, logos e endereços
- [x] Liberar o catálogo atual pela Shopee Place e bloquear os outros quatro com valores anuais
## Novo (14/09 — Análise de Grupos do Facebook)
- [x] Adicionar abas Analisar grupos e Criar divulgação
- [x] Criar ranking diário de vendas em 24 horas com os grupos existentes
- [x] Validar análise e fluxo de divulgação em computador e celular

## Novo (19/09 — Rotação diária de grupos do Facebook)
- [x] Adicionar os novos grupos sem duplicar links já cadastrados
- [x] Liberar uma seleção rotativa de 15 grupos por dia
- [x] Exibir 20 grupos em análise com contagem regressiva e pedido de acesso
- [x] Manter os demais grupos visíveis na fila das próximas análises

## Novo (14/09 — Top Seller Shoppe Place)
- [x] Redesenhar a promoção como conquista Top Seller
- [x] Trocar benefícios por catálogo, créditos infinitos e suporte 24 horas
- [x] Remover LUCENA50, desconto, vagas e limite de cupons
- [x] Implementar relógio renovável de três horas
- [x] Validar promoção em computador e celular

## Novo (14/09 — páginas de vendas)
- [x] Compactar e refinar visualmente as páginas oficial e V2
- [x] Adicionar aviso persistente de 10 minutos ao cupom válido na página oficial
- [x] Manter a V2 sem cupom, com preços e checkouts atuais
- [x] Validar as duas páginas em computador e celular

## Novo (14/09 — Publicação na Shopee)
- [x] Conectar individualmente a loja Shopee de cada usuário pelo fluxo oficial
- [x] Selecionar produtos do catálogo com todas as imagens e editar anúncio completo
- [x] Publicar, atualizar e acompanhar status/link do produto na Shopee
- [x] Validar segurança, erros e experiência responsiva

## Novo (20/09 — Central completa Conectar Loja Shopee)
- [x] Permitir múltiplas lojas por usuário com seletor e isolamento por loja
- [x] Adicionar visão geral baseada somente em produtos e pedidos oficiais sincronizados
- [x] Sincronizar informações da loja, produtos e pedidos dos últimos 30 dias com histórico técnico
- [x] Adicionar edição unitária e em massa de preço/estoque, SKU, categoria e desativação de anúncio
- [x] Adicionar configurações de estoque, alertas, preço e automações por loja
- [x] Adicionar otimização de título e descrição com IA sem inventar características
- [x] Adicionar mensagens claras, renovação de token, retry controlado e desconexão segura

## Novo (16/09 — Cadastro oculto de clientes)
- [x] Criar a página reservada `/cadastrar` com nome, e-mail e senha
- [x] Liberar automaticamente o perfil como cliente ativo e entrar após o cadastro
- [x] Validar cadastro e apresentação em computador e celular

## Novo (16/09 — Cadastro oculto de parceiros)
- [x] Criar a página reservada `/cadastroprodutoresespancadores`
- [x] Liberar Dashboard de Vendas e recursos de parceiro sem acesso administrativo
- [x] Manter cupom e checkouts individuais controlados pelo painel de parceiros
- [x] Validar cadastro, permissões e cupons individuais em computador e celular

## Novo (16/09 — Novos parceiros no admin)
- [x] Exibir automaticamente no painel todo cadastro feito pelo link reservado
- [x] Atualizar a lista de parceiros sem exigir recarregamento manual
- [x] Confirmar Ana Seller vinculada pelo Gmail e pronta para configurar cupom e checkouts

## Novo (16/09 — Cupom individual e Shopee oculta)
- [x] Ocultar Minha loja Shopee do menu, catálogo e acesso direto
- [x] Mostrar na área Top Seller somente o cupom do parceiro conectado
- [x] Manter cada cupom vinculado exclusivamente aos checkouts configurados para seu parceiro
- [x] Impedir novos cupons ativos sem os dois checkouts e sinalizar ofertas ainda incompletas

## Novo (17/09 — Roadmap Shopee)
- [x] Adicionar jornada guiada e minimalista de sete dias ao PAS
- [x] Implementar tarefas, progresso e desbloqueio gradual por aluno
- [x] Validar a jornada completa em computador e celular

## Novo (17/09 — Regras de indicação Top Seller)
- [x] Informar que indicações não geram comissão ao parceiro
- [x] Explicar que indicados precisam obrigatoriamente de acesso ativo ao PAS
## Novo (17/09 — Landing pages Shoppe Place)
- [x] Transformar a página principal e a V2 na identidade premium Shoppe Place
- [x] Preservar preços, cupons, checkouts e funcionamento comercial existente
- [x] Validar as duas páginas em computador e celular

## Novo (17/09 — Limite de indicações Top Seller)
- [x] Refinar o aviso de cupom aplicado na página principal
- [x] Permitir escolher até oito novas pessoas, além das duas já selecionadas
- [x] Encerrar e bloquear visualmente a seleção depois da confirmação

## Novo (18/09 — Movimento diário no Dashboard de Vendas)
- [x] Definir o faturamento de hoje em R$ 4.589,98 nas abas Ao vivo e Histórico
- [x] Manter os próximos dias variando automaticamente entre R$ 1.500 e R$ 4.678
- [x] Exibir novas vendas no feed ao vivo sem somá-las novamente ao faturamento diário

## Novo (19/09 — Integração oficial Shopee)
- [x] Proteger Partner ID e Partner Key no servidor
- [x] Reativar Minha loja Shopee e o acesso pelo catálogo
- [x] Permitir que cada cliente conecte a própria loja e publique anúncios editados
- [x] Identificar credenciais Sandbox antes de tentar conectar uma loja real
- [x] Renovar automaticamente a autorização individual de cada loja
- [x] Sincronizar e editar os produtos existentes da loja conectada
- [x] Carregar categorias e canais de envio liberados pela própria Shopee
- [x] Ocultar Minha loja Shopee enquanto o aplicativo aguarda aprovação de produção
- [x] Substituir as credenciais Sandbox pelas credenciais de produção após aprovação da Shopee
- [x] Reabrir Minha loja Shopee após validar o aplicativo no ambiente real do Brasil

## Novo (20/09 — Nome da integração Shopee)
- [x] Renomear a aba Minha loja Shopee para Conectar Loja Shopee
- [x] Preservar a conexão, publicação e edição já funcionais

## Novo (20/09 — Correção da autorização Shopee)
- [x] Ler corretamente os tokens retornados pela autorização oficial
- [x] Validar e identificar a loja antes de marcar a conexão como ativa
- [x] Exibir indicador verde e somente a opção de desconectar após conectar

## Novo (20/09 — Publicação e envio Shopee)
- [x] Impedir que atributos de categoria bloqueiem categorias e canais de envio
- [x] Selecionar automaticamente o único canal de envio liberado pela loja
- [x] Confirmar o produto na Shopee antes de marcar a publicação como concluída
- [x] Atualizar imediatamente a lista de produtos da loja após publicar
- [x] Tratar a falha 100011 da consulta de canais sem bloquear a publicação
- [x] Preencher automaticamente Correios, 0,3 kg e embalagem 20×15×10 cm
- [x] Validar o fluxo de envio na loja conectada sem erros visíveis
- [x] Exibir todos os produtos salvos da conta em Publicar do PAS
- [x] Adicionar busca, diagnóstico de fotos e preparação assistida por IA
- [x] Buscar fotos extras somente na página oficial do fornecedor, sem inventar imagens
- [x] Buscar automaticamente todas as fotos oficiais no momento da publicação
- [x] Exigir no mínimo cinco fotos aceitas pela Shopee antes de publicar
- [x] Não bloquear anúncios válidos quando a página oficial disponibilizar menos de cinco fotos
- [x] Redesenhar o editor Shopee em tela única com galeria ampla, formulário completo e geração por IA
- [x] Adicionar calculadora de lucro com custo, taxa Shopee estimada em 16%, frete e margem
- [x] Permitir escolher a margem desejada e calcular automaticamente o preço de venda

## Novo (21/09 — Galeria completa de produtos)
- [x] Preservar capa e múltiplas imagens usando os campos existentes do catálogo
- [x] Corrigir importação CSV/XLSX para aceitar e normalizar galerias completas
- [x] Permitir adicionar, remover, reordenar e definir a capa no cadastro e no editor Shopee
- [x] Enviar à Shopee todas as fotos válidas na ordem escolhida, sem bloquear produtos com uma única foto oficial
- [x] Adicionar análise opcional da galeria por IA sem aplicar mudanças sem confirmação

## Novo (22/09 — Calculadora e conexão Shopee)
- [x] Atualizar preço e lucro imediatamente pela margem desejada
- [x] Fixar o frete estimado em 15% do preço de venda
- [x] Preencher automaticamente o custo com o preço do produto salvo no catálogo
- [x] Diagnosticar e corrigir a conclusão da conexão da loja Shopee

## Novo (25/09 — Renovação da loja Shopee)
- [x] Renovar automaticamente quando a Shopee invalidar o token antes do horário salvo
- [x] Reutilizar o token mais novo quando duas operações tentarem renovar ao mesmo tempo
- [x] Não confundir erros comuns de publicação com autorização expirada
- [ ] Validar publicação com uma loja autenticada após a renovação

## Novo (22/09 — Limite de influenciadores)
- [x] Limitar cada conta a três influenciadores salvos
- [x] Bloquear criação e duplicação acima do limite
- [x] Informar que a etapa 5 do roadmap libera novos influenciadores

## Novo (22/09 — Nova página de vendas PAS)
- [x] Reposicionar a página oficial para Produto → PAS → IA → Shopee → Venda
- [x] Criar apresentação premium preta e amarela com recursos, fluxo, IA e provas visuais reais
- [x] Exibir START R$ 179,90, SCALE R$ 295,90 e ELITE vitalício R$ 597,90
- [x] Preservar os checkouts principais e reutilizar o checkout vitalício da V2
- [x] Validar página oficial em computador e celular

## Novo (22/09 — Página V3)
- [x] Restaurar a página de vendas anterior como página principal
- [x] Mover a nova página PAS para `/v3`
- [x] Remover campo, aviso e lógica de cupom da V3
- [x] Manter a V2 inalterada

## Novo (22/09 — Preços promocionais na página principal)
- [x] Exibir os valores promocionais diretamente, sem exigir cupom
- [x] Remover o campo, o contador e os avisos de cupom da página principal
- [x] Ligar os planos aos checkouts promocionais correspondentes
- [x] Manter V2 e V3 inalteradas

## Novo (22/09 — Fotos adicionais de produto)
- [x] Identificar o produto específico enviado pelo usuário
- [x] Adicionar as cinco fotos oficiais informadas à galeria do produto
- [x] Confirmar que a galeria aparece no catálogo e no editor Shopee

## Novo (23/09 — Estabilidade da geração de influenciadores)
- [x] Remover as quatro gerações simultâneas que sobrecarregavam o serviço
- [x] Gerar as imagens em fila, preservando cada resultado concluído
- [x] Tentar novamente falhas temporárias por até 20 minutos
- [x] Encerrar imediatamente erros definitivos de acesso, créditos ou segurança

## Novo (23/09 — Catálogo de influenciadores prontos)
- [x] Substituir a criação do zero e por foto pelo catálogo compartilhado
- [x] Cadastrar as 25 fotos enviadas como Influencer 1 a Influencer 25
- [x] Permitir salvar e usar no Studio sem limite por conta
- [x] Impedir que a mesma opção seja salva duas vezes pela mesma conta

## Novo (23/09 — Influenciadores e gerações ilimitadas)
- [x] Remover o limite de três influenciadores salvos por conta
- [x] Remover o limite diário de geração de imagens e vídeos
- [x] Manter somente o bloqueio administrativo de segurança

## Novo (23/09 — Correção da cobrança de imagens)
- [x] Remover a geração direta pela conta Google sem saldo
- [x] Usar exclusivamente os créditos do Lovable AI nas imagens do Studio
- [x] Remover o encerramento automático após 90 segundos

## Novo (23/09 — Preço de publicação Shopee)
- [x] Preparar cada produto com preço 35% menor que o valor atual do catálogo
- [x] Preservar o estoque informado e impedir que a calculadora restaure o preço cheio
- [x] Exibir o valor do catálogo e o valor preparado antes da publicação

## Novo (23/09 — Roteiros por categoria no Studio)
- [x] Adicionar os dois roteiros enviados à categoria Mostrar produto
- [x] Alternar automaticamente entre os dois roteiros a cada nova versão
- [x] Adicionar e alternar o par enviado para Review falando para a câmera
- [x] Adicionar e alternar o par enviado para Unboxing abrindo o produto pela primeira vez
- [x] Adicionar e alternar o par enviado para Antes e depois
- [x] Adicionar e alternar o par enviado para Produto em uso
- [x] Adicionar e alternar o par enviado para POV
- [x] Preservar o par anterior nas demais categorias até receber seus roteiros específicos

## Novo (24/09 — Prompts sem depender de créditos)
- [x] Gerar os prompts do Studio localmente, sem chamada de IA e sem consumo de créditos
- [x] Entregar o prompt mesmo quando os créditos de imagem do workspace estiverem esgotados
- [x] Informar claramente quando somente a imagem da cena não puder ser criada

## Novo (24/09 — Imagens pelo Google AI Studio)
- [x] Restaurar a geração de imagens pelo projeto Google configurado no PAS
- [x] Enviar em toda geração as fotos reais da influenciadora e do produto
- [x] Manter o DNA facial, corporal, roupa, produto, cenário e categoria travados no prompt

## Novo (24/09 — Página exclusiva dos afiliados)
- [x] Manter a página principal sem campo ou lógica de cupom
- [x] Criar `/fornecedor` com aplicação manual e automática do cupom individual
- [x] Direcionar cada compra somente aos checkouts cadastrados para o afiliado
- [x] Atualizar o compartilhamento Top Seller para a nova página

## Novo (24/09 — Nome individual no Dashboard de Vendas)
- [x] Remover o nome fixo “Lucena” do topo do painel
- [x] Mostrar o nome salvo individualmente no perfil de cada parceiro
- [x] Manter o acesso direto à edição do nome pelo bloco do perfil

## Novo (24/09 — Galeria local na Shopee Seller)
- [x] Permitir escolher fotos JPG/PNG e vídeo MP4 no celular ou computador
- [x] Salvar os arquivos privadamente por cliente e manter a mídia no rascunho
- [x] Integrar as fotos enviadas à capa, ordenação, validação e publicação existentes
- [x] Mostrar a prévia do vídeo e informar que a publicação depende da liberação da Shopee

## Novo (24/09 — Vendas contínuas nos painéis dos parceiros)
- [x] Fazer o faturamento de hoje crescer ao longo do dia, sem abrir já no valor final
- [x] Gerar vendas demonstrativas em intervalos variáveis de até 10 minutos
- [x] Manter Ao vivo e Histórico com os mesmos valores e reset diário em São Paulo
- [x] Validar o painel em computador e celular

## Novo (25/09 — Limites financeiros do Dashboard de Vendas)
- [x] Limitar o GMV completo de cada dia entre R$ 2.000 e R$ 5.000
- [x] Limitar a comissão completa de cada dia entre R$ 400 e R$ 900
- [x] Recalcular deterministicamente todo o histórico desde janeiro dentro dos novos limites
- [x] Validar os totais diário e mensal no painel em computador e celular

## Novo (25/09 — Estoque e categorias Shopee)
- [x] Programar estoque fixo por produto entre 300 e 8.000 unidades
- [x] Impedir alteração do estoque ao preparar produtos do PAS
- [x] Carregar categorias oficiais da Shopee em português
- [x] Parear automaticamente cada produto com a categoria Shopee mais adequada

## Novo (25/09 — Frete pago pelo cliente)
- [x] Remover o frete de 15% do cálculo do preço e do lucro do vendedor
- [x] Informar no editor que o frete será pago pelo cliente

## Novo (25/09 — Grupos exclusivos do Facebook)
- [x] Substituir todos os grupos anteriores pelos 14 links enviados
- [x] Reciclar diariamente sete grupos liberados e sete em análise
- [x] Preservar o pedido de acesso e o fluxo de divulgação existente

## Novo (25/09 — Divisão entre Afiliados e Produtores)
- [x] Criar escolha inicial e troca persistente entre as duas áreas
- [x] Simplificar os menus de Afiliados e Produtores
- [x] Separar Fornecedores do catálogo Shopee Place
- [x] Exibir duas lojas demonstrativas e preservar a conexão oficial
- [x] Mostrar custo, preço sugerido com 35% e lucro estimado no catálogo
- [x] Adicionar Anúncio MAX opcional ao cálculo, sem campanha paga automática
- [x] Exibir progresso, sucesso, erro, retorno ao catálogo e link real após publicação
- [x] Validar a experiência completa no computador e celular

## Novo (25/09 — Loja privada CHICABONITA_1)
- [x] Mostrar CHICABONITA_1 somente ao proprietário autenticado na área Produtor
- [x] Adicionar “Ver loja” com o anúncio Shopee informado
- [x] Validar que uma conta comum não recebe a loja privada
- [x] Validar computador, celular e compilação

## Novo (25/09 — Dashboard para Produtores)
- [x] Adicionar Dashboard de Vendas ao menu da área Produtor

## Novo (25/09 — Endereços dos Fornecedores)
- [x] Restaurar os cinco endereços informados nos respectivos fornecedores

## Novo (12/10 — Erros de publicação dos clientes)
- [x] SKU longo (>100) cortado automaticamente
- [x] Fotos pequenas/WebP/grandes ajustadas automaticamente; publicação usa só as fotos escolhidas
- [x] Tabela de medidas exigida em roupas (motivo real do "categoria não aceita")
- [x] Nome do Modelo, Tipo de Conexão etc. preenchidos sozinhos; ANVISA só quando informado

## Nomes das lojas de exemplo
- [x] Opção discreta de renomear as três lojas demonstrativas, sem alterar lojas reais
- [x] Persistência por conta neste aparelho, com restauração do nome original
- [x] Validar salvar, recarregar e restaurar na interface autenticada

## Visão geral e pedidos demonstrativos dos parceiros
- [x] Disponibilizar Visão geral e Pedidos demonstrativos iguais para proprietário e parceiros autorizados
- [x] Separar demonstração de pedidos, compradores e conexões reais
- [x] Validar igualdade e exclusão de pedidos reais em testes; interface autenticada do proprietário validada (não acessada conta de parceiro)

## Novo (21/10 — Dados do proprietário e voltagens)
- [x] ANVISA do proprietário em progressiva, creatina, massageador, cílios, óleos, sabonete e gel de limpeza
- [x] Certificados Anatel só nos modelos registrados (registro público mostrou outros fabricantes/modelos)
- [x] Cabos elétricos = Sim; Bluetooth Sim/Não; tipo de conexão e capacidade da bateria automáticos
- [x] Opção de voltagem automática nos produtos com mais de uma voltagem no título
- [x] Anúncio apagado na Shopee é recriado; variações diferentes não travam mais
- [x] Tipo de item da câmera automático
- [x] Produto duplicado é vinculado e atualiza o anúncio existente
- [x] Canal de envio desligado é trocado por um ativo; mensagens claras para anúncio suspenso
- [ ] Homologação Anatel verdadeira de fones, caixas, microfones, carregadores e power banks (aguardando o proprietário/fornecedor)
- [ ] GTIN real dos 3 produtos de categorias que exigem código (aguardando o proprietário)

## Novo (09/11 — Erros, catálogo e publicação)
- [x] Banco sobrecarregado: atalho de ordenação do catálogo, catálogo guardado por alguns minutos
- [x] Lista do Publicar do PAS mais leve + Catálogos com cópia pronta (carregamento rápido)
- [x] Alertas de segurança: dono/parceiro só por cargo protegido, tabelas abertas fechadas, busca de imagens limitada, busca do admin e simulação protegidas
- [x] Reduzir Catálogos: custo abaixo de R$ 8 sai (salvos/publicados ficam)
- [x] Área de afiliado com cadeado e "Em breve"
- [ ] Publicar o site novamente
