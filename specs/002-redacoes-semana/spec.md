# Feature Specification: Argos — Redações da Semana

**Feature Branch**: `002-redacoes-semana`

**Created**: 2026-06-15

**Status**: Draft

**Input**: User description: "Adicionar ao Argos um sistema de Redações da Semana. Um administrador publica, via painel interno (/admin, rota protegida por role de administrador), um tema semanal de redação contendo um enunciado e, opcionalmente, textos de apoio (campos de texto livre e/ou upload de imagens ou PDFs, ambos suportados). Apenas um tema pode estar ativo por vez; a publicação é imediata (sem agendamento). A duração padrão é de 7 dias, mas o administrador pode encerrar o tema antecipadamente ou estender o prazo livremente a qualquer momento. Após o encerramento, o ranking público desaparece. Somente assinantes do plano premium (o mais caro) podem submeter uma redação para o tema da semana. A submissão segue o fluxo existente de upload, vinculada ao tema ativo, e consome um crédito de correção normalmente. Cada aluno pode enviar apenas uma redação por tema. O ranking público exibe os 50 maiores pontuadores do tema ativo e é visível para todos. O aluno pode escolher aparecer no ranking como anônimo ou com nome. Assinantes premium também visualizam sua própria posição mesmo fora do top 50. Um contador de tempo restante é exibido para todos. Após o encerramento, o ranking público desaparece; o aluno mantém histórico de sua posição por tema. O painel admin permite criar temas, gerenciar ciclo de vida e acompanhar métricas do tema e gerais do app."

## Clarifications

### Session 2026-06-15

- Q: O que são as "Redações da Semana"? → A: Temas semanais curados pelo admin para que alunos premium pratiquem e concorram em ranking.
- Q: Quem define os temas e como? → A: Administrador via painel interno (`/admin`, rota protegida por role); publicação imediata, sem agendamento.
- Q: Visibilidade do ranking — quem pode ver? → A: Todos — visitantes não autenticados, plano gratuito, plano básico e premium — podem ver o ranking público (top 50). Apenas assinantes premium podem submeter.
- Q: A submissão consome crédito? → A: Sim, consome um crédito de correção normalmente.
- Q: Ciclo de vida do tema? → A: Duração padrão de 7 dias; admin pode encerrar antecipadamente ou estender livremente; encerramento automático ao fim do prazo.
- Q: Acesso por plano? → A: Submissão exclusiva para assinantes do plano premium (mais caro); visualização do ranking é pública.
- Q: Ranking — detalhes? → A: Top 50 público; aluno escolhe nome real ou anônimo; premium vê sua posição mesmo fora do top 50; exibe nota total (0–1000).
- Q: Múltiplas submissões? → A: Uma por tema, sem reenvio.
- Q: Textos de apoio? → A: Opcionais; texto livre e/ou upload de imagens/PDFs, ambos suportados.
- Q: Visibilidade antes de participar? → A: Sim, qualquer visitante vê o ranking sem precisar submeter.
- Q: Após encerramento? → A: Ranking público some; aluno mantém histórico de posição por tema (não cumulativo).
- Q: Painel admin? → A: Rota protegida no próprio app; cria/publica temas, gerencia ciclo de vida (encerrar/estender), vê métricas do tema e métricas gerais do app.
- Q: Usuários não autenticados podem ver o ranking? → A: Sim, o ranking público é acessível sem login.
- Q: O admin pode encerrar/estender o tema? → A: Sim, livremente a qualquer momento.
- Q: Há contador de tempo restante? → A: Sim, visível para todos.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Administrador Publica Tema Semanal (Priority: P1)

Um administrador acessa o painel interno, preenche o enunciado do tema da semana e, opcionalmente, adiciona textos de apoio (em texto ou arquivo). Ao publicar, o tema vai ao ar imediatamente com prazo padrão de 7 dias. O administrador pode, a qualquer momento, encerrar o tema antes do prazo ou estendê-lo.

**Why this priority**: Sem um tema ativo publicado pelo admin, nenhuma outra funcionalidade do sistema tem valor. É o pré-requisito de toda a feature.

**Independent Test**: Pode ser testado de forma independente acessando o painel admin com credenciais de administrador, publicando um tema com enunciado e ao menos um texto de apoio (texto e arquivo), verificando que o tema aparece como ativo na interface, e confirmando que o prazo exibido é de 7 dias a partir da publicação.

**Acceptance Scenarios**:

