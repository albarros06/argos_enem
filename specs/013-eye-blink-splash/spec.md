# Feature Specification: Animação de Abertura do Olho na Tela de Login

**Feature Branch**: `013-eye-blink-splash`

**Created**: 2026-07-22

**Status**: Draft

**Input**: User description: "A splash/loading screen animation for the Argos ENEM app: an
eye that blinks/opens as the app's brand mark or mascot, shown while the app is loading. This
is a brand-new design asset that does not yet exist in the Claude Design project — design it
from scratch as part of this spec, then implement it as a loading/splash animation in the
Next.js app." Refinado após localizar o mockup já desenhado pelo usuário em um projeto
separado do Claude Design ("Friendly eye blinking animation", arquivo `Login Intro.dc.html`):
uma sobreposição de tela cheia com uma sobrancelha que se levanta, uma "pálpebra" (formato de
olho) que pisca três vezes e depois se abre, uma íris que aparece com um leve efeito de zoom,
e a sobreposição inteira se dissolve revelando o formulário de login por trás — tudo em
aproximadamente 2 segundos.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Aluno acessa a tela de login e a marca "acorda" (Priority: P1)

Um aluno acessa a tela de login do Argos (acesso direto ou recarregamento da página). Em vez
do formulário aparecer imediatamente sem nenhuma introdução, ele vê uma sobreposição com a
marca do Argos representada como um olho: uma sobrancelha se ajusta, o olho pisca algumas
vezes, se abre, e a sobreposição se dissolve suavemente revelando o formulário de login (que
já carregou por trás, pronto para uso assim que a sobreposição sai).

**Why this priority**: É o núcleo do pedido e o único ponto onde o mockup já existente se
aplica de forma concreta — a tela de login é o portão de entrada do produto para a grande
maioria dos acessos (usuário deslogado). Sem isso não há feature.

**Independent Test**: Acessar a tela de login (ou recarregar a página de login) e observar a
sobreposição da animação do olho aparecer, completar seu ciclo, e se dissolver revelando o
formulário de login pronto para uso, sem nenhuma ação do aluno.

**Acceptance Scenarios**:

1. **Given** um aluno acessa a tela de login, **When** a página começa a carregar, **Then** a
   sobreposição com a animação do olho é exibida cobrindo a tela, com o formulário de login
   carregando por trás dela.
2. **Given** a animação do olho está em exibição, **When** o ciclo da animação termina
   (sobrancelha ajustada, olho aberto), **Then** a sobreposição se dissolve automaticamente e o
   formulário de login fica visível e utilizável, sem qualquer clique ou ação do aluno.
3. **Given** a conexão do aluno é lenta e o formulário de login ainda não terminou de carregar
   por trás da sobreposição, **When** o tempo máximo da animação é atingido, **Then** a
   sobreposição se dissolve de qualquer forma (ver FR-005) — ela nunca trava esperando o
   conteúdo real.

---

### User Story 2 - Recarregar a tela de login repete a introdução; navegar para longe dela, não (Priority: P2)

Um aluno que recarrega a tela de login (ex.: atualizou a página, ou saiu e voltou depois de um
logout) vê a introdução de novo — cada carregamento completo da tela de login é tratado como
uma "primeira impressão" própria. Já a navegação para outras telas do app (após já estar
logado, por exemplo) não deve, em nenhuma circunstância, reexibir essa introdução — ela é
exclusiva da tela de login.

**Why this priority**: Sem essa distinção, a introdução poderia vazar para outras partes do
app de forma inconsistente ou repetitiva. Prioridade P2 porque a P1 já entrega o valor central;
isso apenas garante que o escopo fique contido à tela de login.

**Independent Test**: Fazer login com sucesso (saindo da tela de login) e confirmar que a
introdução não aparece em nenhuma tela subsequente do app (painel, redações, etc.); recarregar
a tela de login isoladamente e confirmar que a introdução aparece de novo.

**Acceptance Scenarios**:

1. **Given** um aluno completa o login com sucesso, **When** ele é levado para o painel do app,
   **Then** a animação do olho não aparece em nenhuma tela além da tela de login.
2. **Given** um aluno recarrega a tela de login, **When** a página carrega novamente,
   **Then** a animação do olho é exibida de novo, do início.

---

### User Story 3 - Aluno com sensibilidade a movimento (Priority: P3)

Um aluno que configurou o sistema/navegador para reduzir animações (`prefers-reduced-motion`)
acessa a tela de login. Em vez da introdução animada (piscar, sobrancelha se movendo, zoom da
íris), ele vê a marca já no seu estado final (olho aberto), sem os movimentos, e o formulário
de login aparece normalmente.

**Why this priority**: Acessibilidade é importante, mas afeta uma fração menor dos usuários e
não bloqueia o valor central da feature — pode ser adicionado depois da P1/P2 sem retrabalho.

**Independent Test**: Ativar "reduzir movimento" nas preferências do sistema operacional/
navegador, acessar a tela de login, e confirmar que a marca aparece no estado final (sem
piscar/mover), sem erros visuais, e o formulário de login aparece normalmente.

**Acceptance Scenarios**:

1. **Given** o navegador do aluno reporta preferência por movimento reduzido, **When** a tela
   de login carrega, **Then** a marca aparece já no estado final (sem animação de piscar ou
   ajuste de sobrancelha), sem quebra de layout, e o formulário de login segue disponível como
   de costume.

### Edge Cases

- E se o formulário de login por trás da sobreposição já estiver pronto antes do fim do ciclo
  da animação? A introdução ainda cumpre seu ciclo completo (ela marca a identidade da marca,
  não é apenas um indicador de espera), respeitando o teto de tempo definido em FR-003.
