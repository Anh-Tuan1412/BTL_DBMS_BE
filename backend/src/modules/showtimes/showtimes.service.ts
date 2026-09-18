import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Showtime } from '../../database/entities/showtime.entity';
import { Movie } from '../../database/entities/movie.entity';
import { CinemaRoom } from '../../database/entities/cinema-room.entity';
import { CreateShowtimeDto } from './dto/showtime.dto';

@Injectable()
export class ShowtimesService {
  constructor(
    @InjectRepository(Showtime)
    private readonly showtimeRepository: Repository<Showtime>,
    @InjectRepository(Movie)
    private readonly movieRepository: Repository<Movie>,
    @InjectRepository(CinemaRoom)
    private readonly roomRepository: Repository<CinemaRoom>,
  ) {}

  // =========================================================================
  // TODO: Đặng Minh Quang - Hiện thực UC4: Quản lý suất chiếu
  // =========================================================================

  async findAll() {
    // TODO: Viết logic lấy danh sách tất cả các suất chiếu
    return {
      message: 'TODO: Quang viết logic lấy danh sách suất chiếu',
      data: [],
    };
  }

  async findByMovie(movieId: number) {
    // TODO: Viết logic lấy suất chiếu theo từng phim
    return {
      message: `TODO: Quang viết logic lấy suất chiếu của phim ID ${movieId}`,
      movieId,
      data: [],
    };
  }

  async findOne(id: number) {
    // TODO: Viết logic xem chi tiết một suất chiếu
    return {
      message: `TODO: Quang viết logic xem chi tiết suất chiếu ID ${id}`,
      showtimeId: id,
    };
  }

  async create(dto: CreateShowtimeDto) {
    // TODO: Viết logic tạo suất chiếu mới:
    // 1. Kiểm tra tồn tại của Movie và CinemaRoom
    // 2. Kiểm tra xung đột lịch chiếu trong cùng phòng (Overlap time)
    // 3. Lưu suất chiếu mới vào MySQL
    return {
      message: 'TODO: Quang viết logic tạo suất chiếu mới',
      payload: dto,
    };
  }

  async remove(id: number) {
    // TODO: Viết logic xóa suất chiếu
    return {
      message: `TODO: Quang viết logic xóa suất chiếu ID ${id}`,
    };
  }
}
