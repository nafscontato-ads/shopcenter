# Corrigir publicação e envio Shopee

## Objetivo
Deixar o editor resistente ao erro de canais da Shopee e preencher automaticamente o pacote com um padrão válido dos Correios.

## Alterações
- Consultar categorias e canais separadamente, para uma falha externa da Shopee não bloquear o restante do editor.
- Tratar especificamente o erro 100011 de loja/armazém e reaproveitar com segurança o canal Correios já confirmado para a loja.
- Na publicação, não repetir a consulta instável quando o canal selecionado já foi confirmado anteriormente.
- Preencher novos anúncios automaticamente com peso de 0,3 kg e embalagem de 20 × 15 × 10 cm, mantendo os campos editáveis.
- Selecionar automaticamente o canal disponível e mostrar mensagens claras quando a Shopee estiver temporariamente indisponível.
- Validar criação, revisão e publicação em navegador com a loja conectada, além da verificação de tipos.

## Resultado esperado
O usuário escolhe qualquer produto do catálogo, recebe os dados básicos de envio preenchidos e consegue publicar sem o erro externo de canais da Shopee.
