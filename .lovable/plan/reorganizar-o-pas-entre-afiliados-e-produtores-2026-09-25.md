# Reorganizar o PAS entre Afiliados e Produtores

## Objetivo
Separar a plataforma em duas experiências simples, escolhidas ao entrar, mantendo toda a integração Shopee existente e reduzindo o uso de créditos ao mínimo.

## Estrutura da plataforma

### Escolha ao entrar
- Após o login, mostrar uma escolha direta entre **Área de Afiliados** e **Área de Produtores**.
- Salvar a última escolha no aparelho e permitir trocar de área pelo menu sem novo login.
- Redirecionar o usuário para a primeira tela da área escolhida.

### Área de Afiliados
Exibir somente:
- Dashboard de Vendas, quando a conta tiver acesso.
- Influenciadores.
- Studio de Conteúdo.
- Divulgar no Facebook.
- Perfil e configurações.

### Área de Produtores
Exibir somente:
- Integração.
- Fornecedores.
- Catálogo Shopee Place.
- Produtos/anúncios da loja, pedidos, automações e atividade dentro da integração.
- Perfil e configurações.

## Integração de lojas
- Transformar a entrada da área de Produtores em uma visão simples das lojas.
- Exibir **Achadinhos do Lucena** e **Loja Tudocena** como demonstrações claramente identificadas, sem tokens e sem executar publicação real.
- Manter a loja realmente autorizada pela Shopee como conexão oficial, com seus dados reais.
- Continuar permitindo várias conexões oficiais por conta e preservar o isolamento entre clientes.

## Fornecedores e catálogo
- Criar uma aba interna separada chamada **Fornecedores**.
- Ao escolher a Shopee Place, abrir diretamente o catálogo existente.
- Manter os demais fornecedores bloqueados como hoje.
- Preservar os filtros, fotos, detalhes e ações existentes.
- Em cada produto, mostrar abaixo da foto:
  - **Custo**: custo do fornecedor já calculado em 35% abaixo do valor atual do catálogo.
  - **Preço sugerido**: custo acrescido de 35%, destacado em laranja.
  - **Lucro estimado**: preço sugerido menos o custo, sem inventar frete ou outras cobranças.
- Substituir a ação de publicação por **Cadastrar na loja**, abrindo o editor Shopee com o produto escolhido.

## Publicação simplificada
- Manter fotos, vídeo, título, descrição, estoque programado, categoria oficial em português, peso, embalagem, envio, margem e validações existentes.
- Adicionar o controle **Adicionar Anúncio MAX**.
- Quando ligado, incluir os 16% da Shopee no cálculo do preço e lucro; quando desligado, não incluir os 16%.
- O controle altera somente a composição financeira do anúncio; não cria campanha paga automaticamente na Shopee.
- Manter a margem ajustável pelo cliente e usar cálculo local, sem gastar créditos.
- Deixar as ações de IA opcionais; navegar, calcular, preparar e publicar não dependerá de IA.

## Progresso da publicação
- Ao publicar, abrir uma janela central com **Publicando produto na Shopee** e impedir envio duplicado.
- Após confirmação oficial, mostrar o resultado e as ações:
  - **Voltar ao catálogo**.
  - **Ver produto na loja**, usando o link real devolvido/montado após a confirmação.
- Se a Shopee deixar o anúncio em análise, informar isso sem declarar publicação concluída.
- Em caso de erro, manter o rascunho e mostrar a mensagem recebida, com opção de voltar ao editor.

## Compatibilidade e segurança
- Não alterar os cupons nem a página pública `/fornecedor` usada pelos parceiros.
- Não modificar tokens, OAuth, estoque programado, categorias oficiais ou logística já funcionando.
- As lojas demonstrativas nunca chamarão a API oficial nem aceitarão publicação.
- Preservar links antigos para não quebrar acessos já compartilhados.

## Validação
- Testar a escolha e troca de área no computador e celular.
- Conferir que cada menu mostra apenas as opções corretas.
- Conferir custo, acréscimo de 35%, lucro e cálculo com Anúncio MAX ligado/desligado.
- Testar lojas demonstrativas e uma conexão real sem misturar dados.
- Testar publicação, estado em análise, erro, retorno ao catálogo e abertura do produto real na loja.
- Confirmar compilação, login, ausência de tela branca e ausência de novas chamadas pagas de IA no fluxo comum.

## Detalhes técnicos
- Criar uma preferência de área no cliente com leitura somente após a página carregar, evitando inconsistência no carregamento inicial.
- Criar uma rota interna exclusiva para **Fornecedores**, mantendo `/fornecedor` como página pública de cupom.
- Reutilizar `/produtos` como catálogo Shopee Place e `/shopee` como central de integração/publicação.
- Manter uma única fórmula de preço e persistir a opção de incluir os 16% no rascunho para ela continuar igual ao reabrir.
- Registrar a preferência financeira em coluna própria do anúncio, com valor padrão compatível com anúncios antigos.
