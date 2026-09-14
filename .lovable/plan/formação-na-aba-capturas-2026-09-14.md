# Formação na aba Capturas

## Objetivo
Adicionar à tela de Capturas uma formação editável de até três criaturas, usando dados reais da coleção e refletindo o time salvo na batalha.

## Implementação
- Mostrar três vagas de formação no topo de Capturas, preservando a ordem escolhida; a primeira criatura será a líder.
- Exibir um botão de menos em cada integrante para removê-lo e um botão de mais nos cards capturados disponíveis.
- Impedir duplicatas e mais de três integrantes, com estados visuais claros para vagas e seleção.
- Adicionar o botão **Salvar**; somente ao acioná-lo a formação será persistida e a criatura líder da sessão será atualizada.
- Fazer a tela de Batalha ler a mesma formação persistida, removendo a dependência do armazenamento local do navegador.
- Manter filtros, detalhes de IV, raridade, shiny e todas as demais funções atuais.

## Detalhes técnicos
- Persistir os IDs ordenados da equipe no perfil do jogador por migration protegida por autenticação e regras de acesso existentes.
- Criar uma função autenticada para validar propriedade, quantidade e ordem antes de salvar; sincronizar `hunting_sessions.creature_id` com o primeiro integrante.
- Ajustar consultas e estilos pixel art responsivos nas telas de Capturas e Batalha.
- Validar compilação, comportamento de adicionar/remover/salvar e ausência de regressões visuais.
