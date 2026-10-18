-- Supabase Auth owns password credentials. OmniPoint's User table is a staff profile.
ALTER TABLE "User" ALTER COLUMN "passwordHash" DROP NOT NULL;
COMMENT ON COLUMN "User"."passwordHash" IS 'Deprecated compatibility field; authentication credentials belong to Supabase Auth and must not be stored here.';
