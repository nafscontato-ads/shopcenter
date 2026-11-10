# Variações de produtos na Shopee

## Resultado
Adicionar ao editor atual uma seção opcional de variações, permitindo cores, tamanhos ou ambos, sem alterar o fluxo dos produtos simples.

## Implementação
1. Criar o editor de opções com inclusão, edição e remoção de cores e tamanhos.
2. Gerar automaticamente as combinações sem duplicatas e permitir editar SKU, preço, estoque, foto e disponibilidade por combinação.
3. Salvar as combinações no rascunho já existente e restaurá-las ao reabrir o produto.
4. Integrar as combinações ao fluxo oficial já existente: criar/atualizar o produto, inicializar modelos, atualizar preço e estoque e confirmar o retorno da Shopee.
5. Preservar imediatamente o código do anúncio antes de inicializar modelos, garantindo retentativa sem produto duplicado.
6. Mostrar em qual etapa uma falha ocorreu e permitir nova tentativa segura.

## Segurança e compatibilidade
- Manter credenciais somente no servidor e o isolamento por usuário e loja já existente.
- Não criar novas tabelas: o cadastro atual já possui armazenamento protegido para as variações.
- Produtos sem variações continuam usando exatamente o fluxo atual.
- Não inventar opções, estoque ou disponibilidade do fornecedor.

## Validação
- Testes automatizados para produto simples, só cores, só tamanhos, grade completa, valores diferentes, duplicatas e combinações desativadas.
- Teste autenticado de salvar e reabrir as variações na interface.
- Teste de falha e retentativa confirmando que o mesmo anúncio é reutilizado.
- A publicação real só será executada com autorização explícita, pois cria anúncios na loja conectada.