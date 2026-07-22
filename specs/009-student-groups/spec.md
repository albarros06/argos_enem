# Feature Specification: Argos — Grupos de Alunos

**Feature Branch**: `009-student-groups`

**Created**: 2026-07-22

**Status**: Draft

**Input**: User description: "Add student groups: any student can create a group and becomes its leader. Other students join via an invite code/link. The leader can propose an essay theme for the group, modeled on the existing global 'redações da semana' feature — the leader authors free-text prompt content or uploads a reference file (like WeeklyThemeContent), and the theme runs through the same grading pipeline (OCR + Vertex AI grading), scoped to the group. Once members submit, results are shown as a ranked list within the group (real name or anonymous display, same model as WeeklyThemeEntry's real/anonymous ranking). This reuses the WeeklyTheme/WeeklyThemeContent/WeeklyThemeEntry data model shape but scoped per-group with a leader role instead of a global admin publisher. The bottom mobile nav bar has a 4th tab slot reserved for this feature (previously occupied by a duplicate 'Financeiro' link, now removed) — implementation should add a 'Grupos' tab there."

## Clarifications

### Session 2026-07-22

- Q: Quem pode criar um grupo e como os demais entram? → A: Qualquer aluno autenticado pode criar um grupo e se torna automaticamente seu líder; outros alunos entram via código/link de convite.
- Q: Como o líder define o conteúdo do tema proposto? → A: Texto livre e/ou upload de arquivo de referência, no mesmo modelo do Conteúdo de Apoio da Redação da Semana global.
- Q: A submissão a um tema de grupo consome crédito de correção / exige plano pago? → A: Segue exatamente a mesma regra de qualquer submissão regular do app — sem restrição adicional de plano.
- Q: Um grupo pode ter mais de um tema ativo ao mesmo tempo? → A: Não; apenas um tema ativo por grupo, mesma restrição do tema semanal global.
- Q: Há limite de tamanho de grupo ou de quantos grupos um aluno pode integrar? → A: Sim — no máximo 30 membros por grupo; um aluno pode integrar até 5 grupos (sem limite de quantos grupos pode liderar).
- Q: Membros do grupo veem a nota/redação uns dos outros? → A: Sim, ranking do tema do grupo, com opção de nome real ou anônimo por submissão, no mesmo modelo do ranking da Redação da Semana.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Aluno Cria um Grupo e Convida Colegas (Priority: P1)

Um aluno autenticado cria um novo grupo, dando um nome a ele, e se torna automaticamente seu líder. O sistema gera um código/link de convite único que o líder pode compartilhar. Outros alunos usam esse código/link para entrar no grupo, até o limite de 30 membros.

**Why this priority**: Sem um grupo com membros, nenhuma outra funcionalidade (proposta de tema, submissão, ranking) tem onde acontecer. É o pré-requisito de toda a feature.

**Independent Test**: Pode ser testado criando uma conta de aluno, criando um grupo, verificando que a conta se torna líder, copiando o código/link gerado, entrando com uma segunda conta através dele, e confirmando que a segunda conta aparece como membro do grupo.

**Acceptance Scenarios**:

1. **Given** um aluno autenticado, **When** ele cria um grupo informando um nome, **Then** o grupo é criado imediatamente, o aluno é registrado como líder, e um código/link de convite único é gerado.
2. **Given** um código/link de convite válido, **When** outro aluno autenticado o utiliza, **Then** ele passa a integrar o grupo como membro.
3. **Given** um grupo já com 30 membros, **When** um novo aluno tenta entrar pelo código/link, **Then** o sistema recusa a entrada e exibe mensagem informando que o grupo atingiu o limite.
4. **Given** um aluno que já integra 5 grupos, **When** ele tenta entrar em um sexto grupo via convite, **Then** o sistema recusa e exibe mensagem informando o limite de grupos por aluno (liderar grupos não conta nesse limite).
5. **Given** um aluno que já é membro de um grupo, **When** ele tenta usar o convite desse mesmo grupo novamente, **Then** o sistema não duplica sua participação.

---

### User Story 2 - Líder Propõe um Tema para o Grupo (Priority: P2)

