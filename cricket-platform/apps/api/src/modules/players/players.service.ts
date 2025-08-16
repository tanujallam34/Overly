import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePlayerDto, UpdatePlayerDto } from './dto/player.dto';

@Injectable()
export class PlayersService {
  constructor(private readonly prisma: PrismaService) {}

  create(createPlayerDto: CreatePlayerDto) {
    const data = {
      ...createPlayerDto,
      dob: createPlayerDto.dob ? new Date(createPlayerDto.dob) : undefined,
    };

    return this.prisma.player.create({
      data,
      include: {
        organization: true,
      },
    });
  }

  findAll(organizationId?: string) {
    return this.prisma.player.findMany({
      where: organizationId ? { organizationId } : undefined,
      include: {
        organization: true,
        teams: {
          include: {
            team: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const player = await this.prisma.player.findUnique({
      where: { id },
      include: {
        organization: true,
        teams: {
          include: {
            team: {
              include: {
                league: true,
              },
            },
          },
        },
      },
    });

    if (!player) {
      throw new NotFoundException(`Player with ID ${id} not found`);
    }

    return player;
  }

  async update(id: string, updatePlayerDto: UpdatePlayerDto) {
    await this.findOne(id); // Check if exists
    
    const data = {
      ...updatePlayerDto,
      dob: updatePlayerDto.dob ? new Date(updatePlayerDto.dob) : undefined,
    };

    return this.prisma.player.update({
      where: { id },
      data,
      include: {
        organization: true,
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id); // Check if exists
    return this.prisma.player.delete({
      where: { id },
    });
  }
}
