# Feature Specification: Argos — ENEM Essay Grading Platform

**Feature Branch**: `001-enem-essay-grading`

**Created**: 2026-06-10

**Status**: Draft

**Input**: User description: "Build a web application that automatically grades handwritten ENEM essays using AI. The user flow requires students to create an account and upload a photo of their handwritten essay. The backend should use a cost-effective OCR API to extract the text from the image. This text is then processed by a balanced cost-to-performance LLM to grade the essay strictly based on the 5 official ENEM competencies. The evaluation output must include the total score, a breakdown of the score per competency, inline annotations on the text for specific corrections, and a general feedback comment. The app must include a progress dashboard for users to track their historical performance over time. Implement a freemium business model: users get a small allowance of free corrections before hitting a paywall. Integrate a low-cost payment gateway to handle subscription plans, structured to facilitate an upsell strategy."

## Clarifications

### Session 2026-06-10

- Q: Após a extração do texto da foto, o aluno deve revisar/confirmar a transcrição
  antes que a correção seja executada? → A: O aluno revisa e pode corrigir erros de
  OCR antes da correção; o crédito é consumido na confirmação.
- Q: O que diferencia o plano premium do plano de entrada no lançamento? → A: Apenas
  a cota mensal de correções (maior no premium); nenhum outro benefício no v1.
- Q: Correções mensais não utilizadas acumulam para o ciclo seguinte? → A: Não — a
  cota não usada expira ao fim de cada ciclo de cobrança (sem rollover).
- Q: Por quanto tempo a foto original da redação deve ser mantida? → A: A imagem é
  excluída após a confirmação da transcrição (ou após falha/abandono do envio);
  apenas texto, anotações e avaliações são mantidos.
- Q: Como o aluno é notificado quando a correção fica pronta? → A: Apenas no app —
  status em tempo real na interface e indicador ao retornar; sem e-mail/push no v1.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Submit Handwritten Essay and Receive Evaluation (Priority: P1)

A student preparing for the ENEM exam creates an account, photographs their handwritten
essay, selects or types the essay theme (prompt), and uploads the photo. The system
extracts the handwritten text and presents the transcription for the student to review;
the student may correct extraction (OCR) errors and then confirms. Upon confirmation —
the moment the correction credit is consumed — the system evaluates the confirmed text
strictly against the 5 official ENEM competencies, and presents: the total score (0–1000), the score per competency (0–200
each), inline annotations anchored to specific passages of the transcribed text, and a
general feedback comment summarizing strengths and improvement areas.

**Why this priority**: This is the core value proposition — automated, exam-aligned
essay feedback. Without it, no other feature has value.

**Independent Test**: Can be fully tested by registering a new account, uploading a
legible photo of a handwritten essay, and verifying that a complete evaluation (total
score, 5 competency scores, at least one inline annotation, and a feedback comment) is
delivered and stored.

**Acceptance Scenarios**:

1. **Given** a registered, logged-in student with available correction credits,
   **When** they upload a legible photo of a handwritten essay, provide the essay
   theme, and confirm the reviewed transcription, **Then** they receive an evaluation
   containing a total score (0–1000), five competency scores (each 0–200 in 40-point
   increments), inline annotations linked to specific text passages, and a general
   feedback comment.
2. **Given** a transcription was extracted from the photo, **When** the student
   reviews it, **Then** they can correct extraction (OCR) errors in the text and must
   confirm before grading begins; the correction credit is consumed only at
   confirmation, and both the original extraction and the confirmed text are kept.
3. **Given** a student confirms their transcription, **When** the evaluation is being
   produced, **Then** the student sees a clear processing status within the app and an
   in-app indication when the result is ready (no email or push notification in v1).
4. **Given** a student uploads an illegible, blurry, or non-essay image, **When** text
   extraction fails or yields insufficient text, **Then** the student is informed of
   the problem with guidance to retake the photo, and no correction credit is consumed.
5. **Given** an evaluation was delivered, **When** the student views the result,
   **Then** they can read the full confirmed text and see each annotation highlighted
   at the passage it refers to.
6. **Given** a visitor without an account, **When** they attempt to upload an essay,
   **Then** they are directed to create an account first (email and password, with
   email confirmation).

---

### User Story 2 - Track Historical Performance on a Progress Dashboard (Priority: P2)

A returning student opens their progress dashboard to see how their writing has evolved:
total score over time, average and trend per competency, number of essays submitted,
and quick access to every past evaluation.

**Why this priority**: Progress tracking is the main retention driver and the reason
students keep submitting essays, but it requires at least one completed evaluation to
exist (depends on the value delivered by User Story 1).