- E se JavaScript estiver desabilitado ou falhar ao carregar? A marca deve continuar aparecendo
  de forma estática (sem o movimento de piscar), sem bloquear o carregamento do formulário de
  login por trás — a marca não pode depender de script para ao menos aparecer (FR-006). Como o
  próprio formulário de login desta tela específica também depende de script para se montar
  hoje, este caso é um cenário de degradação geral da tela, não algo introduzido por esta
  feature.
- E se o aluno recarregar a tela de login múltiplas vezes rapidamente (ex.: F5 repetido)? Cada
  recarregamento é tratado como um novo carregamento completo — a introdução roda de novo a
  cada um; não há necessidade de lembrar que o aluno "já viu" entre recarregamentos completos.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema DEVE exibir, ao carregar a tela de login, uma sobreposição de tela
  cheia com a marca do Argos representada como um olho que pisca e se abre, cobrindo o
  formulário de login enquanto ele carrega por trás.
- **FR-002**: A animação DEVE seguir a composição já definida no mockup de referência: uma
  sobrancelha que se ajusta discretamente, uma pálpebra que fecha e abre em um ciclo de
  piscadas antes de se estabilizar aberta, e uma íris que aparece com um leve efeito de
  aproximação (zoom) coincidindo com o momento em que a sobreposição começa a se dissolver.
- **FR-003**: A sobreposição DEVE se dissolver (fade) automaticamente ao final do ciclo da
  animação, sem exigir clique ou ação do aluno, revelando o formulário de login pronto para
  uso. A duração total do ciclo (piscar + estabilizar + dissolver) DEVE respeitar um teto
  máximo, mesmo que o carregamento do restante da tela demore mais que isso.
- **FR-004**: O sistema DEVE respeitar a preferência `prefers-reduced-motion` do usuário,
  mostrando a marca já no estado final (olho aberto, sobrancelha ajustada) sem os movimentos de
  piscar/ajuste/zoom, quando essa preferência estiver ativa.
- **FR-005**: A introdução NÃO DEVE bloquear ou atrasar o carregamento do formulário de login —
  o formulário carrega em paralelo por trás da sobreposição, não é bloqueado por ela.
- **FR-006**: A introdução DEVE ser leve o bastante para aparecer de forma confiável mesmo sem
  a execução completa de scripts da página, e não pode exigir a adoção de novas ferramentas ou
  bibliotecas de terceiros para existir — mantendo a simplicidade do produto.
- **FR-007**: A introdução DEVE usar as cores e o estilo de marca já estabelecidos no restante
  do produto (mesma paleta e identidade visual já usada nos outros pontos de marca do app),
  para manter consistência visual.
- **FR-008**: A introdução é exclusiva da tela de login — o sistema NÃO DEVE exibi-la em
  nenhuma outra tela do app (painel, redações, grupos, etc.), inclusive após um login
  bem-sucedido.
- **FR-009**: A introdução DEVE funcionar tanto em telas móveis quanto em desktop, escalando de
  forma proporcional ao tamanho da tela.

### Key Entities

Esta feature é puramente visual/de apresentação — não introduz nem modifica entidades de
dados, tabelas ou modelos.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A sobreposição nunca permanece visível por mais de 2,5 segundos, mesmo em
  conexões lentas — o teto máximo garante que ela nunca vire um obstáculo perceptível ao acesso
  à tela de login.
- **SC-002**: 100% dos carregamentos completos da tela de login exibem a introdução; 0% das
  demais telas do app a exibem, inclusive imediatamente após um login bem-sucedido.
- **SC-003**: Usuários com preferência de movimento reduzido veem a marca em seu estado final
  (sem animação) em 100% dos casos, sem erros de layout ou de renderização, e sem qualquer
  atraso adicional para acessar o formulário de login.
- **SC-004**: A adição da introdução não introduz atraso perceptível ao tempo de carregamento
  da tela de login em relação ao estado atual do produto.

## Assumptions

- O ativo visual já existe, desenhado pelo usuário: um mockup funcional ("Friendly eye blinking
  animation" → `Login Intro.dc.html`) especifica a composição exata (sobrancelha, pálpebra que
  pisca três vezes antes de abrir, íris com leve zoom, dissolução da sobreposição) e a duração
  total de aproximadamente 2 segundos. Esta spec formaliza esse mockup como a fonte da verdade
  visual para a implementação, em vez de descrever a animação do zero.
- O escopo é a tela de login especificamente — não o app inteiro. O pedido original ("shown
  while the app is loading") se concretiza, no mockup existente, como uma introdução acoplada
  ao carregamento da tela de login (o portão de entrada do produto para usuários deslogados),
  não como uma sobreposição genérica reaproveitada em toda navegação do app. Reaproveitar a
  animação em outros pontos (ex.: cadastro, primeiro acesso ao painel) fica fora do escopo
  deste v1 e pode ser considerado depois, caso o resultado aqui funcione bem.
- A introdução roda a cada carregamento completo da tela de login (recarregamento incluso), não
  apenas na "primeira visita de todas" do usuário — não há necessidade de persistir um estado
  de "já vi isso" entre recarregamentos completos do navegador.
- Não há áudio, vibração/haptics ou qualquer elemento sonoro associado à animação (o mockup de
  referência não inclui nenhum).
- Esta feature é inteiramente de apresentação/marca — não altera nenhuma lógica de negócio,
  autenticação, ou fluxo funcional existente da tela de login.
