# Envio de fotos e vídeos no anúncio Shopee

## Resultado
Na tela **Conectar Loja Shopee**, o cliente poderá escolher arquivos da galeria do celular ou computador, além de continuar usando URLs e fotos oficiais.

## Alterações
- Adicionar um botão **Enviar foto ou vídeo** no editor do produto, abrindo a galeria do aparelho.
- Aceitar fotos JPG/PNG e vídeo MP4, com validação clara de formato, tamanho e quantidade antes do envio.
- Enviar os arquivos para uma área privada da conta; cada cliente verá apenas os próprios arquivos.
- Inserir as fotos enviadas na galeria existente, permitindo capa, ordem e remoção como hoje.
- Exibir o vídeo escolhido com prévia, troca e remoção separadas das fotos.
- Salvar a mídia no rascunho para ela continuar disponível ao reabrir o produto.
- Na publicação, enviar as fotos à Shopee pelo fluxo atual e anexar o vídeo somente quando a loja/API oficial aceitar esse recurso; se a Shopee recusar ou não liberar vídeo para a conta, preservar o rascunho e mostrar a razão sem impedir a publicação das fotos.
- Atualizar o texto atual, que diz usar somente imagens oficiais, para incluir arquivos enviados pelo cliente.

## Segurança e validação
- Isolar os arquivos por usuário autenticado e impedir acesso entre contas.
- Não publicar automaticamente: o botão final e a confirmação atual continuam iguais.
- Testar escolha pela galeria em computador e celular, prévias, remoção, salvamento do rascunho e publicação de fotos.
- Confirmar o comportamento do vídeo conforme a permissão real retornada pela Shopee, sem simular sucesso.

## Detalhes técnicos
- Criar armazenamento privado específico para mídias Shopee e políticas por pasta do usuário.
- Adicionar ao anúncio um campo opcional para a referência do vídeo, mantendo compatibilidade com rascunhos antigos.
- Usar URLs temporárias somente para prévia; o servidor lê o arquivo protegido na validação/publicação.
