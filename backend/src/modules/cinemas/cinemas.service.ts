import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Not } from 'typeorm';
import { Cinema } from '../../database/entities/cinema.entity';
import { CinemaRoom } from '../../database/entities/cinema-room.entity';
import { Seat } from '../../database/entities/seat.entity';
import { CreateCinemaDto, CreateRoomDto, UpdateCinemaDto, UpdateRoomDto } from './dto/cinema.dto';

@Injectable()
export class CinemasService {
  constructor(
    @InjectRepository(Cinema)
    private readonly cinemaRepository: Repository<Cinema>,
    @InjectRepository(CinemaRoom)
    private readonly roomRepository: Repository<CinemaRoom>,
    @InjectRepository(Seat)
    private readonly seatRepository: Repository<Seat>,
  ) {}

  // =========================================================================
  // UC2: Quản lý rạp và phòng chiếu (Quách Văn Hà)
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
  // 1. Kiểm tra trùng tên rạp
  const existingName = await this.cinemaRepository.findOne({
    where: { name: dto.name },
  });
  if (existingName) {
    throw new ConflictException(`Rạp chiếu phim tên "${dto.name}" đã tồn tại!`);
  }

  // 2. Kiểm tra trùng địa chỉ rạp
  const existingAddress = await this.cinemaRepository.findOne({
    where: { address: dto.address },
  });
  if (existingAddress) {
    throw new ConflictException(`Địa chỉ "${dto.address}" đã được đăng ký cho rạp khác!`);
  }

  // 3. Kiểm tra trùng số điện thoại (nếu có nhập)
  if (dto.phone) {
    const existingPhone = await this.cinemaRepository.findOne({
      where: { phone: dto.phone },
    });
    if (existingPhone) {
      throw new ConflictException(`Số điện thoại "${dto.phone}" đã được sử dụng bởi rạp khác!`);
    }
  }

  // 4. Lưu rạp mới
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

  // 1. Kiểm tra trùng tên rạp khi cập nhật (bỏ qua rạp hiện tại bằng Not(id))
  if (dto.name) {
    const existingName = await this.cinemaRepository.findOne({
      where: { name: dto.name, id: Not(id) },
    });
    if (existingName) {
      throw new ConflictException(`Tên rạp "${dto.name}" đã được sử dụng bởi rạp khác!`);
    }
  }

  // 2. Kiểm tra trùng địa chỉ khi cập nhật
  if (dto.address) {
    const existingAddress = await this.cinemaRepository.findOne({
      where: { address: dto.address, id: Not(id) },
    });
    if (existingAddress) {
      throw new ConflictException(`Địa chỉ "${dto.address}" đã được sử dụng bởi rạp khác!`);
    }
  }

  // 3. Kiểm tra trùng số điện thoại khi cập nhật
  if (dto.phone) {
    const existingPhone = await this.cinemaRepository.findOne({
      where: { phone: dto.phone, id: Not(id) },
    });
    if (existingPhone) {
      throw new ConflictException(`Số điện thoại "${dto.phone}" đã được sử dụng bởi rạp khác!`);
    }
  }

  // 4. Cập nhật thông tin rạp
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

