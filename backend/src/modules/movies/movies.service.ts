import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Movie } from '../../database/entities/movie.entity';
import { Genre } from '../../database/entities/genre.entity';
import { CreateMovieDto, UpdateMovieDto } from './dto/movie.dto';

@Injectable()
export class MoviesService {
  constructor(
    @InjectRepository(Movie)
    private readonly movieRepository: Repository<Movie>,
    @InjectRepository(Genre)
    private readonly genreRepository: Repository<Genre>,
  ) {}

  async findAll() {
    const movies = await this.movieRepository.find({
      relations: {
        genres: true, // ✅ Đã sửa thành Object format cho TypeORM v0.3+
      },
      order: { createdAt: 'DESC' },
    });
    return {
      message: 'Lấy danh sách phim thành công',
      data: movies,
    };
  }

  async findOne(id: number) {
    const movie = await this.movieRepository.findOne({
      where: { id },
      relations: {
        genres: true, // ✅ Đã sửa thành Object format cho TypeORM v0.3+
      },
    });
    if (!movie) {
      throw new NotFoundException(`Không tìm thấy phim với ID = ${id}`);
    }
    return {
      message: 'Lấy thông tin chi tiết phim thành công',
      data: movie,
    };
  }

  async create(createMovieDto: CreateMovieDto) {
    const { genreIds, ...movieData } = createMovieDto;

    let genres: Genre[] = [];
    if (genreIds && genreIds.length > 0) {
      genres = await this.genreRepository.findBy({ id: In(genreIds) });
    }

    const newMovie = this.movieRepository.create({
      ...movieData,
      genres,
    });

    const savedMovie = await this.movieRepository.save(newMovie);
    return {
      message: 'Thêm phim mới thành công',
      data: savedMovie,
    };
  }

  async update(id: number, updateMovieDto: UpdateMovieDto) {
    const movieResponse = await this.findOne(id);
    const movie = movieResponse.data;

    const { genreIds, ...movieData } = updateMovieDto;

    if (genreIds) {
      movie.genres = await this.genreRepository.findBy({ id: In(genreIds) });
    }

    Object.assign(movie, movieData);
    const updatedMovie = await this.movieRepository.save(movie);

    return {
      message: `Cập nhật thông tin phim ID ${id} thành công`,
      data: updatedMovie,
    };
  }

  async remove(id: number) {
    const movieResponse = await this.findOne(id);
    const movie = movieResponse.data;

    await this.movieRepository.remove(movie);

    return {
      message: `Đã xóa phim ID ${id} thành công`,
    };
  }
}