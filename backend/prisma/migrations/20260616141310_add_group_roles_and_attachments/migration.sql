-- CreateEnum
CREATE TYPE "GroupRole" AS ENUM ('ADMIN', 'MEMBER');

-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "creatorId" TEXT,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "image" TEXT;

-- AlterTable
ALTER TABLE "ConversationParticipant" ADD COLUMN     "role" "GroupRole" NOT NULL DEFAULT 'MEMBER';

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "fileName" TEXT,
ADD COLUMN     "fileType" TEXT,
ADD COLUMN     "fileUrl" TEXT,
ALTER COLUMN "content" SET DEFAULT '';
