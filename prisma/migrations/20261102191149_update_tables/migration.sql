/*
  Warnings:

  - A unique constraint covering the columns `[playerKey]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "MemberStatus" AS ENUM ('INVITED', 'ACCEPTED', 'REJECTED');

-- AlterTable
ALTER TABLE "TeamMember" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "status" "MemberStatus" NOT NULL DEFAULT 'INVITED';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "playerKey" TEXT;

-- CreateIndex
CREATE INDEX "TeamMember_status_idx" ON "TeamMember"("status");

-- CreateIndex
CREATE UNIQUE INDEX "User_playerKey_key" ON "User"("playerKey");

-- CreateIndex
CREATE INDEX "User_playerKey_idx" ON "User"("playerKey");
