-- Add the founder-level role without changing existing staff roles or granting it to any account.
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'SOVEREIGN';
