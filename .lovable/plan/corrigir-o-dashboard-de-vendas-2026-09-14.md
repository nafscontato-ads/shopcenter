# Corrigir o Dashboard de Vendas

## O que será feito
- Usar exatamente a mesma fonte diária nas abas **Ao vivo** e **Histórico**, garantindo que o faturamento mostrado seja idêntico nas duas.
- Manter o recorte pelo dia atual no horário de São Paulo, para o total reiniciar automaticamente a cada novo dia.
- Inserir a logo enviada ao lado de **Atualizado em tempo real**, preservando a leitura no cabeçalho laranja.
- Validar o resultado no painel em desktop e celular.

## Detalhes técnicos
- Remover a soma paralela de eventos locais que pode inflar o total do Ao vivo.
- Compartilhar o resultado diário calculado no Dashboard com o painel Ao vivo, sem criar um segundo cálculo independente.
- Hospedar a imagem enviada como asset do projeto e referenciá-la no cabeçalho.
