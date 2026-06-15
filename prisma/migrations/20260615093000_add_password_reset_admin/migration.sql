ALTER TABLE "User" ADD COLUMN "authVersion" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "PasswordResetAudit" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetAudit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PasswordResetAudit_actorId_createdAt_idx" ON "PasswordResetAudit"("actorId", "createdAt");
CREATE INDEX "PasswordResetAudit_targetUserId_createdAt_idx" ON "PasswordResetAudit"("targetUserId", "createdAt");

ALTER TABLE "PasswordResetAudit" ADD CONSTRAINT "PasswordResetAudit_actorId_fkey"
FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PasswordResetAudit" ADD CONSTRAINT "PasswordResetAudit_targetUserId_fkey"
FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
