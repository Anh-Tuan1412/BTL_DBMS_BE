import { Injectable } from '@nestjs/common';
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
    return {
      message: 'TODO: Quách Văn Hà viết logic lấy danh sách phim ở đây',
      data: [],
    };
  }

  async findOne(id: number) {
    // TODO: Viết logic lấy chi tiết phim theo ID
    return {
      message: `TODO: Quách Văn Hà viết logic lấy chi tiết phim ID ${id}`,
      movieId: id,
    };
  }

  async create(createMovieDto: CreateMovieDto) {
    // TODO: Viết logic thêm phim mới vào MySQL
    return {
      message: 'TODO: Quách Văn Hà viết logic tạo phim mới',
      payload: createMovieDto,
    };
  }

  async update(id: number, updateMovieDto: UpdateMovieDto) {
    // TODO: Viết logic cập nhật phim
    return {
      message: `TODO: Quách Văn Hà viết logic cập nhật phim ID ${id}`,
      payload: updateMovieDto,
    };
  }

  async remove(id: number) {
    // TODO: Viết logic xóa phim
    return {
      message: `TODO: Quách Văn Hà viết logic xóa phim ID ${id}`,
    };
  }
}