1. **Given** um usuário com role de administrador autenticado no painel admin, **When** ele preenche o enunciado e publica o tema, **Then** o tema vai ao ar imediatamente com prazo de 7 dias e passa a ser o único tema ativo.
2. **Given** um tema ativo publicado, **When** o admin estende o prazo, **Then** o novo prazo é refletido imediatamente no contador público e nos registros do sistema.
3. **Given** um tema ativo publicado, **When** o admin o encerra manualmente, **Then** o tema é marcado como encerrado e o ranking público para de ser exibido.
4. **Given** já existe um tema ativo, **When** o admin tenta publicar um novo tema, **Then** o sistema impede a publicação e exige o encerramento do tema atual primeiro.
5. **Given** um tema ativo com prazo expirado, **When** o prazo atinge zero, **Then** o tema é encerrado automaticamente sem intervenção do admin.

---

### User Story 2 - Aluno Premium Submete Redação e Concorre ao Ranking (Priority: P2)

Um assinante do plano premium acessa o tema semanal ativo, escreve e fotografa sua redação, e a envia pelo mesmo fluxo de upload existente (foto → revisão de OCR → confirmação → avaliação pela IA). A submissão é vinculada ao tema da semana e consome um crédito de correção. Antes de confirmar, o aluno escolhe se quer aparecer no ranking com seu nome real ou de forma anônima. Após a avaliação, o aluno vê sua posição no ranking do tema.

**Why this priority**: É a proposta de valor central da feature para o usuário — praticar com tema real e comparar desempenho com outros alunos.

**Independent Test**: Pode ser testado registrando uma conta com assinatura premium, com um tema ativo publicado pelo admin, enviando uma redação pelo fluxo existente, verificando que um crédito foi consumido, que a avaliação foi entregue e que a posição do aluno aparece no ranking do tema.

**Acceptance Scenarios**:

1. **Given** um aluno premium com créditos disponíveis e um tema ativo, **When** ele acessa o tema e inicia a submissão, **Then** o fluxo de upload (foto → OCR → revisão → confirmação → avaliação) é executado de forma idêntica ao fluxo regular, com a submissão vinculada ao tema da semana.
2. **Given** o aluno está na etapa de confirmação da submissão, **When** antes de confirmar, **Then** o sistema exibe opção para escolher aparecer no ranking com nome real ou de forma anônima.
3. **Given** a avaliação da redação for concluída, **When** o aluno acessa o ranking do tema ativo, **Then** ele vê sua posição no ranking, mesmo que esteja fora do top 50.
4. **Given** um aluno premium já submeteu redação para o tema ativo, **When** ele tenta submeter outra redação para o mesmo tema, **Then** o sistema bloqueia e exibe mensagem informando que já há uma submissão para este tema.
5. **Given** um aluno que não é assinante premium (sem plano ou plano básico), **When** ele tenta acessar a submissão do tema semanal, **Then** o sistema exibe mensagem de que a participação é exclusiva para assinantes do plano premium.

---

### User Story 3 - Qualquer Visitante Visualiza o Ranking Público (Priority: P3)

Qualquer pessoa — autenticada ou não, em qualquer plano — pode acessar o ranking público do tema semanal ativo, visualizando os 50 maiores pontuadores com suas notas totais, preferências de exibição (nome ou anônimo), e o contador de tempo restante até o encerramento.

**Why this priority**: A visibilidade pública do ranking é o que gera engajamento e atrai alunos não-assinantes a desejarem participar (vetor de conversão para o plano premium).

**Independent Test**: Pode ser testado sem autenticação, acessando a página de ranking do tema ativo, verificando que os dados são exibidos corretamente (top 50, notas, nomes/anônimos, contador) e que nenhum login é solicitado.

**Acceptance Scenarios**:

1. **Given** um tema ativo com ao menos uma submissão avaliada, **When** qualquer visitante (autenticado ou não) acessa o ranking, **Then** ele vê os até 50 maiores pontuadores com nota total (0–1000) e indicação de nome real ou anônimo conforme preferência de cada participante.
2. **Given** o ranking está sendo exibido, **When** o visitante olha para o contador, **Then** o tempo restante até o encerramento do tema é exibido de forma legível (dias, horas, minutos).
3. **Given** um aluno que preferiu aparecer como anônimo ao submeter, **When** o ranking é exibido, **Then** seu nome não é revelado; aparece uma identificação genérica no lugar.
4. **Given** o tema é encerrado (por prazo ou pelo admin), **When** qualquer visitante acessa a página do ranking, **Then** o ranking público não é mais exibido.

---

### User Story 4 - Aluno Consulta Histórico de Participação em Temas Anteriores (Priority: P4)

Um aluno que participou de temas encerrados pode consultar seu histórico de participação, visualizando os temas em que submeteu redação e sua posição final no ranking de cada tema.

**Why this priority**: Permite que o aluno acompanhe sua evolução ao longo das semanas e mantenha o valor das participações passadas mesmo após o ranking público desaparecer.

**Independent Test**: Pode ser testado com uma conta que tenha participado de ao menos um tema já encerrado, verificando que o histórico lista o tema, a nota obtida e a posição final no ranking daquele tema.

