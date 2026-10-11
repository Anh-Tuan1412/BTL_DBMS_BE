import { Injectable, NotFoundException} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cinema } from '../../database/entities/cinema.entity';
import { CinemaRoom } from '../../database/entities/cinema-room.entity';
import { CreateCinemaDto, CreateRoomDto, UpdateCinemaDto, UpdateRoomDto } from './dto/cinema.dto';

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
    const cinemas = await this.cinemaRepository.find({
      relations: { rooms: true },
      order: { createdAt: 'DESC' },
    });
    return {
      message: 'Lấy danh sách tất cả các cụm rạp thành công',
      data: cinemas,
    };
  }

  async findCinemaById(id: number) {
    const cinema = await this.cinemaRepository.findOne({
      where: { id },
      relations: { rooms: true },
    });
    if (!cinema) {
      throw new NotFoundException(`Không tìm thấy rạp chiếu với ID ${id}`);
    }
    return {
      message: 'Lấy thông tin chi tiết rạp thành công',
      data: cinema,
    };
  }

  async createCinema(dto: CreateCinemaDto) {
    const cinema = this.cinemaRepository.create(dto);
    const savedCinema = await this.cinemaRepository.save(cinema);
    return {
      message: 'Thêm rạp chiếu phim mới thành công',
      data: savedCinema,
    };
  }

  async updateCinema(id: number, dto: UpdateCinemaDto) {
    const cinemaResponse = await this.findCinemaById(id);
    const cinema = cinemaResponse.data;

    Object.assign(cinema, dto);
    const updatedCinema = await this.cinemaRepository.save(cinema);

    return {
      message: `Cập nhật thông tin rạp ID ${id} thành công`,
      data: updatedCinema,
    };
  }

  async deleteCinema(id: number) {
    const cinemaResponse = await this.findCinemaById(id);
    const cinema = cinemaResponse.data;

    await this.cinemaRepository.remove(cinema);
    return {
      message: `Đã xóa rạp chiếu ID ${id} thành công`,
    };
  }

  // --- Quản lý Phòng chiếu ---
  async findRoomsByCinema(cinemaId: number) {
    await this.findCinemaById(cinemaId); // Kiểm tra rạp có tồn tại không
    const rooms = await this.roomRepository.find({
      where: { cinemaId },
      order: { createdAt: 'DESC' },
    });
    return {
      message: `Lấy danh sách phòng chiếu của rạp ID ${cinemaId} thành công`,
      data: rooms,
    };
  }

  async findRoomById(id: number) {
    const room = await this.roomRepository.findOne({
      where: { id },
      relations: { cinema: true },
    });
    if (!room) {
      throw new NotFoundException(`Không tìm thấy phòng chiếu với ID ${id}`);
    }
    return {
      message: 'Lấy thông tin chi tiết phòng chiếu thành công',
      data: room,
    };
  }

  async createRoom(dto: CreateRoomDto) {
    await this.findCinemaById(dto.cinemaId); // Đảm bảo cinemaId hợp lệ
    const room = this.roomRepository.create(dto);
    const savedRoom = await this.roomRepository.save(room);
    return {
      message: 'Thêm phòng chiếu mới thành công',
      data: savedRoom,
    };
  }

  async updateRoom(id: number, dto: UpdateRoomDto) {
    const roomResponse = await this.findRoomById(id);
    const room = roomResponse.data;

    if (dto.cinemaId) {
      await this.findCinemaById(dto.cinemaId); // Kiểm tra nếu thay đổi rạp chiếu
    }

    Object.assign(room, dto);
    const updatedRoom = await this.roomRepository.save(room);

    return {
      message: `Cập nhật thông tin phòng chiếu ID ${id} thành công`,
      data: updatedRoom,
    };
  }

  async deleteRoom(id: number) {
    const roomResponse = await this.findRoomById(id);
    const room = roomResponse.data;

    await this.roomRepository.remove(room);
    return {
      message: `Đã xóa phòng chiếu ID ${id} thành công`,
    };
  }
}
