-- Estado assíncrono do OCR: pending -> transcribing -> awaiting_review|failed.
ALTER TYPE "SubmissionStatus" ADD VALUE 'transcribing' AFTER 'pending';