    try {
      const rooms = await this.roomRepository.find({ where: { cinemaId: id } });
      const roomIds = rooms.map((r) => r.id);

      if (roomIds.length > 0) {
        // 1. Xóa toàn bộ ghế của các phòng thuộc rạp này
        await this.seatRepository.delete({ roomId: In(roomIds) });

        // 2. Xóa các phòng chiếu thuộc rạp
        await this.roomRepository.delete({ cinemaId: id });
      }

      // 3. Xóa rạp chiếu
      await this.cinemaRepository.remove(cinema);

      return {
        message: `Đã xóa rạp chiếu ID ${id} thành công`,
      };
    } catch (error) {
      throw new BadRequestException('Không thể xóa rạp chiếu này do có ràng buộc dữ liệu suất chiếu hoặc vé đặt!');
    }
  }

  // --- Quản lý Phòng chiếu ---
  async findRoomsByCinema(cinemaId: number) {
    await this.findCinemaById(cinemaId);
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
    await this.findCinemaById(dto.cinemaId);

    // 1. Kiểm tra trùng tên phòng trong cùng rạp
    const existingRoom = await this.roomRepository.findOne({
      where: { cinemaId: dto.cinemaId, name: dto.name },
    });

    if (existingRoom) {
      throw new ConflictException(`Phòng chiếu tên "${dto.name}" đã tồn tại trong rạp này!`);
    }

    try {
      // 2. Lưu thông tin phòng
      const room = this.roomRepository.create({
        name: dto.name,
        cinemaId: dto.cinemaId,
        totalSeats: dto.totalSeats,
        status: dto.status,
      });
      const savedRoom = await this.roomRepository.save(room);

      // 3. Sinh danh sách ghế tự động
      const seatConfigList =
        dto.seatConfigurations && dto.seatConfigurations.length > 0
          ? dto.seatConfigurations
          : [{ seatTypeId: 1, totalSeats: dto.totalSeats }];

      const seatTypeQueue: number[] = [];
      for (const config of seatConfigList) {
        for (let i = 0; i < config.totalSeats; i++) {
          seatTypeQueue.push(config.seatTypeId);
        }
      }

      const totalToGenerate = Math.min(dto.totalSeats, seatTypeQueue.length);
      const seatsPerRow = 10;
      const rowCount = Math.ceil(totalToGenerate / seatsPerRow);

      const seatsToCreate: Partial<Seat>[] = [];
      let currentSeatIndex = 0;

      for (let r = 0; r < rowCount; r++) {
        const rowLetter = String.fromCharCode(65 + r);
        for (let c = 1; c <= seatsPerRow; c++) {
          if (currentSeatIndex >= totalToGenerate) break;

          seatsToCreate.push({
            roomId: savedRoom.id,
            row: rowLetter,
            column: c,
            seatNumber: `${rowLetter}${c}`,
            seatTypeId: seatTypeQueue[currentSeatIndex],
            status: 'AVAILABLE',
          });

          currentSeatIndex++;
        }
      }

      await this.seatRepository.save(seatsToCreate);

      return {
        message: 'Thêm phòng chiếu mới và khởi tạo sơ đồ ghế thành công',
        data: savedRoom,
      };
    } catch (error) {
      throw new InternalServerErrorException('Có lỗi xảy ra khi tạo phòng chiếu và ghế.');
    }
  }

  async updateRoom(id: number, dto: UpdateRoomDto) {
    const roomResponse = await this.findRoomById(id);
    const room = roomResponse.data;

    const targetCinemaId = dto.cinemaId ?? room.cinemaId;
    const targetName = dto.name ?? room.name;

    // 💡 1. Kiểm tra trùng tên phòng khi cập nhật (bỏ qua phòng hiện tại bằng `Not(id)`)
    if (dto.name || dto.cinemaId) {
      const duplicateRoom = await this.roomRepository.findOne({
        where: {
          cinemaId: targetCinemaId,
          name: targetName,
          id: Not(id),
        },
      });

      if (duplicateRoom) {
        throw new ConflictException(`Tên phòng "${targetName}" đã được sử dụng bởi phòng khác trong rạp này!`);
      }
    }

    if (dto.cinemaId) {
      await this.findCinemaById(dto.cinemaId);
    }

    try {
      // 2. Cập nhật thông tin cơ bản
      Object.assign(room, {
        name: targetName,
        totalSeats: dto.totalSeats ?? room.totalSeats,
        cinemaId: targetCinemaId,
        status: dto.status ?? room.status,
      });
      const updatedRoom = await this.roomRepository.save(room);

      // 3. Tái tạo lại danh sách ghế nếu có truyền cấu hình ghế mới
      if (dto.seatConfigurations && dto.seatConfigurations.length > 0) {
        await this.seatRepository.delete({ roomId: id });

        const seatTypeQueue: number[] = [];
        for (const config of dto.seatConfigurations) {
          for (let i = 0; i < config.totalSeats; i++) {
            seatTypeQueue.push(config.seatTypeId);
          }
        }

        const totalToGenerate = Math.min(updatedRoom.totalSeats, seatTypeQueue.length);
        const seatsPerRow = 10;
        const rowCount = Math.ceil(totalToGenerate / seatsPerRow);

        const newSeats: Partial<Seat>[] = [];
        let currentSeatIndex = 0;

        for (let r = 0; r < rowCount; r++) {
          const rowLetter = String.fromCharCode(65 + r);

          for (let c = 1; c <= seatsPerRow; c++) {
            if (currentSeatIndex >= totalToGenerate) break;

            newSeats.push({
              roomId: updatedRoom.id,
              row: rowLetter,
              column: c,
              seatNumber: `${rowLetter}${c}`,
              seatTypeId: seatTypeQueue[currentSeatIndex],
              status: 'AVAILABLE',
            });

            currentSeatIndex++;
          }
        }

        await this.seatRepository.save(newSeats);
      }

      return {
        message: `Cập nhật thông tin phòng chiếu ID ${id} thành công`,
        data: updatedRoom,
      };
    } catch (error) {
      if (error instanceof ConflictException) throw error;
      throw new BadRequestException('Không thể tái tạo sơ đồ ghế do phòng đã phát sinh vé đặt hoặc dữ liệu khóa ngoại!');
    }
  }

  async deleteRoom(id: number) {
    const roomResponse = await this.findRoomById(id);
    const room = roomResponse.data;

    try {
      await this.seatRepository.delete({ roomId: id });
      await this.roomRepository.remove(room);

      return {
        message: `Đã xóa phòng chiếu ID ${id} thành công`,
      };
    } catch (error) {
      throw new BadRequestException('Không thể xóa phòng chiếu này vì đã có dữ liệu vé đặt liên quan!');
    }
  }
}