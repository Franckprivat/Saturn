-- Pseudo toujours renseigné : c'est le nom affiché depuis que l'e-mail
-- n'est plus exposé aux autres utilisateurs.
UPDATE "user"
SET "nickname" = COALESCE(NULLIF(TRIM("name"), ''), SPLIT_PART("email", '@', 1))
WHERE "nickname" IS NULL OR TRIM("nickname") = '';

-- Doublons de participants (course possible dans joinByInvite) avant l'unicité
DELETE FROM "ConversationParticipant" a
USING "ConversationParticipant" b
WHERE a."conversationId" = b."conversationId"
  AND a."userId" = b."userId"
  AND a."id" > b."id";

-- CreateIndex
CREATE UNIQUE INDEX "ConversationParticipant_conversationId_userId_key" ON "ConversationParticipant"("conversationId", "userId");

-- CreateIndex
CREATE INDEX "ConversationParticipant_userId_idx" ON "ConversationParticipant"("userId");

-- CreateIndex
CREATE INDEX "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt");
