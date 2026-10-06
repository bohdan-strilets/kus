-- Emails are stored lowercased (the backend normalizes them); enforce it so a missed normalization
-- can't create a second account that differs only in case. Prisma can't express CHECK constraints.
ALTER TABLE "users" ADD CONSTRAINT "users_email_lowercase_check" CHECK ("email" = lower("email"));
