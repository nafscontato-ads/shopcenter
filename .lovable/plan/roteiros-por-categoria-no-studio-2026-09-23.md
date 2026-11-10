# Roteiros por categoria no Studio

## Objetivo
Adicionar à categoria **Mostrar produto** os dois roteiros enviados, alternando automaticamente entre eles a cada nova versão gerada.

## Implementação
- Manter os dois textos enviados sem reescrita por IA.
- Vincular esse par somente à categoria **Mostrar produto — Produto em destaque nas mãos dela**.
- Alternar entre o roteiro 1 e o roteiro 2 usando a variação da geração.
- Preservar os roteiros atuais nas demais categorias até que seus pares específicos sejam enviados.
- Manter as travas de identidade, produto, cenário, câmera fixa, 8 segundos e continuidade visual.

## Validação
- Confirmar que gerações consecutivas em **Mostrar produto** retornam os dois prompts alternadamente.
- Confirmar que outra categoria continua usando seu par atual.
- Verificar compilação e erros da prévia.
