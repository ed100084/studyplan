ALTER TABLE "StudentProfile" ADD COLUMN "linkCode" TEXT;

UPDATE "StudentProfile"
SET "linkCode" = 'SP' || upper(substr(md5("id"), 1, 8))
WHERE "linkCode" IS NULL;

CREATE UNIQUE INDEX "StudentProfile_linkCode_key" ON "StudentProfile"("linkCode");
