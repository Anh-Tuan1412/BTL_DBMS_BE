import { Controller, Get } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ApiTags } from '@nestjs/swagger';
import { Repository } from 'typeorm';
import { Genre } from '../../database/entities/genre.entity';
import { Public } from '../../common/decorators';

@ApiTags('Genres')
@Controller('genres')
export class GenresController {
  constructor(
    @InjectRepository(Genre) private readonly genres: Repository<Genre>,
  ) {}

  @Public()
  @Get()
  findAll() {
    return this.genres.find({ order: { name: 'ASC' } });
  }
}
