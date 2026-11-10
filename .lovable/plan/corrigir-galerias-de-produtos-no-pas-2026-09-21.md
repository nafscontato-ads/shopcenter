# Corrigir galerias de produtos no PAS

## Resultado
O PAS preservará a galeria real de cada produto do cadastro até a publicação na Shopee. A primeira foto será a capa, duplicadas serão removidas sem alterar a ordem e produtos antigos com uma foto continuarão funcionando.

## Implementação
- Reutilizar os campos existentes `primary_image` e `gallery_images`; não criar tabela redundante.
- Centralizar a normalização das galerias: URLs válidas, capa em primeiro lugar, remoção de duplicadas e limite da Shopee.
- Corrigir a importação CSV/XLSX para aceitar uma coluna de galeria e preservar todas as URLs fornecidas pela origem.
- Melhorar o cadastro administrativo com prévia da galeria completa, definição de capa, remoção e reordenação por arrastar.
- No editor Shopee, carregar imediatamente todas as fotos salvas, permitir reordenar, remover, definir capa e adicionar URLs reais quando a origem só tiver uma foto.
- Persistir a ordem escolhida no rascunho e enviar todos os IDs das imagens aceitas, mantendo a primeira como capa.
- Validar cada foto no servidor antes do envio e mostrar quais foram recusadas, sem inventar imagens ou bloquear um produto válido que só tenha uma foto oficial.
- Adicionar análise opcional por IA da galeria, retornando apenas sugestões de capa, duplicidade, qualidade e ordem; nenhuma troca será aplicada sem confirmação.
- Manter carregamento leve com miniaturas, lazy loading e a imagem original para publicação.

## Compatibilidade e testes
- Cobrir produtos com 0, 1, 3 e 8 fotos, duplicadas, URL inválida e nova importação.
- Confirmar preservação da ordem/capa no catálogo, produtos salvos, rascunho e payload Shopee.
- Validar computador e celular sem realizar publicação real em nenhuma loja.

## Observação técnica
A estrutura atual já suporta múltiplas fotos. O descarte ocorre principalmente na importação em lote, que hoje mapeia somente `primary_image`; o catálogo, os rascunhos e o payload Shopee já possuem arrays e serão endurecidos para usar uma normalização única.