O líder de um grupo propõe um tema de redação para os membros: escreve o enunciado e, opcionalmente, anexa conteúdo de apoio em texto livre e/ou arquivo (imagem ou PDF). Ao publicar, o tema fica ativo para todos os membros do grupo. Apenas um tema pode estar ativo por grupo por vez.

**Why this priority**: É o gatilho que dá propósito ao grupo — sem tema proposto, os membros não têm o que submeter.

**Independent Test**: Pode ser testado com um grupo já criado e com membros, o líder propondo um tema com enunciado e um conteúdo de apoio, e verificando que o tema aparece como ativo para todos os membros do grupo.

**Acceptance Scenarios**:

1. **Given** um líder de grupo sem tema ativo no grupo, **When** ele preenche o enunciado e publica o tema, **Then** o tema fica ativo imediatamente e visível para todos os membros do grupo.
2. **Given** um líder propondo um tema, **When** ele opcionalmente adiciona texto de apoio e/ou arquivo de referência, **Then** esse conteúdo é anexado ao tema e fica visível aos membros junto ao enunciado.
3. **Given** já existe um tema ativo no grupo, **When** o líder tenta propor um novo tema, **Then** o sistema impede a publicação e exige o encerramento do tema atual primeiro.
4. **Given** um membro do grupo que não é o líder, **When** ele tenta propor um tema, **Then** o sistema recusa a ação — apenas o líder pode propor temas.
5. **Given** um tema ativo no grupo, **When** o líder o encerra manualmente, **Then** o tema é marcado como encerrado e fica disponível para consulta no histórico do grupo.

---

### User Story 3 - Membro Submete Redação para o Tema do Grupo e Vê o Ranking (Priority: P2)

Um membro do grupo acessa o tema ativo, envia sua redação pelo mesmo fluxo de submissão já existente no app (foto → revisão de OCR → confirmação → avaliação pela IA), escolhendo se deseja aparecer no ranking do grupo com nome real ou de forma anônima. Após a avaliação, ele vê o ranking do tema com as notas de todos os membros que já submeteram.

**Why this priority**: É a proposta de valor central da feature — praticar com o grupo e comparar desempenho entre colegas, assim como acontece na Redação da Semana global, mas em escala de grupo.

**Independent Test**: Pode ser testado com um grupo, um tema ativo publicado pelo líder, e um membro enviando uma redação pelo fluxo existente; verifica-se que a submissão segue as mesmas regras de crédito de uma submissão regular, que é vinculada ao tema do grupo, e que a posição do membro aparece no ranking do grupo após a avaliação.

**Acceptance Scenarios**:

1. **Given** um membro do grupo com um tema ativo, **When** ele inicia a submissão, **Then** o fluxo de upload (foto → OCR → revisão → confirmação → avaliação) é executado de forma idêntica ao fluxo regular de submissão do app, sem restrição adicional de plano, e vinculado ao tema do grupo.
2. **Given** o membro está na etapa de confirmação, **When** antes de confirmar, **Then** o sistema exibe a opção de aparecer no ranking do grupo com nome real ou de forma anônima.
3. **Given** a avaliação da redação for concluída, **When** o membro acessa o ranking do tema do grupo, **Then** ele vê a lista de participantes ordenada por nota total, com nomes reais ou anônimos conforme a preferência de cada um.
4. **Given** um membro que já submeteu redação para o tema ativo do grupo, **When** ele tenta submeter outra redação para o mesmo tema, **Then** o sistema bloqueia e informa que já existe uma submissão para este tema.
5. **Given** um aluno que não é membro do grupo, **When** ele tenta acessar o tema ou submeter uma redação para ele, **Then** o sistema recusa o acesso.

---

### User Story 4 - Líder Gerencia o Grupo (Priority: P3)

O líder pode ver a lista de membros do grupo, remover um membro, regenerar o código/link de convite (invalidando o anterior) e encerrar/excluir o grupo.

**Why this priority**: Funcionalidade de manutenção esperada de quem administra um grupo, mas não bloqueia o uso inicial das Histórias 1–3.

**Independent Test**: Pode ser testado com um grupo com ao menos um membro além do líder; o líder remove esse membro e confirma que ele não tem mais acesso ao grupo; o líder regenera o convite e confirma que o código anterior deixa de funcionar.

**Acceptance Scenarios**:

1. **Given** um líder visualizando seu grupo, **When** ele acessa a lista de membros, **Then** vê todos os membros atuais do grupo.
2. **Given** um líder visualizando a lista de membros, **When** ele remove um membro, **Then** esse aluno perde acesso ao grupo e a seus temas, mas suas submissões e notas já registradas permanecem no histórico do grupo.
3. **Given** um líder de grupo, **When** ele regenera o código/link de convite, **Then** um novo código é gerado e o código anterior deixa de permitir entrada no grupo.
4. **Given** um líder de grupo, **When** ele exclui o grupo, **Then** o grupo deixa de existir para todos os membros, junto com seus temas e ranking associados.

---

### Edge Cases

- O que acontece se o líder exclui a própria conta ou não usa mais o app? → O grupo permanece existindo; a liderança não é transferida automaticamente nesta versão — o grupo fica sem líder ativo, mas membros mantêm acesso de leitura ao histórico e ranking existentes. Novas propostas de tema ficam bloqueadas até que uma solução de transferência de liderança seja implementada em versão futura (fora do escopo desta spec).
- O que acontece se dois membros têm a mesma nota total no ranking do grupo? → Mesmo critério de desempate da Redação da Semana: confirmação de submissão mais antiga tem prioridade.
- O que acontece se a avaliação de uma submissão falhar? → A submissão fica com status de erro, não entra no ranking do grupo, e o crédito é estornado conforme a regra já existente no sistema.
- O que acontece se um aluno tenta usar um código de convite de um grupo do qual já foi removido pelo líder? → O convite (se ainda válido) permite reentrada normalmente, salvo se o líder o regenerou.
- O que acontece com o tema e o ranking quando o grupo é excluído? → São excluídos junto com o grupo; não ficam acessíveis a antigos membros.
- O que acontece se não há tema ativo no grupo? → Membros veem mensagem informando que não há tema ativo no momento; podem ver o histórico de temas encerrados, se houver.

## Requirements *(mandatory)*

### Functional Requirements

**Criação e Composição do Grupo**

- **FR-001**: Qualquer aluno autenticado DEVE poder criar um grupo informando um nome; ao criar, o aluno é automaticamente registrado como líder do grupo.
- **FR-002**: Ao criar um grupo, o sistema DEVE gerar um código/link de convite único para esse grupo.
- **FR-003**: Qualquer aluno autenticado DEVE poder entrar em um grupo utilizando um código/link de convite válido, tornando-se membro.
- **FR-004**: O sistema DEVE impedir a entrada em um grupo que já tenha 30 membros.
- **FR-005**: O sistema DEVE impedir que um aluno integre mais de 5 grupos simultaneamente como membro; não há limite para quantos grupos um aluno pode liderar.
- **FR-006**: O líder DEVE poder visualizar a lista de membros do grupo.
- **FR-007**: O líder DEVE poder remover um membro do grupo; o membro removido perde acesso ao grupo, mas suas submissões e notas já registradas permanecem no histórico do grupo.
- **FR-008**: O líder DEVE poder regenerar o código/link de convite do grupo, invalidando o anterior.
- **FR-009**: O líder DEVE poder excluir o grupo, o que remove o grupo, seus temas e seu ranking para todos os membros.

**Proposta de Tema pelo Líder**

- **FR-010**: Apenas o líder do grupo DEVE poder propor um tema de redação para esse grupo; tentativas de outros membros DEVEM ser recusadas.
- **FR-011**: O líder DEVE poder propor um tema com enunciado obrigatório e conteúdo de apoio opcional, em texto livre e/ou arquivo (imagem ou PDF).
- **FR-012**: Ao publicar, o tema DEVE ficar ativo imediatamente e visível a todos os membros do grupo.
- **FR-013**: O sistema DEVE impedir a publicação de um novo tema em um grupo enquanto já existir um tema ativo nesse grupo; o líder DEVE encerrar o tema atual antes de propor outro.
- **FR-014**: O líder DEVE poder encerrar manualmente o tema ativo do grupo a qualquer momento.

**Submissão pelo Membro**