**Independent Test**: Can be tested by seeding an account with two or more completed
evaluations and verifying the dashboard shows score evolution, per-competency
breakdowns, and links to each past evaluation.

**Acceptance Scenarios**:

1. **Given** a student with two or more completed evaluations, **When** they open the
   dashboard, **Then** they see their total-score evolution over time and a
   per-competency view identifying their weakest and strongest competencies.
2. **Given** a student with exactly one evaluation, **When** they open the dashboard,
   **Then** they see that single result presented as their baseline with an invitation
   to submit more essays.
3. **Given** a student with no submissions, **When** they open the dashboard, **Then**
   they see an empty state explaining how to submit their first essay.
4. **Given** a student viewing the dashboard, **When** they select a past submission,
   **Then** they are taken to that submission's full evaluation (scores, annotations,
   feedback).

---

### User Story 3 - Free Allowance and Paywall (Priority: P3)

A new student receives a small allowance of free corrections. Once the allowance is
exhausted, attempting another submission presents a paywall that explains the
subscription plans and their benefits.

**Why this priority**: The freemium gate is what converts the product into a business,
but it only matters once grading (P1) works and users are engaged (P2).

**Independent Test**: Can be tested by consuming all free credits on a new account and
verifying the next submission attempt is blocked by the paywall, while previously
completed evaluations remain accessible.

**Acceptance Scenarios**:

1. **Given** a newly registered student, **When** their account is created, **Then**
   they are granted 3 free correction credits and can see their remaining balance at
   all times.
2. **Given** a student with 1 remaining free credit, **When** they complete a
   submission, **Then** their balance shows 0 and the interface communicates that the
   next correction requires a subscription.
3. **Given** a student with 0 credits and no active subscription, **When** they attempt
   to submit an essay, **Then** the submission is blocked and the paywall is shown with
   the available plans before any upload is processed.
4. **Given** a student with 0 credits, **When** they browse past evaluations and the
   dashboard, **Then** all previously delivered content remains fully accessible.

---

### User Story 4 - Subscribe, Upgrade, and Manage Plans (Priority: P4)

A student who hit the paywall chooses between subscription tiers — an entry-level plan
with a monthly correction quota and a premium plan whose sole difference is a higher
monthly quota — pays through the integrated payment provider, and immediately gains
the corresponding entitlements. Subscribers can upgrade from the entry tier to the
premium tier at any time (the upsell path), and can cancel, keeping access until the
end of the paid period.

**Why this priority**: Monetization completes the funnel but depends on the paywall
(P3) being in place.

**Independent Test**: Can be tested by selecting a plan from the paywall, completing a
payment in the payment provider's test mode, and verifying credits/entitlements are
granted immediately; then upgrading the plan and verifying the new entitlements apply.

**Acceptance Scenarios**:

1. **Given** a student at the paywall, **When** they select a plan and complete
   payment successfully, **Then** their subscription becomes active immediately and
   their monthly correction quota is available for use.
2. **Given** a payment attempt fails or is abandoned, **When** the student returns to
   the app, **Then** they remain on the free state with no entitlements granted and no
   charge applied, and can retry.
3. **Given** an active entry-tier subscriber, **When** they choose to upgrade to the
   premium tier, **Then** the upgrade takes effect immediately and the price difference
   is handled proportionally for the current period.
4. **Given** an active subscriber, **When** they cancel their subscription, **Then**
   they retain their entitlements until the end of the current paid period and revert
   to the free state afterwards.
5. **Given** a subscriber whose monthly quota is exhausted, **When** they attempt a new
   submission, **Then** they are offered the upgrade to the higher tier (upsell) or
   must wait for the next billing cycle.

---

### Edge Cases

- Photo is legible but the page is rotated, partially cropped, or contains two pages:
  the system must either handle it or instruct the student to re-photograph, without
  consuming a credit on failure.
- Extracted text is too short to be a valid essay attempt (e.g., under 7 lines of
  text): the evaluation rejects it with an explanation, mirroring official ENEM
  blank/insufficient rules, and the credit is consumed only if extraction succeeded and
  the student confirmed submission.
- Essay is written in a language other than Portuguese or is entirely off-format
  (e.g., a poem or a list): graded according to ENEM rules, which may result in a zero
  score, with the reason explained.
- Evaluation service is unavailable or fails mid-processing: the student is notified,
  the submission is marked failed, and the credit is automatically returned.
- The same photo is uploaded twice in a row: the system warns about the apparent
  duplicate before consuming a second credit.
