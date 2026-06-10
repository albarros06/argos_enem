<!--
Sync Impact Report
==================
Version change: (template) → 1.0.0
Modified principles: n/a (adoção inicial)
Added sections:
  - Core Principles (5 princípios: Código Legível Primeiro; Estrutura Simples;
    Modularidade Obrigatória; Manutenibilidade como Prioridade; Preparado para Escala)
  - Restrições e Padrões de Qualidade
  - Fluxo de Desenvolvimento
  - Governance
Removed sections: nenhuma
Templates requiring updates:
  - .specify/templates/plan-template.md ✅ alinhado (gate "Constitution Check" preenchido
    em tempo de planejamento; nenhuma alteração necessária)
  - .specify/templates/spec-template.md ✅ alinhado (sem seções obrigatórias novas)
  - .specify/templates/tasks-template.md ✅ alinhado (organização por user story já
    suporta entregas modulares e independentes)
  - .specify/templates/checklist-template.md ✅ alinhado
Follow-up TODOs: nenhum
-->

# Argos ENEM Constitution

## Core Principles

### I. Código Legível Primeiro

Todo código DEVE ser escrito para ser lido por humanos antes de ser executado por
máquinas. Nomes de variáveis, funções, classes e módulos DEVEM revelar intenção sem
exigir comentários explicativos. Comentários são reservados para registrar restrições
que o código não consegue expressar (decisões de negócio, limitações externas).
Funções DEVEM ter responsabilidade única e tamanho que caiba em uma leitura sem
rolagem (~40 linhas como referência); exceções DEVEM ser justificadas em revisão.
Construções "inteligentes" ou obscuras são proibidas quando existe alternativa clara.

**Racional**: código é lido ordens de magnitude mais vezes do que é escrito; a
legibilidade é o fundamento direto da manutenibilidade, prioridade máxima do projeto.

### II. Estrutura Simples

A solução mais simples que atende ao requisito atual DEVE ser a escolhida (YAGNI).
É proibido adicionar camadas de abstração, padrões de projeto ou infraestrutura
especulativa para necessidades futuras hipotéticas. Cada nova dependência externa
DEVE ser justificada por valor concreto que não pode ser obtido com o que já existe.
A estrutura de diretórios DEVE ser rasa e previsível: um novo colaborador DEVE
conseguir localizar onde uma funcionalidade vive em menos de um minuto.

**Racional**: complexidade acidental é o maior inimigo da manutenção; simplicidade
hoje preserva a capacidade de evoluir amanhã.

### III. Modularidade Obrigatória

O sistema DEVE ser organizado em módulos coesos com fronteiras explícitas. Cada
módulo DEVE ter responsabilidade única e expor uma interface pública mínima;
detalhes internos NÃO PODEM ser acessados diretamente por outros módulos.
Dependências entre módulos DEVEM ser unidirecionais e explícitas — ciclos de
dependência são proibidos. Acoplamento entre módulos DEVE ser baixo; coesão dentro
de cada módulo DEVE ser alta. Cada módulo DEVE ser testável isoladamente.

**Racional**: fronteiras claras permitem entender, testar e substituir partes do
sistema sem conhecer o todo — pré-requisito tanto para manutenção quanto para escala.

### IV. Manutenibilidade como Prioridade

Manutenibilidade é o critério de desempate em toda decisão técnica: entre duas
soluções viáveis, a mais fácil de manter VENCE, mesmo que seja menos performática ou
menos elegante. Todo código novo DEVE passar por revisão com foco em legibilidade e
aderência a esta constituição antes de ser integrado. Refatorações que reduzam
complexidade SÃO bem-vindas a qualquer momento e NÃO exigem justificativa além da
melhoria em si. Dívida técnica assumida conscientemente DEVE ser registrada
(issue ou comentário `TODO` rastreável) com plano de quitação.

**Racional**: a prioridade declarada do projeto é manutenção fácil; sem um critério
de desempate explícito, otimizações locais corroem essa prioridade ao longo do tempo.

### V. Preparado para Escala

O design DEVE suportar crescimento sem reescrita estrutural, sem violar o Princípio
II: escalar significa remover gargalos quando medidos, não construir infraestrutura
antecipada. Para isso, todo código DEVE respeitar as condições que tornam a escala
possível depois: componentes sem estado compartilhado desnecessário, operações
custosas isoladas atrás de interfaces (permitindo cache, fila ou paralelização
futura), e acesso a dados concentrado em camadas dedicadas. Decisões que travariam
a escala (estado global mutável, acoplamento a uma única instância, lógica de
negócio misturada com I/O) são proibidas mesmo na primeira versão.

**Racional**: suportar escala é prioridade do projeto; o caminho barato é preservar
as opções de escala desde o início, não pagar pelo mecanismo antes da necessidade.

## Restrições e Padrões de Qualidade

- Linter e formatador automático DEVEM estar configurados desde o primeiro commit de
  código e rodar sem erros antes de qualquer integração.
- Funcionalidade nova DEVE vir acompanhada de testes que cubram o comportamento
  público do módulo afetado; correção de bug DEVE incluir teste que reproduza o bug.
- Erros DEVEM ser tratados explicitamente nas fronteiras dos módulos; falhas
  silenciosas são proibidas.
- Configuração (credenciais, URLs, limites) DEVE viver fora do código-fonte, em
  variáveis de ambiente ou arquivos de configuração versionáveis sem segredos.

## Fluxo de Desenvolvimento

- Todo trabalho DEVE partir de uma especificação (`/speckit-specify`) e plano
  (`/speckit-plan`) antes da implementação; o gate "Constitution Check" do plano
  DEVE validar aderência aos cinco princípios.
- Mudanças DEVEM ser entregues em incrementos pequenos e independentemente
  testáveis, organizados por user story conforme o template de tasks.
- Revisão de código DEVE verificar, no mínimo: legibilidade (I), ausência de
  complexidade especulativa (II), respeito às fronteiras de módulo (III) e
  ausência de decisões que travem escala (V).
- Violações a princípios DEVEM ser registradas na tabela "Complexity Tracking" do
  plano com justificativa e alternativa mais simples rejeitada.

## Governance

Esta constituição prevalece sobre qualquer outra prática ou convenção do projeto.

- **Emendas**: alterações DEVEM ser propostas por escrito (PR sobre este arquivo),
  com racional e impacto nos templates dependentes; aprovação do mantenedor é
  obrigatória antes do merge.
- **Versionamento**: este documento segue versionamento semântico —
  MAJOR para remoção ou redefinição incompatível de princípios; MINOR para novo
  princípio ou expansão material de orientação; PATCH para clarificações e ajustes
  de redação.
- **Conformidade**: todo plano de implementação DEVE passar pelo gate "Constitution
  Check"; toda revisão de código DEVE verificar aderência aos princípios; qualquer
  complexidade que viole um princípio DEVE ser justificada ou rejeitada.

**Version**: 1.0.0 | **Ratified**: 2026-06-10 | **Last Amended**: 2026-06-10
