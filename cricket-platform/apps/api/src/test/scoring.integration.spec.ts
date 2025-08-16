import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../app/app.module';
import { TestApp, createTestApp } from './test-setup';
import { TestDataHelper } from './test-helpers';

describe('Scoring Integration Tests', () => {
  let testApp: TestApp;
  let testHelper: TestDataHelper;
  let accessToken: string;
  let testSetup: any;
  let match: any;

  beforeAll(async () => {
    testApp = await createTestApp().setup(
      Test.createTestingModule({
        imports: [AppModule],
      })
    );
    testHelper = new TestDataHelper(testApp.prisma);
  });

  afterAll(async () => {
    await testApp.close();
  });

  beforeEach(async () => {
    await testApp.cleanup();
    
    // Create complete test setup
    testSetup = await testHelper.createFullTestSetup();

    // Login to get access token
    const loginResponse = await request(testApp.getHttpServer())
      .post('/auth/login')
      .send({
        email: testSetup.user.email,
        password: 'password123',
      });

    accessToken = loginResponse.body.accessToken;

    // Conduct toss and start match
    await request(testApp.getHttpServer())
      .post(`/matches/${testSetup.match.id}/toss`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        winnerTeamId: testSetup.homeTeam.id,
        decision: 'bat',
      });

    await request(testApp.getHttpServer())
      .post(`/matches/${testSetup.match.id}/start`)
      .set('Authorization', `Bearer ${accessToken}`);

    match = testSetup.match;
  });

  describe('POST /matches/:id/innings/start', () => {
    it('should start first innings successfully', async () => {
      const inningsData = {
        battingTeamId: testSetup.homeTeam.id,
        bowlingTeamId: testSetup.awayTeam.id,
      };

      const response = await request(testApp.getHttpServer())
        .post(`/matches/${match.id}/innings/start`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(inningsData)
        .expect(201);

      expect(response.body).toMatchObject({
        number: 1,
        battingTeamId: testSetup.homeTeam.id,
        bowlingTeamId: testSetup.awayTeam.id,
        totalRuns: 0,
        totalWickets: 0,
        totalOvers: 0,
        extras: 0,
        isDeclared: false,
        isCompleted: false,
      });
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('matchId');
    });

    it('should start second innings with target runs', async () => {
      // Start first innings
      const firstInnings = await request(testApp.getHttpServer())
        .post(`/matches/${match.id}/innings/start`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          battingTeamId: testSetup.homeTeam.id,
          bowlingTeamId: testSetup.awayTeam.id,
        });

      // Complete first innings (would normally have scoring here)
      await request(testApp.getHttpServer())
        .post(`/matches/innings/${firstInnings.body.id}/overs/end`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ isDeclared: false });

      // Start second innings
      const secondInnings = await request(testApp.getHttpServer())
        .post(`/matches/${match.id}/innings/start`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          battingTeamId: testSetup.awayTeam.id,
          bowlingTeamId: testSetup.homeTeam.id,
          targetRuns: 151,
        });

      expect(secondInnings.body).toMatchObject({
        number: 2,
        battingTeamId: testSetup.awayTeam.id,
        bowlingTeamId: testSetup.homeTeam.id,
        targetRuns: 151,
      });
    });

    it('should validate innings data', async () => {
      // Missing battingTeamId
      await request(testApp.getHttpServer())
        .post(`/matches/${match.id}/innings/start`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          bowlingTeamId: testSetup.awayTeam.id,
        })
        .expect(400);

      // Same team for batting and bowling
      await request(testApp.getHttpServer())
        .post(`/matches/${match.id}/innings/start`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          battingTeamId: testSetup.homeTeam.id,
          bowlingTeamId: testSetup.homeTeam.id,
        })
        .expect(400);
    });
  });

  describe('POST /matches/innings/:inningsId/overs/start', () => {
    let innings: any;

    beforeEach(async () => {
      const inningsResponse = await request(testApp.getHttpServer())
        .post(`/matches/${match.id}/innings/start`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          battingTeamId: testSetup.homeTeam.id,
          bowlingTeamId: testSetup.awayTeam.id,
        });
      innings = inningsResponse.body;
    });

    it('should start first over successfully', async () => {
      const overData = {
        bowlerId: testSetup.awayPlayers[0].id,
      };

      const response = await request(testApp.getHttpServer())
        .post(`/matches/innings/${innings.id}/overs/start`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(overData)
        .expect(201);

      expect(response.body).toMatchObject({
        number: 1,
        bowlerId: testSetup.awayPlayers[0].id,
        legalBalls: 0,
        runs: 0,
        wickets: 0,
        extras: 0,
        isCompleted: false,
      });
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('inningsId');
    });

    it('should validate over data', async () => {
      // Missing bowlerId
      await request(testApp.getHttpServer())
        .post(`/matches/innings/${innings.id}/overs/start`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({})
        .expect(400);

      // Invalid bowler (not from bowling team)
      await request(testApp.getHttpServer())
        .post(`/matches/innings/${innings.id}/overs/start`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          bowlerId: testSetup.homePlayers[0].id, // From batting team
        })
        .expect(400);
    });

    it('should not allow same bowler for consecutive overs', async () => {
      const bowlerId = testSetup.awayPlayers[0].id;

      // Start first over
      await request(testApp.getHttpServer())
        .post(`/matches/innings/${innings.id}/overs/start`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ bowlerId });

      // Complete first over by adding 6 balls
      for (let i = 1; i <= 6; i++) {
        await request(testApp.getHttpServer())
          .post(`/matches/innings/${innings.id}/balls`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            ball: {
              strikerId: testSetup.homePlayers[0].id,
              nonStrikerId: testSetup.homePlayers[1].id,
              bowlerId: bowlerId,
              runsOffBat: 1,
              extras: {},
            },
          });
      }

      // Try to start next over with same bowler - should fail
      await request(testApp.getHttpServer())
        .post(`/matches/innings/${innings.id}/overs/start`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ bowlerId })
        .expect(400);
    });
  });

  describe('POST /matches/innings/:inningsId/balls', () => {
    let innings: any;
    let over: any;

    beforeEach(async () => {
      const inningsResponse = await request(testApp.getHttpServer())
        .post(`/matches/${match.id}/innings/start`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          battingTeamId: testSetup.homeTeam.id,
          bowlingTeamId: testSetup.awayTeam.id,
        });
      innings = inningsResponse.body;

      const overResponse = await request(testApp.getHttpServer())
        .post(`/matches/innings/${innings.id}/overs/start`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          bowlerId: testSetup.awayPlayers[0].id,
        });
      over = overResponse.body;
    });

    it('should record a normal delivery', async () => {
      const ballData = {
        ball: {
          strikerId: testSetup.homePlayers[0].id,
          nonStrikerId: testSetup.homePlayers[1].id,
          bowlerId: testSetup.awayPlayers[0].id,
          runsOffBat: 2,
          extras: {},
        },
      };

      const response = await request(testApp.getHttpServer())
        .post(`/matches/innings/${innings.id}/balls`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(ballData)
        .expect(201);

      expect(response.body.ball).toMatchObject({
        overNumber: 1,
        ballNumber: 1,
        sequenceIndex: 1,
        strikerId: testSetup.homePlayers[0].id,
        nonStrikerId: testSetup.homePlayers[1].id,
        bowlerId: testSetup.awayPlayers[0].id,
        runsOffBat: 2,
        boundary: null,
        freeHit: false,
      });
    });

    it('should record a boundary', async () => {
      const ballData = {
        ball: {
          strikerId: testSetup.homePlayers[0].id,
          nonStrikerId: testSetup.homePlayers[1].id,
          bowlerId: testSetup.awayPlayers[0].id,
          runsOffBat: 4,
          extras: {},
          boundary: 'four',
        },
      };

      const response = await request(testApp.getHttpServer())
        .post(`/matches/innings/${innings.id}/balls`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(ballData)
        .expect(201);

      expect(response.body.ball).toMatchObject({
        runsOffBat: 4,
        boundary: 'four',
      });
    });

    it('should record a six', async () => {
      const ballData = {
        ball: {
          strikerId: testSetup.homePlayers[0].id,
          nonStrikerId: testSetup.homePlayers[1].id,
          bowlerId: testSetup.awayPlayers[0].id,
          runsOffBat: 6,
          extras: {},
          boundary: 'six',
        },
      };

      const response = await request(testApp.getHttpServer())
        .post(`/matches/innings/${innings.id}/balls`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(ballData)
        .expect(201);

      expect(response.body.ball).toMatchObject({
        runsOffBat: 6,
        boundary: 'six',
      });
    });

    it('should record extras (wide)', async () => {
      const ballData = {
        ball: {
          strikerId: testSetup.homePlayers[0].id,
          nonStrikerId: testSetup.homePlayers[1].id,
          bowlerId: testSetup.awayPlayers[0].id,
          runsOffBat: 0,
          extras: { wide: 1 },
        },
      };

      const response = await request(testApp.getHttpServer())
        .post(`/matches/innings/${innings.id}/balls`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(ballData)
        .expect(201);

      expect(response.body.ball).toMatchObject({
        runsOffBat: 0,
        extras: { wide: 1 },
        ballNumber: 1, // Should remain same ball number for wide
      });
    });

    it('should record extras (no ball)', async () => {
      const ballData = {
        ball: {
          strikerId: testSetup.homePlayers[0].id,
          nonStrikerId: testSetup.homePlayers[1].id,
          bowlerId: testSetup.awayPlayers[0].id,
          runsOffBat: 0,
          extras: { noBall: 1 },
          freeHit: true,
        },
      };

      const response = await request(testApp.getHttpServer())
        .post(`/matches/innings/${innings.id}/balls`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(ballData)
        .expect(201);

      expect(response.body.ball).toMatchObject({
        extras: { noBall: 1 },
        freeHit: true,
      });
    });

    it('should record wicket delivery', async () => {
      const ballData = {
        ball: {
          strikerId: testSetup.homePlayers[0].id,
          nonStrikerId: testSetup.homePlayers[1].id,
          bowlerId: testSetup.awayPlayers[0].id,
          runsOffBat: 0,
          extras: {},
        },
        wicket: {
          type: 'bowled',
          dismissedPlayerId: testSetup.homePlayers[0].id,
          bowlerId: testSetup.awayPlayers[0].id,
        },
      };

      const response = await request(testApp.getHttpServer())
        .post(`/matches/innings/${innings.id}/balls`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(ballData)
        .expect(201);

      expect(response.body.wicket).toMatchObject({
        type: 'bowled',
        dismissedPlayerId: testSetup.homePlayers[0].id,
        bowlerId: testSetup.awayPlayers[0].id,
      });
    });

    it('should record caught wicket', async () => {
      const ballData = {
        ball: {
          strikerId: testSetup.homePlayers[0].id,
          nonStrikerId: testSetup.homePlayers[1].id,
          bowlerId: testSetup.awayPlayers[0].id,
          runsOffBat: 0,
          extras: {},
        },
        wicket: {
          type: 'caught',
          dismissedPlayerId: testSetup.homePlayers[0].id,
          bowlerId: testSetup.awayPlayers[0].id,
          fielderId: testSetup.awayPlayers[1].id,
        },
      };

      const response = await request(testApp.getHttpServer())
        .post(`/matches/innings/${innings.id}/balls`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(ballData)
        .expect(201);

      expect(response.body.wicket).toMatchObject({
        type: 'caught',
        dismissedPlayerId: testSetup.homePlayers[0].id,
        bowlerId: testSetup.awayPlayers[0].id,
        fielderId: testSetup.awayPlayers[1].id,
      });
    });

    it('should record run out', async () => {
      const ballData = {
        ball: {
          strikerId: testSetup.homePlayers[0].id,
          nonStrikerId: testSetup.homePlayers[1].id,
          bowlerId: testSetup.awayPlayers[0].id,
          runsOffBat: 1,
          extras: {},
        },
        wicket: {
          type: 'runOut',
          dismissedPlayerId: testSetup.homePlayers[1].id,
          fielderId: testSetup.awayPlayers[2].id,
          runOutEnd: 'nonStriker',
          battersCrossed: false,
        },
      };

      const response = await request(testApp.getHttpServer())
        .post(`/matches/innings/${innings.id}/balls`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(ballData)
        .expect(201);

      expect(response.body.wicket).toMatchObject({
        type: 'runOut',
        dismissedPlayerId: testSetup.homePlayers[1].id,
        fielderId: testSetup.awayPlayers[2].id,
        runOutEnd: 'nonStriker',
        battersCrossed: false,
      });
    });

    it('should validate ball data', async () => {
      // Missing strikerId
      await request(testApp.getHttpServer())
        .post(`/matches/innings/${innings.id}/balls`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          ball: {
            nonStrikerId: testSetup.homePlayers[1].id,
            bowlerId: testSetup.awayPlayers[0].id,
            runsOffBat: 1,
            extras: {},
          },
        })
        .expect(400);

      // Striker and non-striker same
      await request(testApp.getHttpServer())
        .post(`/matches/innings/${innings.id}/balls`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          ball: {
            strikerId: testSetup.homePlayers[0].id,
            nonStrikerId: testSetup.homePlayers[0].id,
            bowlerId: testSetup.awayPlayers[0].id,
            runsOffBat: 1,
            extras: {},
          },
        })
        .expect(400);
    });
  });

  describe('DELETE /matches/innings/:inningsId/balls/last', () => {
    let innings: any;
    let over: any;

    beforeEach(async () => {
      const inningsResponse = await request(testApp.getHttpServer())
        .post(`/matches/${match.id}/innings/start`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          battingTeamId: testSetup.homeTeam.id,
          bowlingTeamId: testSetup.awayTeam.id,
        });
      innings = inningsResponse.body;

      const overResponse = await request(testApp.getHttpServer())
        .post(`/matches/innings/${innings.id}/overs/start`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          bowlerId: testSetup.awayPlayers[0].id,
        });
      over = overResponse.body;

      // Add a ball to undo
      await request(testApp.getHttpServer())
        .post(`/matches/innings/${innings.id}/balls`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          ball: {
            strikerId: testSetup.homePlayers[0].id,
            nonStrikerId: testSetup.homePlayers[1].id,
            bowlerId: testSetup.awayPlayers[0].id,
            runsOffBat: 4,
            extras: {},
            boundary: 'four',
          },
        });
    });

    it('should undo last ball successfully', async () => {
      const response = await request(testApp.getHttpServer())
        .delete(`/matches/innings/${innings.id}/balls/last`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('undone');
    });

    it('should not allow undo when no balls exist', async () => {
      // Undo the existing ball first
      await request(testApp.getHttpServer())
        .delete(`/matches/innings/${innings.id}/balls/last`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Try to undo again - should fail
      await request(testApp.getHttpServer())
        .delete(`/matches/innings/${innings.id}/balls/last`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);
    });
  });

  describe('GET /matches/:id/scorecard', () => {
    let innings: any;

    beforeEach(async () => {
      const inningsResponse = await request(testApp.getHttpServer())
        .post(`/matches/${match.id}/innings/start`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          battingTeamId: testSetup.homeTeam.id,
          bowlingTeamId: testSetup.awayTeam.id,
        });
      innings = inningsResponse.body;

      const overResponse = await request(testApp.getHttpServer())
        .post(`/matches/innings/${innings.id}/overs/start`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          bowlerId: testSetup.awayPlayers[0].id,
        });

      // Add some balls for scoring
      await request(testApp.getHttpServer())
        .post(`/matches/innings/${innings.id}/balls`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          ball: {
            strikerId: testSetup.homePlayers[0].id,
            nonStrikerId: testSetup.homePlayers[1].id,
            bowlerId: testSetup.awayPlayers[0].id,
            runsOffBat: 4,
            extras: {},
            boundary: 'four',
          },
        });

      await request(testApp.getHttpServer())
        .post(`/matches/innings/${innings.id}/balls`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          ball: {
            strikerId: testSetup.homePlayers[0].id,
            nonStrikerId: testSetup.homePlayers[1].id,
            bowlerId: testSetup.awayPlayers[0].id,
            runsOffBat: 1,
            extras: {},
          },
        });
    });

    it('should return scorecard with match details', async () => {
      const response = await request(testApp.getHttpServer())
        .get(`/matches/${match.id}/scorecard`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('match');
      expect(response.body).toHaveProperty('innings');
      expect(response.body.match).toMatchObject({
        id: match.id,
        homeTeam: expect.objectContaining({ name: 'Home Team' }),
        awayTeam: expect.objectContaining({ name: 'Away Team' }),
        venue: expect.objectContaining({ name: expect.any(String) }),
      });
    });

    it('should return innings statistics', async () => {
      const response = await request(testApp.getHttpServer())
        .get(`/matches/${match.id}/scorecard`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.innings).toHaveLength(1);
      expect(response.body.innings[0]).toMatchObject({
        number: 1,
        battingTeam: expect.objectContaining({ name: 'Home Team' }),
        bowlingTeam: expect.objectContaining({ name: 'Away Team' }),
        totalRuns: 5, // 4 + 1 from the balls we added
        totalWickets: 0,
        totalOvers: expect.any(Number),
      });
    });

    it('should return batting statistics', async () => {
      const response = await request(testApp.getHttpServer())
        .get(`/matches/${match.id}/scorecard`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const batting = response.body.innings[0].batting;
      expect(Array.isArray(batting)).toBe(true);
      expect(batting.length).toBeGreaterThan(0);
      expect(batting[0]).toMatchObject({
        player: expect.objectContaining({
          name: 'Home Player 1',
        }),
        runs: 5,
        balls: 2,
        fours: 1,
        sixes: 0,
        isOut: false,
      });
    });

    it('should return bowling statistics', async () => {
      const response = await request(testApp.getHttpServer())
        .get(`/matches/${match.id}/scorecard`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const bowling = response.body.innings[0].bowling;
      expect(Array.isArray(bowling)).toBe(true);
      expect(bowling.length).toBeGreaterThan(0);
      expect(bowling[0]).toMatchObject({
        player: expect.objectContaining({
          name: 'Away Player 1',
        }),
        overs: expect.any(Number),
        runs: 5,
        wickets: 0,
        economy: expect.any(Number),
      });
    });
  });

  describe('Complete Scoring Workflow', () => {
    it('should handle a complete over', async () => {
      // Start innings
      const inningsResponse = await request(testApp.getHttpServer())
        .post(`/matches/${match.id}/innings/start`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          battingTeamId: testSetup.homeTeam.id,
          bowlingTeamId: testSetup.awayTeam.id,
        });
      const innings = inningsResponse.body;

      // Start over
      await request(testApp.getHttpServer())
        .post(`/matches/innings/${innings.id}/overs/start`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          bowlerId: testSetup.awayPlayers[0].id,
        });

      // Bowl 6 legal deliveries to complete the over
      const ballSequence = [
        { runs: 1, boundary: null },
        { runs: 4, boundary: 'four' },
        { runs: 0, boundary: null },
        { runs: 6, boundary: 'six' },
        { runs: 2, boundary: null },
        { runs: 1, boundary: null },
      ];

      let striker = testSetup.homePlayers[0].id;
      let nonStriker = testSetup.homePlayers[1].id;

      for (let i = 0; i < ballSequence.length; i++) {
        const ball = ballSequence[i];
        
        await request(testApp.getHttpServer())
          .post(`/matches/innings/${innings.id}/balls`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            ball: {
              strikerId: striker,
              nonStrikerId: nonStriker,
              bowlerId: testSetup.awayPlayers[0].id,
              runsOffBat: ball.runs,
              extras: {},
              boundary: ball.boundary,
            },
          });

        // Switch strike if odd runs
        if (ball.runs % 2 === 1) {
          [striker, nonStriker] = [nonStriker, striker];
        }
      }

      // Check scorecard after complete over
      const scorecard = await request(testApp.getHttpServer())
        .get(`/matches/${match.id}/scorecard`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(scorecard.body.innings[0].totalRuns).toBe(14); // 1+4+0+6+2+1
      expect(scorecard.body.innings[0].totalOvers).toBe(1);
    });

    it('should handle wicket and new batsman', async () => {
      // Start innings and over
      const inningsResponse = await request(testApp.getHttpServer())
        .post(`/matches/${match.id}/innings/start`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          battingTeamId: testSetup.homeTeam.id,
          bowlingTeamId: testSetup.awayTeam.id,
        });
      const innings = inningsResponse.body;

      await request(testApp.getHttpServer())
        .post(`/matches/innings/${innings.id}/overs/start`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          bowlerId: testSetup.awayPlayers[0].id,
        });

      // First ball - wicket
      await request(testApp.getHttpServer())
        .post(`/matches/innings/${innings.id}/balls`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          ball: {
            strikerId: testSetup.homePlayers[0].id,
            nonStrikerId: testSetup.homePlayers[1].id,
            bowlerId: testSetup.awayPlayers[0].id,
            runsOffBat: 0,
            extras: {},
          },
          wicket: {
            type: 'bowled',
            dismissedPlayerId: testSetup.homePlayers[0].id,
            bowlerId: testSetup.awayPlayers[0].id,
          },
        });

      // Check scorecard shows wicket
      const scorecard = await request(testApp.getHttpServer())
        .get(`/matches/${match.id}/scorecard`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(scorecard.body.innings[0].totalWickets).toBe(1);
      
      // Find the dismissed batsman in batting stats
      const batting = scorecard.body.innings[0].batting;
      const dismissedBatsman = batting.find((b: any) => 
        b.player.name === 'Home Player 1'
      );
      expect(dismissedBatsman.isOut).toBe(true);
      expect(dismissedBatsman.dismissal).toMatchObject({
        type: 'bowled',
        bowler: expect.objectContaining({ name: 'Away Player 1' }),
      });
    });

    it('should handle match completion workflow', async () => {
      // This is a simplified match completion test
      // In practice, you'd have full innings with proper scoring

      // Start and complete first innings
      const firstInnings = await request(testApp.getHttpServer())
        .post(`/matches/${match.id}/innings/start`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          battingTeamId: testSetup.homeTeam.id,
          bowlingTeamId: testSetup.awayTeam.id,
        });

      // End first innings
      await request(testApp.getHttpServer())
        .post(`/matches/innings/${firstInnings.body.id}/overs/end`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ isDeclared: false });

      // Start second innings
      await request(testApp.getHttpServer())
        .post(`/matches/${match.id}/innings/start`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          battingTeamId: testSetup.awayTeam.id,
          bowlingTeamId: testSetup.homeTeam.id,
          targetRuns: 1, // Low target for quick completion
        });

      // Complete match
      const completion = await request(testApp.getHttpServer())
        .post(`/matches/${match.id}/complete`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          resultType: 'win',
          winnerTeamId: testSetup.homeTeam.id,
          winMargin: 5,
          winType: 'runs',
        });

      expect(completion.body.status).toBe('completed');
      expect(completion.body.resultType).toBe('win');
      expect(completion.body.winnerTeamId).toBe(testSetup.homeTeam.id);
    });
  });
});
