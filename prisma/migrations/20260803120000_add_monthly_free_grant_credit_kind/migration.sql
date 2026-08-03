-- Crédito gratuito mensal (1/mês por usuário free) substitui a concessão
-- única de cadastro; kind próprio para não confundir com signup_grant antigo.
ALTER TYPE "CreditKind" ADD VALUE 'monthly_free_grant';
