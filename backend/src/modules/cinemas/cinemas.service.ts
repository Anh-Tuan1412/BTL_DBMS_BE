import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cinema } from '../../database/entities/cinema.entity';
import { CinemaRoom } from '../../database/entities/cinema-room.entity';
import { CreateCinemaDto, CreateRoomDto } from './dto/cinema.dto';

@Injectable()
export class CinemasService {
  constructor(
    @InjectRepository(Cinema)
    private readonly cinemaRepository: Repository<Cinema>,
    @InjectRepository(CinemaRoom)
    private readonly roomRepository: Repository<CinemaRoom>,
  ) {}

  // =========================================================================
  // TODO: Quách Văn Hà - Hiện thực UC2: Quản lý rạp và phòng chiếu
  // =========================================================================

  // --- Quản lý Rạp ---
  async findAllCinemas() {
    // TODO: Viết logic lấy danh sách các cụm rạp
    return {
      message: 'TODO: Quách Văn Hà viết logic lấy danh sách rạp',
      data: [],
    };
  }

  async findCinemaById(id: number) {
    // TODO: Viết logic lấy thông tin chi tiết rạp
    return {
      message: `TODO: Quách Văn Hà viết logic xem rạp ID ${id}`,
      cinemaId: id,
    };
  }

  async createCinema(dto: CreateCinemaDto) {
    // TODO: Viết logic thêm rạp chiếu mới
    return {
      message: 'TODO: Quách Văn Hà viết logic tạo rạp',
      payload: dto,
    };
  }

  async deleteCinema(id: number) {
    // TODO: Viết logic xóa rạp
    return {
      message: `TODO: Quách Văn Hà viết logic xóa rạp ID ${id}`,
    };
  }

  // --- Quản lý Phòng chiếu ---
  async findRoomsByCinema(cinemaId: number) {
    // TODO: Viết logic lấy danh sách các phòng chiếu của rạp
    return {
      message: `TODO: Quách Văn Hà viết logic lấy phòng chiếu của rạp ID ${cinemaId}`,
      cinemaId,
      data: [],
    };
  }

  async findRoomById(id: number) {
    // TODO: Viết logic xem chi tiết phòng chiếu
    return {
      message: `TODO: Quách Văn Hà viết logic xem phòng chiếu ID ${id}`,
      roomId: id,
    };
  }

  async createRoom(dto: CreateRoomDto) {
    // TODO: Viết logic tạo phòng chiếu mới cho rạp
    return {
      message: 'TODO: Quách Văn Hà viết logic tạo phòng chiếu',
      payload: dto,
    };
  }

  async deleteRoom(id: number) {
    // TODO: Viết logic xóa phòng chiếu
    return {
      message: `TODO: Quách Văn Hà viết logic xóa phòng chiếu ID ${id}`,
    };
  }
}
