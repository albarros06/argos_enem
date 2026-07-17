-- Adiciona o motivo de falha para PDF com mais de uma página (FR-011).
ALTER TYPE "FailureReason" ADD VALUE 'multi_page_pdf' BEFORE 'grading_failed';
