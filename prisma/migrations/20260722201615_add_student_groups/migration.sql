-- CreateEnum
CREATE TYPE "GroupThemeStatus" AS ENUM ('active', 'closed');

-- CreateEnum
CREATE TYPE "GroupContentKind" AS ENUM ('text', 'file');

-- CreateEnum
CREATE TYPE "GroupFileKind" AS ENUM ('image', 'pdf');

-- CreateEnum
CREATE TYPE "GroupDisplayAs" AS ENUM ('real', 'anonymous');

-- CreateTable
CREATE TABLE "Group" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "leaderId" TEXT,
    "inviteCode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupMember" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupTheme" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "GroupThemeStatus" NOT NULL DEFAULT 'active',
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GroupTheme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupThemeContent" (
    "id" TEXT NOT NULL,
    "themeId" TEXT NOT NULL,
    "kind" "GroupContentKind" NOT NULL,
    "body" TEXT,
    "fileKey" TEXT,
    "fileType" "GroupFileKind",
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupThemeContent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupThemeEntry" (
    "id" TEXT NOT NULL,
    "themeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "displayAs" "GroupDisplayAs" NOT NULL DEFAULT 'anonymous',
    "finalRank" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupThemeEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Group_inviteCode_key" ON "Group"("inviteCode");

-- CreateIndex
CREATE INDEX "Group_leaderId_idx" ON "Group"("leaderId");

-- CreateIndex
CREATE INDEX "GroupMember_userId_idx" ON "GroupMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "GroupMember_groupId_userId_key" ON "GroupMember"("groupId", "userId");

-- CreateIndex
CREATE INDEX "GroupTheme_groupId_status_idx" ON "GroupTheme"("groupId", "status");

-- CreateIndex
CREATE INDEX "GroupThemeContent_themeId_idx" ON "GroupThemeContent"("themeId");

-- CreateIndex
CREATE UNIQUE INDEX "GroupThemeEntry_submissionId_key" ON "GroupThemeEntry"("submissionId");

-- CreateIndex
CREATE INDEX "GroupThemeEntry_themeId_idx" ON "GroupThemeEntry"("themeId");

-- CreateIndex
CREATE INDEX "GroupThemeEntry_userId_idx" ON "GroupThemeEntry"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "GroupThemeEntry_themeId_userId_key" ON "GroupThemeEntry"("themeId", "userId");

-- AddForeignKey
ALTER TABLE "Group" ADD CONSTRAINT "Group_leaderId_fkey" FOREIGN KEY ("leaderId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupMember" ADD CONSTRAINT "GroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupMember" ADD CONSTRAINT "GroupMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupTheme" ADD CONSTRAINT "GroupTheme_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupThemeContent" ADD CONSTRAINT "GroupThemeContent_themeId_fkey" FOREIGN KEY ("themeId") REFERENCES "GroupTheme"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupThemeEntry" ADD CONSTRAINT "GroupThemeEntry_themeId_fkey" FOREIGN KEY ("themeId") REFERENCES "GroupTheme"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupThemeEntry" ADD CONSTRAINT "GroupThemeEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupThemeEntry" ADD CONSTRAINT "GroupThemeEntry_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
