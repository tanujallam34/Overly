import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTeamDto, UpdateTeamDto } from './dto/team.dto';

@Injectable()
export class TeamsService {
  constructor(private readonly prisma: PrismaService) {}

  create(createTeamDto: CreateTeamDto) {
    return this.prisma.team.create({
      data: createTeamDto,
      include: {
        organization: true,
        league: true,
      },
    });
  }

  findAll(organizationId?: string, leagueId?: string) {
    const where: any = {};
    if (organizationId) where.organizationId = organizationId;
    if (leagueId) where.leagueId = leagueId;

    return this.prisma.team.findMany({
      where,
      include: {
        organization: true,
        league: true,
        players: {
          include: {
            player: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const team = await this.prisma.team.findUnique({
      where: { id },
      include: {
        organization: true,
        league: true,
        players: {
          include: {
            player: true,
          },
        },
      },
    });

    if (!team) {
      throw new NotFoundException(`Team with ID ${id} not found`);
    }

    return team;
  }

  async update(id: string, updateTeamDto: UpdateTeamDto) {
    await this.findOne(id); // Check if exists
    return this.prisma.team.update({
      where: { id },
      data: updateTeamDto,
      include: {
        organization: true,
        league: true,
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id); // Check if exists
    return this.prisma.team.delete({
      where: { id },
    });
  }
}
