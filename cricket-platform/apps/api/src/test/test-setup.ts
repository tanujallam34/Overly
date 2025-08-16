import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export class TestApp {
  app: INestApplication;
  prisma: PrismaService;
  module: TestingModule;

  async setup(moduleBuilder: any) {
    this.module = await moduleBuilder.compile();
    this.app = this.module.createNestApplication();
    this.prisma = this.app.get<PrismaService>(PrismaService);
    
    await this.app.init();
    return this;
  }

  async cleanup() {
    // Clean up test data in reverse dependency order
    await this.prisma.assignment.deleteMany();
    await this.prisma.ballEvent.deleteMany();
    await this.prisma.wicketEvent.deleteMany();
    await this.prisma.over.deleteMany();
    await this.prisma.powerplay.deleteMany();
    await this.prisma.innings.deleteMany();
    await this.prisma.toss.deleteMany();
    await this.prisma.match.deleteMany();
    await this.prisma.teamPlayer.deleteMany();
    await this.prisma.team.deleteMany();
    await this.prisma.player.deleteMany();
    await this.prisma.league.deleteMany();
    await this.prisma.venue.deleteMany();
    await this.prisma.user.deleteMany();
    await this.prisma.organization.deleteMany();
  }

  async close() {
    await this.cleanup();
    await this.app.close();
  }

  getHttpServer() {
    return this.app.getHttpServer();
  }
}

export const createTestApp = () => new TestApp();
