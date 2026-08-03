-- Bugfix (spec 018 follow-up): a migração anterior passou a exigir cycleId
-- exato ("free:YYYY-MM") para contar saldo grátis, mas concessões manuais
-- (manual_grant) foram e continuam sendo não-expirantes por design — não
-- devem ficar presas a um mês específico. Estampa as linhas antigas
-- (cycleId NULL, de antes desta migração) com o cycleId fixo 'manual', que o
-- código agora usa para esse propósito, restaurando o saldo manual que
-- tinha ficado invisível no cálculo.
UPDATE "CreditTransaction"
SET "cycleId" = 'manual'
WHERE "kind" = 'manual_grant' AND "cycleId" IS NULL;