- Upload exceeds the size limit or is in an unsupported format: the student is told the
  accepted formats and limits before any credit is involved.
- A subscription payment renewal fails: the student is notified and given a grace
  period to update payment details before reverting to the free state.
- A student requests account deletion: personal data and stored essay images are
  removed in accordance with Brazilian data protection law (LGPD).

## Requirements *(mandatory)*

### Functional Requirements

#### Accounts & Access

- **FR-001**: System MUST allow students to create an account with email and password,
  and MUST verify the email address before the first essay submission.
- **FR-002**: System MUST allow registered users to log in, log out, and reset their
  password.
- **FR-003**: System MUST restrict each evaluation, submission history, and dashboard
  to the account that owns it.

#### Essay Submission & Text Extraction

- **FR-004**: System MUST allow a logged-in student with available credits to upload a
  photo of a handwritten essay in common image formats (at minimum JPEG and PNG) up to
  a stated size limit.
- **FR-005**: System MUST require the student to provide the essay theme (selected from
  a list of known themes or typed free-form) at submission time, since theme adherence
  is part of the official evaluation.
- **FR-006**: System MUST extract the handwritten text from the uploaded image and
  store the transcription linked to the submission.
- **FR-007**: System MUST detect extraction failures and low-confidence results, inform
  the student with actionable guidance (e.g., retake the photo with better lighting),
  and MUST NOT consume a correction credit in that case.
- **FR-008**: System MUST present the extracted transcription for the student to
  review and correct extraction (OCR) errors before grading; grading starts and the
  correction credit is consumed only when the student confirms the transcription. The
  system MUST retain both the original extraction and the confirmed (possibly edited)
  text, and grading MUST use the confirmed text.
- **FR-008a**: System MUST show the student the confirmed text together with the
  evaluation result.

#### Evaluation

- **FR-009**: System MUST evaluate the transcribed essay strictly according to the 5
  official ENEM competencies: (C1) formal written Portuguese, (C2) theme comprehension
  and essay-genre structure, (C3) selection and organization of arguments, (C4)
  linguistic mechanisms for argumentation, and (C5) intervention proposal respecting
  human rights.
- **FR-010**: Each competency MUST be scored on the official scale (0, 40, 80, 120,
  160, or 200 points), and the total score MUST be the sum of the five competency
  scores (0–1000).
- **FR-011**: Each evaluation MUST include inline annotations anchored to specific
  passages of the transcribed text, each annotation identifying the issue, the
  competency it relates to, and a suggested correction.
- **FR-012**: Each evaluation MUST include a general feedback comment summarizing
  overall strengths and the highest-impact improvement areas.
- **FR-013**: System MUST apply official ENEM zero-score conditions where detectable
  (blank or insufficient text, full disregard of the essay genre, deliberate
  disconnection from the theme) and explain the reason to the student.
- **FR-014**: System MUST deliver the complete evaluation result to the student within
  the application (in-app status and ready indicator only in v1 — no email or push
  notifications) and persist it permanently in their history.
- **FR-015**: If an evaluation fails after a credit was consumed, the system MUST
  return the credit automatically and notify the student.

#### Progress Dashboard

- **FR-016**: System MUST provide a dashboard showing the student's total-score
  evolution over time across all completed evaluations.
- **FR-017**: Dashboard MUST show per-competency performance (latest score, average,
  and trend) so the student can identify their weakest competencies.
- **FR-018**: Dashboard MUST list all past submissions with date, theme, and total
  score, each linking to the full evaluation.

#### Freemium, Plans & Payments

- **FR-019**: System MUST grant each new account a one-time allowance of 3 free
  correction credits.
- **FR-020**: System MUST display the student's remaining credit balance and, for
  subscribers, the current plan and quota usage.
- **FR-021**: System MUST block new submissions when no credits or active quota remain
  and present the paywall with available plans before any upload is processed.
- **FR-022**: System MUST offer two subscription tiers structured for upsell: an entry
  tier with a monthly correction quota, and a premium tier differentiated solely by a
  higher monthly quota (no other benefit differences in v1). Unused monthly quota MUST
  expire at the end of each billing cycle (no rollover), and the quota resets in full
  at the start of the next cycle.
- **FR-023**: System MUST process subscription payments through an integrated payment
  provider supporting recurring billing and the payment methods commonly used in
  Brazil (at minimum credit card and Pix).
- **FR-024**: System MUST activate entitlements immediately upon payment confirmation,
  and MUST NOT grant entitlements for failed or abandoned payments.
- **FR-025**: System MUST allow subscribers to upgrade tiers at any time with
  proportional charge adjustment, and to cancel while retaining access until the end of
  the paid period.
