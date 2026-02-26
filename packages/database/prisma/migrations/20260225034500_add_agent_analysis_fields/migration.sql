-- AlterTable: Add agentAnalysis and analyzedAt to Response
ALTER TABLE "Response" ADD COLUMN IF NOT EXISTS "agentAnalysis" JSONB;
ALTER TABLE "Response" ADD COLUMN IF NOT EXISTS "analyzedAt" TIMESTAMP(3);

-- AlterTable: Add new fields to AgentLog
ALTER TABLE "AgentLog" ADD COLUMN IF NOT EXISTS "responseId" TEXT;
ALTER TABLE "AgentLog" ADD COLUMN IF NOT EXISTS "findings" JSONB;
ALTER TABLE "AgentLog" ADD COLUMN IF NOT EXISTS "confidence" DOUBLE PRECISION;
ALTER TABLE "AgentLog" ADD COLUMN IF NOT EXISTS "processingTime" INTEGER;
ALTER TABLE "AgentLog" ADD COLUMN IF NOT EXISTS "tokensUsed" INTEGER;

-- CreateIndex: Add index for AgentLog.responseId
CREATE INDEX IF NOT EXISTS "AgentLog_responseId_idx" ON "AgentLog"("responseId");
