-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "name" TEXT;

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "avatarColor" TEXT,
ADD COLUMN     "bio" TEXT,
ADD COLUMN     "socialLinks" JSONB;