- **FR-026**: System MUST offer the premium upgrade when an entry-tier subscriber
  exhausts their monthly quota.

#### Data & Compliance

- **FR-027**: System MUST store uploaded images, transcriptions, and evaluations
  securely, accessible only to the owning account.
- **FR-027a**: System MUST delete the uploaded essay image once it is no longer
  needed: upon transcription confirmation, upon extraction failure, or when the
  submission is abandoned. Only transcriptions, evaluations, annotations, and scores
  are retained long-term.
- **FR-028**: System MUST allow a student to delete their account and associated
  personal data, including any still-retained essay images, in compliance with LGPD.

### Key Entities

- **Student (User)**: A registered account holder; has credentials, credit balance,
  optional subscription, and a submission history.
- **Submission**: One uploaded essay photo with its theme, upload timestamp, processing
  status (pending, processing, completed, failed), and link to its transcription and
  evaluation.
- **Transcription**: The text extracted from the uploaded image, with an extraction
  confidence indication; holds both the original extracted text and the
  student-confirmed (possibly corrected) text used for grading.
- **Evaluation**: The graded result of a submission — five competency scores, total
  score, general feedback comment, and a set of annotations.
- **Annotation**: A correction note anchored to a specific passage of the transcribed
  text, referencing one competency and carrying a suggested improvement.
- **Correction Credit / Quota**: The consumable unit that authorizes one evaluation;
  granted free at signup (3, one-time, non-expiring) or monthly via subscription
  (expires at the end of each billing cycle, no rollover).
- **Subscription Plan**: A purchasable tier (entry or premium) defining price and
  monthly correction quota.
- **Subscription**: A student's active relationship with a plan — status, billing
  cycle, renewal date, and payment history.
- **Payment Transaction**: A record of each charge attempt and its outcome.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A new visitor can go from account creation to viewing their first
  complete evaluation in under 10 minutes.
- **SC-002**: 95% of legible submissions receive their complete evaluation within 3
  minutes of upload.
- **SC-003**: On a benchmark set of essays with known official-style human grades, at
  least 80% of system total scores fall within 100 points of the human grade, and no
  competency deviates by more than one scale step (40 points) in 70% of cases.
- **SC-004**: At least 90% of legible uploaded photos are successfully transcribed
  without requiring the student to re-photograph.
- **SC-005**: Every completed evaluation contains all required elements: total score,
  5 competency scores, at least 3 inline annotations (when text quality allows), and a
  general feedback comment.
- **SC-006**: The dashboard reflects a newly completed evaluation within 1 minute of
  its delivery.
- **SC-007**: A student hitting the paywall can complete a subscription purchase in
  under 3 minutes.
- **SC-008**: The platform supports at least 1,000 students submitting essays in the
  same hour without degradation of the experience above the limits in SC-002.
- **SC-009**: At least 5% of users who hit the paywall convert to a paid plan within 7
  days (initial business target for validating the freemium model).

## Assumptions

- **Free allowance**: 3 free corrections per new account (one-time, not renewing) is
  the default; the exact number is a business lever that can be tuned later.
- **Plan structure**: Two tiers at launch (entry and premium) with monthly billing;
  exact pricing and quota numbers are business decisions to be set before launch and
  are not fixed by this specification.
- **Essay theme**: The student must provide the theme at submission time, since
  Competency 2 (theme adherence) cannot be evaluated without it. The platform may offer
  a catalog of past/known ENEM themes for convenience.
- **Scoring model**: Scores follow the official ENEM scale — five competencies, each
  0–200 in 40-point increments, totaling 0–1000.
- **Language**: The product interface and essays are in Brazilian Portuguese; essays in
  other languages are graded per ENEM rules (typically resulting in zero).
- **Cost posture**: Text extraction and evaluation services are chosen for
  cost-effectiveness with acceptable quality (stated as a project constraint; specific
  vendor selection belongs to the planning phase).
- **Payments**: The payment provider must be low-cost and support recurring billing
  with Brazilian payment methods (credit card and Pix); vendor selection belongs to the
  planning phase.
- **Data retention**: Transcriptions and evaluations are retained while the account
  exists, to power the progress dashboard; essay images are short-lived (deleted at
  transcription confirmation, extraction failure, or abandonment). Remaining personal
  data is deleted on account deletion per LGPD.
- **Platform**: Web application, responsive for mobile browsers, since students will
  often photograph and upload directly from their phones; native mobile apps are out of
  scope for v1.
- **Human review**: No human-in-the-loop grading in v1; the evaluation is fully
  automated.
