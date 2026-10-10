import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Movie } from '../../database/entities/movie.entity';
import { CreateMovieDto, UpdateMovieDto } from './dto/movie.dto';

@Injectable()
export class MoviesService {
  constructor(
    @InjectRepository(Movie)
    private readonly movieRepository: Repository<Movie>,
  ) {}

  // =========================================================================
  // TODO: Quách Văn Hà - Hiện thực UC1: Quản lý phim (CRUD phim)
  // =========================================================================

  async findAll() {
    // TODO: Viết logic lấy danh sách tất cả các phim
    const movies = await this.movieRepository.find({
      order: { createdAt: 'DESC' },
    });
    return {
      message: 'Lấy danh sách phim thành công',
      data: movies,
    };
  }

  async findOne(id: number) {
    // TODO: Viết logic lấy chi tiết phim theo ID
    const movie = await this.movieRepository.findOne({ where: { id } });
    if (!movie) {
      throw new NotFoundException(`Không tìm thấy phim với ID = ${id}`);
    }
    return {
      message: 'Lấy thông tin chi tiết phim thành công',
      data: movie,
    };
  }

  async create(createMovieDto: CreateMovieDto) {
    const newMovie = this.movieRepository.create(createMovieDto);
    const savedMovie = await this.movieRepository.save(newMovie);
    return {
      message: 'Thêm phim mới thành công',
      data: savedMovie,
    };
  }

  async update(id: number, updateMovieDto: UpdateMovieDto) {
    // TODO: Viết logic cập nhật phim
    const movieResponse = await this.findOne(id);
    const movie = movieResponse.data;

    // Ghi đè dữ liệu mới vào entity cũ
    Object.assign(movie, updateMovieDto);
    const updatedMovie = await this.movieRepository.save(movie);

    return {
      message: `Cập nhật thông tin phim ID ${id} thành công`,
      data: updatedMovie,
    };
  }

  async remove(id: number) {
    // TODO: Viết logic xóa phim
    const movieResponse = await this.findOne(id);
    const movie = movieResponse.data;

    await this.movieRepository.remove(movie);

    return {
      message: `Đã xóa phim ID ${id} thành công`,
    };
  }
}
