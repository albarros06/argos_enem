-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('user', 'admin');

-- CreateEnum
CREATE TYPE "WeeklyThemeStatus" AS ENUM ('active', 'closed');

-- CreateEnum
CREATE TYPE "WeeklyContentKind" AS ENUM ('text', 'file');

-- CreateEnum
CREATE TYPE "WeeklyFileKind" AS ENUM ('image', 'pdf');

-- CreateEnum
CREATE TYPE "WeeklyDisplayAs" AS ENUM ('real', 'anonymous');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "role" "UserRole" NOT NULL DEFAULT 'user';

-- CreateTable
CREATE TABLE "WeeklyTheme" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "WeeklyThemeStatus" NOT NULL DEFAULT 'active',
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),
    "publishedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeeklyTheme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeeklyThemeContent" (
    "id" TEXT NOT NULL,
    "themeId" TEXT NOT NULL,
    "kind" "WeeklyContentKind" NOT NULL,
    "body" TEXT,
    "fileKey" TEXT,
    "fileType" "WeeklyFileKind",
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeeklyThemeContent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeeklyThemeEntry" (
    "id" TEXT NOT NULL,
    "themeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "displayAs" "WeeklyDisplayAs" NOT NULL DEFAULT 'anonymous',
    "finalRank" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeeklyThemeEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WeeklyTheme_status_idx" ON "WeeklyTheme"("status");

-- CreateIndex
CREATE INDEX "WeeklyThemeContent_themeId_idx" ON "WeeklyThemeContent"("themeId");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyThemeEntry_submissionId_key" ON "WeeklyThemeEntry"("submissionId");

-- CreateIndex
CREATE INDEX "WeeklyThemeEntry_themeId_idx" ON "WeeklyThemeEntry"("themeId");

-- CreateIndex
CREATE INDEX "WeeklyThemeEntry_userId_idx" ON "WeeklyThemeEntry"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyThemeEntry_themeId_userId_key" ON "WeeklyThemeEntry"("themeId", "userId");

-- AddForeignKey
ALTER TABLE "WeeklyTheme" ADD CONSTRAINT "WeeklyTheme_publishedById_fkey" FOREIGN KEY ("publishedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyThemeContent" ADD CONSTRAINT "WeeklyThemeContent_themeId_fkey" FOREIGN KEY ("themeId") REFERENCES "WeeklyTheme"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyThemeEntry" ADD CONSTRAINT "WeeklyThemeEntry_themeId_fkey" FOREIGN KEY ("themeId") REFERENCES "WeeklyTheme"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyThemeEntry" ADD CONSTRAINT "WeeklyThemeEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyThemeEntry" ADD CONSTRAINT "WeeklyThemeEntry_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
