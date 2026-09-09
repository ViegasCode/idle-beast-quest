# Idle Critters

Quero criar um MMORPG idle de captura de criaturas, jogado no navegador. Este é o MVP inicial — construa apenas o que está descrito abaixo, sem adicionar PvP, mercado, clãs ou chat ainda.

CONCEITO

Jogadores criam conta, escolhem uma criatura inicial, e a enviam para "caçar" em uma região. Enquanto o jogador está fora do jogo (aba fechada), a caça continua rendendo progresso, até um limite de 12 horas por sessão. Ao voltar, o jogador coleta o que foi capturado/ganho.

MODELO DE DADOS (crie estas tabelas no banco)

1. users: id, email, senha (auth padrão), nome_treinador, criado_em

2. species (espécies fixas, popule com 15-20 registros de exemplo): id, nome, tipo_primario, tipo_secundario (opcional), hp_base, ataque_base, defesa_base, velocidade_base, taxa_raridade_base (peso numérico), sprite_url (pode ser placeholder por enquanto)

3. creatures (instâncias únicas capturadas por jogadores): id, species_id, user_id, nivel, iv_hp, iv_ataque, iv_defesa, iv_velocidade (cada um de 0 a 31, gerado aleatoriamente na captura), nature (uma string entre uma lista fixa de ~10 natures, cada uma dando +10%/-10% em dois atributos diferentes), raridade (um tier entre: Comum, Incomum, Raro, Épico, Mítico — sorteado no momento da captura com pesos diferentes por região), is_shiny (boolean, chance baixa tipo 1/500), capturada_em

4. regions: id, nome, nivel_minimo, nivel_maximo, lista_de_species_possiveis (quais espécies podem aparecer ali), multiplicador_raridade

5. hunting_sessions: id, user_id, creature_id (qual criatura está caçando), region_id, iniciado_em, ultima_coleta_em

TELAS NECESSÁRIAS

1. Cadastro/Login (auth padrão)

2. Escolha do inicial: 3 opções de criatura starter, jogador escolhe uma

3. Tela principal "Caçando": mostra a criatura ativa, a região selecionada, e um indicador de progresso/tempo acumulado desde a última coleta

4. Botão "Coletar": calcula o que foi ganho desde a última coleta (limitado a 12h) e adiciona criaturas novas à coleção do jogador

5. Tela de Coleção: lista todas as criaturas do jogador, mostrando espécie, nível, raridade, IVs e se é shiny

LÓGICA DE PROGRESSÃO IDLE (importante, implemente com cuidado)

A cada X minutos de caça acumulados (defina X, ex: 15 min), há uma chance de captura de uma nova criatura da região, sorteada por peso de raridade. O cálculo deve ser feito no momento da coleta, baseado no tempo real decorrido desde "ultima_coleta_em", nunca por um timer rodando no navegador do jogador (isso evita trapaça e permite que funcione mesmo com a aba fechada). Limite o cálculo a no máximo 12 horas de progresso por coleta, mesmo que o jogador demore mais para voltar.

DESIGN

Visual estilo jogo de captura de criaturas, cores vibrantes, cards com bordas coloridas por raridade (ex: cinza para Comum, azul para Raro, roxo para Épico, dourado para Mítico, com efeito visual diferenciado para shiny). Interface limpa, avançada e detalhada, mobile-friendly.

NÃO INCLUA AINDA

PvP, mercado entre jogadores, clãs, chat, raids multiplayer, sistema de amigos. Isso vem em fases futuras.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://idle-beast-quest.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/a54a36c6-94df-4738-bb39-02fe035a5e36).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
