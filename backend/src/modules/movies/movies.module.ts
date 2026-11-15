import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Movie } from '../../database/entities/movie.entity';
import { Genre } from '../../database/entities/genre.entity';
import { MoviesService } from './movies.service';
import { MoviesController } from './movies.controller';
import { GenresController } from './genres.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Movie, Genre])],
  controllers: [MoviesController, GenresController],
  providers: [MoviesService],
  exports: [MoviesService],
})
export class MoviesModule {}