- **FR-015**: Apenas membros do grupo (incluindo o líder) DEVEM poder submeter uma redação para o tema ativo desse grupo.
- **FR-016**: A submissão a um tema de grupo DEVE seguir o fluxo de submissão já existente no app (upload de foto → revisão de OCR → confirmação → avaliação), sujeita às mesmas regras de plano e consumo de crédito de qualquer submissão regular — sem restrição adicional de plano.
- **FR-017**: Cada membro DEVE poder submeter no máximo uma redação por tema de grupo; o sistema DEVE bloquear submissões adicionais para o mesmo tema.
- **FR-018**: Antes de confirmar a submissão, o membro DEVE poder escolher se deseja aparecer no ranking do grupo com nome real ou de forma anônima; essa preferência é por submissão, não uma configuração global do perfil.

**Ranking do Grupo**

- **FR-019**: O sistema DEVE exibir, para os membros do grupo, um ranking do tema ativo (ou do último tema encerrado) ordenado por nota total decrescente.
- **FR-020**: O ranking do grupo DEVE ser visível apenas a membros desse grupo, não publicamente.
- **FR-021**: Participantes que escolheram anonimato DEVEM aparecer no ranking com identificação genérica, sem revelar nome ou dado identificável.
- **FR-022**: Em caso de empate na nota total, a posição superior DEVE ser atribuída ao membro que confirmou a submissão mais cedo.

**Navegação**

- **FR-023**: O sistema DEVE prover um ponto de entrada "Grupos" na barra de navegação inferior mobile, listando os grupos que o aluno lidera ou integra.

### Key Entities

- **Grupo**: Representa uma turma de alunos organizada por um líder. Possui nome, líder (referência ao aluno criador), código/link de convite ativo e lista de membros (até 30). Um aluno pode integrar até 5 grupos como membro, sem limite como líder.
- **Tema do Grupo**: Desafio de redação proposto pelo líder para os membros do grupo. Possui enunciado, conteúdo de apoio opcional, data de publicação e estado (ativo/encerrado). Apenas um tema pode estar ativo por grupo por vez. Estruturalmente equivalente ao Tema Semanal global, porém escopado a um grupo e publicado por um líder em vez de um administrador.
- **Conteúdo de Apoio do Tema de Grupo**: Material opcional vinculado a um tema de grupo — texto digitado pelo líder ou arquivo enviado (imagem ou PDF). Mesmo modelo do Conteúdo de Apoio da Redação da Semana global.
- **Participação no Tema de Grupo**: Registro que vincula a submissão de um membro a um tema de grupo específico. Armazena a preferência de exibição (nome ou anônimo) e a nota total, usada para montar o ranking do grupo.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Um aluno consegue criar um grupo e obter um código/link de convite compartilhável em menos de 1 minuto.
- **SC-002**: Um aluno convidado consegue entrar em um grupo usando o código/link em menos de 30 segundos.
- **SC-003**: O líder consegue propor um tema completo (enunciado + conteúdo de apoio opcional) em menos de 5 minutos.
- **SC-004**: O ranking do grupo reflete uma nova submissão avaliada em menos de 1 minuto após a conclusão da avaliação.
- **SC-005**: 100% das submissões vinculadas a temas de grupo seguem o mesmo fluxo de avaliação e as mesmas regras de crédito das submissões regulares, sem divergência de comportamento.
- **SC-006**: O ponto de entrada "Grupos" na navegação mobile está acessível em até 1 toque a partir de qualquer tela principal do app.

## Assumptions

- A submissão a um tema de grupo não exige nenhum plano específico nem cria uma nova regra de consumo de crédito; segue exatamente a mesma regra já aplicada a qualquer submissão regular do app.
- O papel de líder é exclusivo do criador do grupo nesta versão; não há mecanismo de transferência de liderança ou de múltiplos líderes (ver Edge Cases sobre líder inativo).
- O código/link de convite não expira por tempo; permanece válido até ser regenerado ou até o grupo ser excluído.
- Assim como a Redação da Semana global, os arquivos de conteúdo de apoio enviados pelo líder são armazenados no mesmo serviço de armazenamento já usado pelo projeto, sem exclusão automática.
- A preferência de anonimato é configurada por submissão, no mesmo padrão já usado na Redação da Semana.
- Um grupo excluído remove permanentemente seus temas, conteúdos de apoio e ranking; não há período de retenção ou recuperação nesta versão.
- O histórico de temas encerrados do grupo fica disponível indefinidamente aos membros atuais, sem política de exclusão automática.
