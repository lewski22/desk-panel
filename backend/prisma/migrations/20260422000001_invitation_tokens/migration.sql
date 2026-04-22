-- CreateTable
CREATE TABLE "InvitationToken" (
    "id"             TEXT NOT NULL,
    "token"          TEXT NOT NULL,
    "email"          TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "role"           "UserRole" NOT NULL DEFAULT 'END_USER',
    "invitedById"    TEXT NOT NULL,
    "expiresAt"      TIMESTAMP(3) NOT NULL,
    "usedAt"         TIMESTAMP(3),
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvitationToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InvitationToken_token_key" ON "InvitationToken"("token");

-- CreateIndex
CREATE INDEX "InvitationToken_email_idx" ON "InvitationToken"("email");

-- CreateIndex
CREATE INDEX "InvitationToken_organizationId_idx" ON "InvitationToken"("organizationId");

-- AddForeignKey
ALTER TABLE "InvitationToken" ADD CONSTRAINT "InvitationToken_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
