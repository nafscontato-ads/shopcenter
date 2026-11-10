# Limite de influenciadores por conta

## Objetivo
Permitir no máximo 3 influenciadores salvos por conta. Ao tentar criar ou duplicar o quarto, exibir: “Você já atingiu o limite de 3 influenciadores. Conclua a etapa 5 do roadmap para liberar mais.”

## Implementação
- Aplicar a trava na base de dados por usuário, cobrindo criação do zero, criação por imagem e duplicação.
- Fazer a verificação de forma segura contra tentativas simultâneas, sem apagar influenciadores já existentes.
- Na tela “Criar Influencer”, mostrar o uso atual (`X de 3`) e substituir as opções de criação por um aviso quando o limite for atingido.
- Manter o tratamento de erro nas telas de criação e duplicação para que o aviso apareça mesmo em abas antigas já abertas.
- Validar compilação e os fluxos principais após a alteração.

## Detalhes técnicos
- Trigger `BEFORE INSERT` na tabela de influenciadores, com trava transacional por usuário e contagem das linhas existentes.
- A regra ficará na base de dados, evitando que chamadas diretas ou concorrentes contornem o limite.
