import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Movie } from '../../database/entities/movie.entity';
import { SearchMovieDto } from './dto/search-movie.dto';

@Injectable()
export class SearchService {
  constructor(
    @InjectRepository(Movie)
    private readonly movieRepository: Repository<Movie>,
  ) {}

  async searchMovies(filter: SearchMovieDto) {
    if (
      filter.minPrice !== undefined &&
      filter.maxPrice !== undefined &&
      filter.minPrice > filter.maxPrice
    ) {
      throw new BadRequestException(
        'Giá tối thiểu phải nhỏ hơn hoặc bằng giá tối đa',
      );
    }
    const query = this.movieRepository
      .createQueryBuilder('movie')
      .leftJoinAndSelect('movie.genres', 'genre')
      .leftJoinAndSelect(
        'movie.showtimes',
        'showtime',
        'showtime.status = :scheduled AND showtime.startTime > :now',
        {
          scheduled: 'SCHEDULED',
          now: new Date(),
        },
      )
      .leftJoinAndSelect('showtime.room', 'room')
      .leftJoinAndSelect('room.cinema', 'cinema')
      .where('movie.status IN (:...publicStatuses)', {
        publicStatuses: ['NOW_SHOWING', 'COMING_SOON'],
      })
      .distinct(true)
      .orderBy('movie.title', 'ASC')
      .addOrderBy('showtime.startTime', 'ASC');

    if (filter.status)
      query.andWhere('movie.status = :status', { status: filter.status });

    if (filter.keyword && filter.keyword.trim()) {
      const keyword = `%${filter.keyword.trim()}%`;
      query.andWhere('LOWER(movie.title) LIKE LOWER(:keyword)', { keyword });
    }

    if (filter.genre && filter.genre.trim()) {
      const genre = filter.genre.trim();
      query.andWhere(
        'movie.id IN (SELECT mg.movie_id FROM movie_genres mg JOIN genres g ON g.genre_id = mg.genre_id WHERE g.genre_name = :genre)',
        { genre },
      );
    }

    if (filter.cinemaId !== undefined && filter.cinemaId !== null) {
      query.andWhere('cinema.id = :cinemaId', { cinemaId: filter.cinemaId });
    }

    if (filter.date) {
      const start = new Date(`${filter.date}T00:00:00+07:00`);
      const end = new Date(start.getTime() + 86400000);
      query.andWhere(
        'showtime.startTime >= :dayStart AND showtime.startTime < :dayEnd',
        {
          dayStart: start,
          dayEnd: end,
        },
      );
    }

    if (filter.minPrice !== undefined && filter.minPrice !== null) {
      query.andWhere('showtime.basePrice >= :minPrice', {
        minPrice: filter.minPrice,
      });
    }

    if (filter.maxPrice !== undefined && filter.maxPrice !== null) {
      query.andWhere('showtime.basePrice <= :maxPrice', {
        maxPrice: filter.maxPrice,
      });
    }

    const items = await query.getMany();

    return {
      message: 'Tìm kiếm và lọc phim thành công',
      data: {
        total: items.length,
        filterCriteria: filter,
        items,
      },
    };
  }
}
