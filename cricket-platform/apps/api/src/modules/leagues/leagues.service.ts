import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateLeagueDto, UpdateLeagueDto } from './dto/league.dto';

@Injectable()
export class LeaguesService {
  constructor(private readonly prisma: PrismaService) {}

  create(createLeagueDto: CreateLeagueDto) {
    return this.prisma.league.create({
      data: createLeagueDto,
      include: {
        organization: true,
      },
    });
  }

  findAll(organizationId?: string) {
    return this.prisma.league.findMany({
      where: organizationId ? { organizationId } : undefined,
      include: {
        organization: true,
        teams: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const league = await this.prisma.league.findUnique({
      where: { id },
      include: {
        organization: true,
        teams: {
          include: {
            players: {
              include: {
                player: true,
              },
            },
          },
        },
      },
    });

    if (!league) {
      throw new NotFoundException(`League with ID ${id} not found`);
    }

    return league;
  }

  async update(id: string, updateLeagueDto: UpdateLeagueDto) {
    await this.findOne(id); // Check if exists
    return this.prisma.league.update({
      where: { id },
      data: updateLeagueDto,
      include: {
        organization: true,
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id); // Check if exists
    return this.prisma.league.delete({
      where: { id },
    });
  }
}