**Acceptance Scenarios**:

1. **Given** um aluno autenticado que participou de ao menos um tema encerrado, **When** ele acessa seu histórico de participação, **Then** vê uma lista de temas anteriores com: título do tema, nota total obtida e posição final no ranking.
2. **Given** o histórico de participação sendo exibido, **When** o aluno visualiza um tema encerrado, **Then** a posição exibida é a posição final registrada no momento do encerramento, não uma posição recalculada.

---

### User Story 5 - Administrador Acompanha Métricas do Sistema (Priority: P5)

O administrador acessa o painel admin e visualiza métricas do tema ativo (ou de temas encerrados), como número de participantes, média de notas e distribuição de pontuações por competência. Além disso, visualiza métricas gerais do app: total de usuários cadastrados, total de submissões e usuários ativos por plano.

**Why this priority**: Permite que o admin tome decisões informadas sobre temas futuros e acompanhe a saúde do produto.

**Independent Test**: Pode ser testado com ao menos um tema que tenha submissões avaliadas, verificando que o painel admin exibe os dados corretos de participação, e que as métricas gerais do app refletem os dados reais de usuários e submissões.

**Acceptance Scenarios**:

1. **Given** o admin está no painel admin, **When** acessa as métricas de um tema (ativo ou encerrado), **Then** vê: número total de participantes, média de nota total, e distribuição de pontuações por cada uma das 5 competências do ENEM.
2. **Given** o admin está no painel admin, **When** acessa as métricas gerais do app, **Then** vê: total de usuários cadastrados, total de submissões realizadas e quantidade de usuários ativos em cada plano (gratuito, básico, premium).

---

### Edge Cases

- O que acontece se um aluno tem o plano premium cancelado após submeter mas antes do encerramento do tema? → A submissão permanece válida; posição no ranking é mantida até o encerramento.
- O que acontece se não há tema ativo? → O ranking não é exibido; usuários premium veem mensagem informando que não há tema ativo no momento.
- O que acontece se dois alunos têm a mesma nota total? → Critério de desempate: data/hora de confirmação da submissão (mais antiga tem prioridade — quem enviou primeiro mantém a posição superior).
- O que acontece se a avaliação da redação falhar (erro no processamento)? → A submissão fica com status de erro; não entra no ranking; o crédito é estornado conforme a regra já existente no sistema.
- O que acontece com os textos de apoio e arquivos após o encerramento do tema? → Permanecem armazenados e acessíveis ao admin no histórico de temas encerrados.
- O que acontece se o aluno confirma a submissão e o tema encerra antes da avaliação ser concluída? → A avaliação é processada normalmente; a posição final é registrada com base no ranking no momento do encerramento automático.

## Requirements *(mandatory)*

### Functional Requirements

**Painel Admin e Temas**

- **FR-001**: O sistema DEVE restringir o acesso ao painel administrativo (`/admin`) a usuários com role de administrador; tentativas de acesso sem essa role DEVEM ser rejeitadas.
- **FR-002**: O administrador DEVE poder criar um tema semanal com: enunciado obrigatório (título + texto do tema) e textos de apoio opcionais.
- **FR-003**: Textos de apoio DEVEM suportar dois formatos: campos de texto livre digitados pelo admin e upload de arquivos (imagens e PDFs); ambos podem coexistir no mesmo tema.
- **FR-004**: Ao publicar um tema, ele DEVE ir ao ar imediatamente com prazo padrão de 7 dias a partir da data/hora de publicação.
- **FR-005**: O sistema DEVE impedir a publicação de um novo tema enquanto já existe um tema ativo; o admin DEVE encerrar o tema atual antes de publicar outro.
- **FR-006**: O sistema DEVE encerrar automaticamente o tema ativo ao fim do prazo definido.
- **FR-007**: O administrador DEVE poder encerrar manualmente o tema ativo a qualquer momento antes do prazo.
- **FR-008**: O administrador DEVE poder estender o prazo do tema ativo livremente, sem limite de número de extensões.

**Submissão pelo Aluno**

- **FR-009**: Apenas assinantes do plano premium DEVEM poder submeter uma redação vinculada ao tema semanal ativo; usuários de outros planos DEVEM ver mensagem explicando a restrição.
- **FR-010**: A submissão da redação da semana DEVE seguir o fluxo existente (upload de foto → revisão de transcrição OCR → confirmação → avaliação pela IA), com a submissão vinculada ao tema ativo no momento da confirmação.
- **FR-011**: A submissão DEVE consumir um crédito de correção do plano do aluno, exatamente como uma correção regular.
- **FR-012**: Cada aluno DEVE poder submeter no máximo uma redação por tema; o sistema DEVE bloquear tentativas de submissão adicional para o mesmo tema.
- **FR-013**: Antes de confirmar a submissão, o aluno DEVE poder escolher se deseja aparecer no ranking com seu nome real ou de forma anônima; essa preferência é por tema (não afeta outras submissões ou o perfil global).

