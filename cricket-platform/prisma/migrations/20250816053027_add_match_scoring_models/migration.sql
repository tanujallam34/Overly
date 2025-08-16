-- CreateTable
CREATE TABLE "public"."Match" (
    "id" TEXT NOT NULL,
    "leagueId" TEXT,
    "homeTeamId" TEXT NOT NULL,
    "awayTeamId" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "format" TEXT NOT NULL,
    "oversLimit" INTEGER,
    "ballsPerOver" INTEGER NOT NULL DEFAULT 6,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "resultType" TEXT,
    "winnerTeamId" TEXT,
    "winMargin" INTEGER,
    "winType" TEXT,
    "targetRuns" INTEGER,
    "dlsUsed" BOOLEAN NOT NULL DEFAULT false,
    "rulesetId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Toss" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "winnerTeamId" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Toss_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Assignment" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Assignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Innings" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "battingTeamId" TEXT NOT NULL,
    "bowlingTeamId" TEXT NOT NULL,
    "targetRuns" INTEGER,
    "totalRuns" INTEGER NOT NULL DEFAULT 0,
    "totalWickets" INTEGER NOT NULL DEFAULT 0,
    "totalOvers" DECIMAL(4,1) NOT NULL DEFAULT 0,
    "extras" INTEGER NOT NULL DEFAULT 0,
    "isDeclared" BOOLEAN NOT NULL DEFAULT false,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Innings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Over" (
    "id" TEXT NOT NULL,
    "inningsId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "bowlerId" TEXT NOT NULL,
    "legalBalls" INTEGER NOT NULL DEFAULT 0,
    "runs" INTEGER NOT NULL DEFAULT 0,
    "wickets" INTEGER NOT NULL DEFAULT 0,
    "extras" INTEGER NOT NULL DEFAULT 0,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Over_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."BallEvent" (
    "id" TEXT NOT NULL,
    "inningsId" TEXT NOT NULL,
    "overNumber" INTEGER NOT NULL,
    "ballNumber" INTEGER NOT NULL,
    "sequenceIndex" INTEGER NOT NULL,
    "strikerId" TEXT NOT NULL,
    "nonStrikerId" TEXT NOT NULL,
    "bowlerId" TEXT NOT NULL,
    "runsOffBat" INTEGER NOT NULL DEFAULT 0,
    "extras" JSONB NOT NULL DEFAULT '{}',
    "boundary" TEXT,
    "freeHit" BOOLEAN NOT NULL DEFAULT false,
    "commentary" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BallEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."WicketEvent" (
    "id" TEXT NOT NULL,
    "ballEventId" TEXT NOT NULL,
    "inningsId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "dismissedPlayerId" TEXT NOT NULL,
    "bowlerId" TEXT,
    "fielderId" TEXT,
    "runOutEnd" TEXT,
    "battersCrossed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WicketEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Powerplay" (
    "id" TEXT NOT NULL,
    "inningsId" TEXT NOT NULL,
    "startOver" INTEGER NOT NULL,
    "endOver" INTEGER,
    "type" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Powerplay_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Match_leagueId_idx" ON "public"."Match"("leagueId");

-- CreateIndex
CREATE INDEX "Match_homeTeamId_idx" ON "public"."Match"("homeTeamId");

-- CreateIndex
CREATE INDEX "Match_awayTeamId_idx" ON "public"."Match"("awayTeamId");

-- CreateIndex
CREATE INDEX "Match_venueId_idx" ON "public"."Match"("venueId");

-- CreateIndex
CREATE INDEX "Match_startTime_idx" ON "public"."Match"("startTime");

-- CreateIndex
CREATE INDEX "Match_status_idx" ON "public"."Match"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Toss_matchId_key" ON "public"."Toss"("matchId");

-- CreateIndex
CREATE INDEX "Toss_matchId_idx" ON "public"."Toss"("matchId");

-- CreateIndex
CREATE INDEX "Assignment_matchId_idx" ON "public"."Assignment"("matchId");

-- CreateIndex
CREATE INDEX "Assignment_userId_idx" ON "public"."Assignment"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Assignment_matchId_role_userId_key" ON "public"."Assignment"("matchId", "role", "userId");

-- CreateIndex
CREATE INDEX "Innings_matchId_idx" ON "public"."Innings"("matchId");

-- CreateIndex
CREATE INDEX "Innings_battingTeamId_idx" ON "public"."Innings"("battingTeamId");

-- CreateIndex
CREATE INDEX "Innings_bowlingTeamId_idx" ON "public"."Innings"("bowlingTeamId");

-- CreateIndex
CREATE UNIQUE INDEX "Innings_matchId_number_key" ON "public"."Innings"("matchId", "number");

-- CreateIndex
CREATE INDEX "Over_inningsId_idx" ON "public"."Over"("inningsId");

-- CreateIndex
CREATE INDEX "Over_bowlerId_idx" ON "public"."Over"("bowlerId");

-- CreateIndex
CREATE UNIQUE INDEX "Over_inningsId_number_key" ON "public"."Over"("inningsId", "number");

-- CreateIndex
CREATE INDEX "BallEvent_inningsId_idx" ON "public"."BallEvent"("inningsId");

-- CreateIndex
CREATE INDEX "BallEvent_strikerId_idx" ON "public"."BallEvent"("strikerId");

-- CreateIndex
CREATE INDEX "BallEvent_bowlerId_idx" ON "public"."BallEvent"("bowlerId");

-- CreateIndex
CREATE INDEX "BallEvent_timestamp_idx" ON "public"."BallEvent"("timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "BallEvent_inningsId_overNumber_sequenceIndex_key" ON "public"."BallEvent"("inningsId", "overNumber", "sequenceIndex");

-- CreateIndex
CREATE UNIQUE INDEX "WicketEvent_ballEventId_key" ON "public"."WicketEvent"("ballEventId");

-- CreateIndex
CREATE INDEX "WicketEvent_inningsId_idx" ON "public"."WicketEvent"("inningsId");

-- CreateIndex
CREATE INDEX "WicketEvent_dismissedPlayerId_idx" ON "public"."WicketEvent"("dismissedPlayerId");

-- CreateIndex
CREATE INDEX "WicketEvent_bowlerId_idx" ON "public"."WicketEvent"("bowlerId");

-- CreateIndex
CREATE INDEX "Powerplay_inningsId_idx" ON "public"."Powerplay"("inningsId");

-- AddForeignKey
ALTER TABLE "public"."Match" ADD CONSTRAINT "Match_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "public"."League"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Match" ADD CONSTRAINT "Match_homeTeamId_fkey" FOREIGN KEY ("homeTeamId") REFERENCES "public"."Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Match" ADD CONSTRAINT "Match_awayTeamId_fkey" FOREIGN KEY ("awayTeamId") REFERENCES "public"."Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Match" ADD CONSTRAINT "Match_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "public"."Venue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Match" ADD CONSTRAINT "Match_winnerTeamId_fkey" FOREIGN KEY ("winnerTeamId") REFERENCES "public"."Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Toss" ADD CONSTRAINT "Toss_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "public"."Match"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Toss" ADD CONSTRAINT "Toss_winnerTeamId_fkey" FOREIGN KEY ("winnerTeamId") REFERENCES "public"."Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Assignment" ADD CONSTRAINT "Assignment_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "public"."Match"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Assignment" ADD CONSTRAINT "Assignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Innings" ADD CONSTRAINT "Innings_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "public"."Match"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Innings" ADD CONSTRAINT "Innings_battingTeamId_fkey" FOREIGN KEY ("battingTeamId") REFERENCES "public"."Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Innings" ADD CONSTRAINT "Innings_bowlingTeamId_fkey" FOREIGN KEY ("bowlingTeamId") REFERENCES "public"."Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Over" ADD CONSTRAINT "Over_inningsId_fkey" FOREIGN KEY ("inningsId") REFERENCES "public"."Innings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Over" ADD CONSTRAINT "Over_bowlerId_fkey" FOREIGN KEY ("bowlerId") REFERENCES "public"."Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BallEvent" ADD CONSTRAINT "BallEvent_inningsId_fkey" FOREIGN KEY ("inningsId") REFERENCES "public"."Innings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BallEvent" ADD CONSTRAINT "BallEvent_inningsId_overNumber_fkey" FOREIGN KEY ("inningsId", "overNumber") REFERENCES "public"."Over"("inningsId", "number") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BallEvent" ADD CONSTRAINT "BallEvent_strikerId_fkey" FOREIGN KEY ("strikerId") REFERENCES "public"."Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BallEvent" ADD CONSTRAINT "BallEvent_nonStrikerId_fkey" FOREIGN KEY ("nonStrikerId") REFERENCES "public"."Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BallEvent" ADD CONSTRAINT "BallEvent_bowlerId_fkey" FOREIGN KEY ("bowlerId") REFERENCES "public"."Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WicketEvent" ADD CONSTRAINT "WicketEvent_ballEventId_fkey" FOREIGN KEY ("ballEventId") REFERENCES "public"."BallEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WicketEvent" ADD CONSTRAINT "WicketEvent_inningsId_fkey" FOREIGN KEY ("inningsId") REFERENCES "public"."Innings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WicketEvent" ADD CONSTRAINT "WicketEvent_dismissedPlayerId_fkey" FOREIGN KEY ("dismissedPlayerId") REFERENCES "public"."Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WicketEvent" ADD CONSTRAINT "WicketEvent_bowlerId_fkey" FOREIGN KEY ("bowlerId") REFERENCES "public"."Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WicketEvent" ADD CONSTRAINT "WicketEvent_fielderId_fkey" FOREIGN KEY ("fielderId") REFERENCES "public"."Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Powerplay" ADD CONSTRAINT "Powerplay_inningsId_fkey" FOREIGN KEY ("inningsId") REFERENCES "public"."Innings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