**Ranking Público**

- **FR-014**: O sistema DEVE exibir um ranking público com os 50 maiores pontuadores do tema ativo, ordenados por nota total (0–1000) decrescente.
- **FR-015**: O ranking público DEVE ser acessível a qualquer visitante, autenticado ou não, em qualquer plano.
- **FR-016**: Participantes que escolheram anonimato DEVEM aparecer no ranking com identificação genérica, sem revelar nome ou qualquer dado identificável.
- **FR-017**: Assinantes premium que submeteram redação DEVEM poder visualizar sua própria posição ordinal no ranking, mesmo quando estão fora do top 50.
- **FR-018**: O ranking DEVE exibir um contador de tempo restante até o encerramento do tema, visível para todos os visitantes enquanto o tema estiver ativo.
- **FR-019**: Após o encerramento do tema (automático ou manual), o ranking público DEVE ser removido da exibição.
- **FR-020**: Em caso de empate na nota total, a posição superior DEVE ser atribuída ao aluno que confirmou a submissão mais cedo (desempate por data/hora de confirmação).

**Histórico e Métricas**

- **FR-021**: O aluno autenticado DEVE poder consultar seu histórico de participação em temas anteriores, incluindo: título do tema, nota total obtida e posição final no ranking de cada tema encerrado.
- **FR-022**: O administrador DEVE poder visualizar métricas de cada tema (ativo ou encerrado): número de participantes, média de nota total e distribuição de pontuações por competência (C1–C5).
- **FR-023**: O administrador DEVE poder visualizar métricas gerais do app: total de usuários cadastrados, total de submissões realizadas e contagem de usuários ativos por plano.

### Key Entities

- **Tema Semanal**: Representa um desafio de redação publicado pelo admin. Possui enunciado, textos de apoio opcionais, data/hora de publicação, prazo de encerramento e estado (ativo / encerrado). Apenas um tema pode estar ativo por vez.
- **Conteúdo de Apoio**: Material opcional vinculado a um tema. Pode ser texto digitado pelo admin ou arquivo enviado (imagem ou PDF). Um tema pode ter múltiplos conteúdos de apoio de ambos os tipos.
- **Participação em Tema**: Registro que vincula a submissão de redação de um aluno a um tema semanal específico. Armazena a preferência de exibição (nome ou anônimo) e a posição final do aluno no ranking após o encerramento do tema.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: O administrador consegue criar e publicar um tema completo (enunciado + ao menos um texto de apoio em texto e um arquivo) em menos de 5 minutos.
- **SC-002**: O ranking público reflete uma nova submissão avaliada em menos de 1 minuto após a conclusão da avaliação.
- **SC-003**: O encerramento automático do tema ocorre dentro de 5 minutos do prazo definido, sem intervenção manual.
- **SC-004**: 100% das submissões vinculadas a temas semanais seguem o mesmo fluxo de avaliação e consumo de crédito das correções regulares, sem divergências de comportamento.
- **SC-005**: A posição final de cada participante está registrada no histórico individual em até 5 minutos após o encerramento do tema.
- **SC-006**: O ranking público é carregado em menos de 2 segundos para visitantes não autenticados.
- **SC-007**: O painel de métricas do admin reflete submissões novas em menos de 5 minutos.

## Assumptions

- A role de administrador já existe ou será criada no sistema de autenticação vigente; o painel `/admin` é uma nova rota protegida por essa role dentro do mesmo app.
- Os arquivos de apoio enviados pelo admin (imagens/PDFs) são armazenados no mesmo serviço de armazenamento de objetos já utilizado pelo projeto, sem prazo automático de exclusão (diferentemente das fotos de redação dos alunos, que são deletadas após a transcrição).
- O fluxo de submissão da redação da semana reutiliza integralmente o módulo e a lógica de submissão existentes; a vinculação ao tema semanal é um atributo adicional na submissão, não um fluxo paralelo.
- Não há notificação por e-mail ou push para eventos do tema semanal (publicação, encerramento, atualização de posição); comunicação é exclusivamente na interface do app.
- A preferência de anonimato é configurada por tema no momento da confirmação da submissão; não é uma configuração global do perfil do aluno.
- A posição exibida ao aluno fora do top 50 é sua posição ordinal entre todos os participantes com avaliação concluída no tema.
- Não há limite de extensões de prazo por parte do admin; o admin pode estender quantas vezes quiser.
- O histórico de participação do aluno fica disponível indefinidamente; não há política de exclusão dos registros de participação em temas encerrados.
- A distribuição de pontuações por competência nas métricas do admin considera somente submissões com avaliação concluída (status de sucesso).
