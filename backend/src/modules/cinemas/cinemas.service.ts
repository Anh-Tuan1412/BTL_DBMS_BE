import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  InternalServerErrorException,
  HttpException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Not } from 'typeorm';
import { Cinema } from '../../database/entities/cinema.entity';
import { CinemaRoom } from '../../database/entities/cinema-room.entity';
import { Seat } from '../../database/entities/seat.entity';
import { SeatTypeEntity } from '../../database/entities/seat-type.entity';
import {
  CreateCinemaDto,
  CreateRoomDto,
  UpdateCinemaDto,
  UpdateRoomDto,
} from './dto/cinema.dto';

function seatRow(index: number) {
  let value = index + 1;
  let label = '';
  while (value > 0) {
    value -= 1;
    label = String.fromCharCode(65 + (value % 26)) + label;
    value = Math.floor(value / 26);
  }
  return label;
}

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
      throw new ConflictException(
        `Rạp chiếu phim tên "${dto.name}" đã tồn tại!`,
      );
    }

    // 2. Kiểm tra trùng địa chỉ rạp
    const existingAddress = await this.cinemaRepository.findOne({
      where: { address: dto.address },
    });
    if (existingAddress) {
      throw new ConflictException(
        `Địa chỉ "${dto.address}" đã được đăng ký cho rạp khác!`,
      );
    }

    // 3. Kiểm tra trùng số điện thoại (nếu có nhập)
    if (dto.phone) {
      const existingPhone = await this.cinemaRepository.findOne({
        where: { phone: dto.phone },
      });
      if (existingPhone) {
        throw new ConflictException(
          `Số điện thoại "${dto.phone}" đã được sử dụng bởi rạp khác!`,
        );
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
        throw new ConflictException(
          `Tên rạp "${dto.name}" đã được sử dụng bởi rạp khác!`,
        );
      }
    }

    // 2. Kiểm tra trùng địa chỉ khi cập nhật
    if (dto.address) {
      const existingAddress = await this.cinemaRepository.findOne({
        where: { address: dto.address, id: Not(id) },
      });
      if (existingAddress) {
        throw new ConflictException(
          `Địa chỉ "${dto.address}" đã được sử dụng bởi rạp khác!`,
        );
      }
    }

    // 3. Kiểm tra trùng số điện thoại khi cập nhật
    if (dto.phone) {
      const existingPhone = await this.cinemaRepository.findOne({
        where: { phone: dto.phone, id: Not(id) },
      });
      if (existingPhone) {
        throw new ConflictException(
          `Số điện thoại "${dto.phone}" đã được sử dụng bởi rạp khác!`,
        );
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
    return this.roomRepository.manager.transaction(async (manager) => {
      const roomRepo = manager.getRepository(CinemaRoom);
      const seatRepo = manager.getRepository(Seat);
      const cinemaRepo = manager.getRepository(Cinema);

      const cinemaResponse = await this.findCinemaById(id);
      const cinema = cinemaResponse.data;

      try {
        const rooms = await roomRepo.find({ where: { cinemaId: id } });
        const roomIds = rooms.map((r) => r.id);

        if (roomIds.length > 0) {
          // 1. Xóa toàn bộ ghế của các phòng thuộc rạp này
          await seatRepo.delete({ roomId: In(roomIds) });

          // 2. Xóa các phòng chiếu thuộc rạp
          await roomRepo.delete({ cinemaId: id });
        }

        // 3. Xóa rạp chiếu
        await cinemaRepo.remove(cinema);

        return {
          message: `Đã xóa rạp chiếu ID ${id} thành công`,
        };
      } catch (error) {
        throw new BadRequestException(
          'Không thể xóa rạp chiếu này do có ràng buộc dữ liệu suất chiếu hoặc vé đặt!',
        );
      }
    });
  }

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
    return this.roomRepository.manager.transaction(async (manager) => {
      const roomRepo = manager.getRepository(CinemaRoom);
      const seatRepo = manager.getRepository(Seat);

      await this.findCinemaById(dto.cinemaId);

      // 1. Kiểm tra trùng tên phòng trong cùng rạp
      const existingRoom = await roomRepo.findOne({
        where: { cinemaId: dto.cinemaId, name: dto.name },
      });

      if (existingRoom) {
        throw new ConflictException(
          `Phòng chiếu tên "${dto.name}" đã tồn tại trong rạp này!`,
        );
      }

      try {
        // 2. Lưu thông tin phòng
        const room = roomRepo.create({
          name: dto.name,
          cinemaId: dto.cinemaId,
          totalSeats: dto.totalSeats,
          status: dto.status,
        });
        const savedRoom = await roomRepo.save(room);

        // 3. Sinh danh sách ghế tự động
        const types = await manager
          .getRepository(SeatTypeEntity)
          .find({ where: { status: 'ACTIVE' } });
        const regular = types.find((type) => type.name === 'REGULAR');
        if (!regular)
          throw new BadRequestException('Chưa cấu hình loại ghế thường');
        const seatConfigList =
          dto.seatConfigurations && dto.seatConfigurations.length > 0
            ? dto.seatConfigurations
            : [{ seatTypeId: regular.id, totalSeats: dto.totalSeats }];

        if (
          seatConfigList.some(
            (config) => !types.some((type) => type.id === config.seatTypeId),
          )
        )
          throw new BadRequestException('Loại ghế không khả dụng');
        if (
          seatConfigList.reduce((sum, config) => sum + config.totalSeats, 0) !==
          dto.totalSeats
        )
          throw new BadRequestException(
            'Tổng số ghế theo loại phải bằng tổng ghế của phòng',
          );
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
          const rowLetter = seatRow(r);
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

        await seatRepo.save(seatsToCreate);

        return {
          message: 'Thêm phòng chiếu mới và khởi tạo sơ đồ ghế thành công',
          data: savedRoom,
        };
      } catch (error) {
        if (error instanceof HttpException) throw error;
        if (
          error?.code === 'ER_DUP_ENTRY' ||
          error?.driverError?.code === 'ER_DUP_ENTRY'
        )
          throw new ConflictException(
            'Tên phòng đã được sử dụng trong rạp này',
          );
        throw new InternalServerErrorException(
          'Có lỗi xảy ra khi tạo phòng chiếu và ghế.',
        );
      }
    });
  }

  async updateRoom(id: number, dto: UpdateRoomDto) {
    return this.roomRepository.manager.transaction(async (manager) => {
      const roomRepo = manager.getRepository(CinemaRoom);
      const seatRepo = manager.getRepository(Seat);

      const room = await roomRepo.findOne({
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!room) throw new NotFoundException('Không tìm thấy phòng chiếu');
      if (dto.seatConfigurations?.length) {
        const desired = dto.seatConfigurations
          .filter((c) => c.totalSeats > 0)
          .map((c) => ({
            seatTypeId: Number(c.seatTypeId),
            totalSeats: Number(c.totalSeats),
          }))
          .sort((a, b) => a.seatTypeId - b.seatTypeId);
        const current = await seatRepo
          .createQueryBuilder('seat')
          .select('seat.seatTypeId', 'seatTypeId')
          .addSelect('COUNT(*)', 'totalSeats')
          .where('seat.roomId = :id AND seat.status = :status', {
            id,
            status: 'AVAILABLE',
          })
          .groupBy('seat.seatTypeId')
          .getRawMany();
        const normalized = current
          .map((c) => ({
            seatTypeId: Number(c.seatTypeId),
            totalSeats: Number(c.totalSeats),
          }))
          .sort((a, b) => a.seatTypeId - b.seatTypeId);
        const requestedTotal = desired.reduce(
          (sum, c) => sum + Number(c.totalSeats),
          0,
        );
        if (requestedTotal !== (dto.totalSeats ?? room.totalSeats))
          throw new BadRequestException(
            'Tổng số ghế theo loại phải bằng tổng ghế của phòng',
          );
        // Renaming a room with unchanged configuration must preserve every seat ID.
        if (JSON.stringify(desired) === JSON.stringify(normalized))
          dto = { ...dto, seatConfigurations: undefined };
      }
      const layoutChanges =
        Boolean(dto.seatConfigurations?.length) ||
        (dto.totalSeats !== undefined && dto.totalSeats !== room.totalSeats) ||
        (dto.cinemaId !== undefined && dto.cinemaId !== room.cinemaId);
      if (layoutChanges) {
        const [usage] = await manager.query(
          `SELECT
        EXISTS(SELECT 1 FROM showtimes WHERE room_id=? AND status='SCHEDULED' AND start_time>UTC_TIMESTAMP()) OR
        EXISTS(SELECT 1 FROM booking_details b JOIN seats s ON s.seat_id=b.seat_id WHERE s.room_id=?) AS inUse`,
          [id, id],
        );
        if (Number(usage.inUse))
          throw new ConflictException(
            'Không thể thay đổi sơ đồ phòng đang mở lịch bán vé hoặc đã có lịch sử vé',
          );
      }

      const targetCinemaId = dto.cinemaId ?? room.cinemaId;
      const targetName = dto.name ?? room.name;

      // 💡 1. Kiểm tra trùng tên phòng khi cập nhật (bỏ qua phòng hiện tại bằng `Not(id)`)
      if (dto.name || dto.cinemaId) {
        const duplicateRoom = await roomRepo.findOne({
          where: {
            cinemaId: targetCinemaId,
            name: targetName,
            id: Not(id),
          },
        });

        if (duplicateRoom) {
          throw new ConflictException(
            `Tên phòng "${targetName}" đã được sử dụng bởi phòng khác trong rạp này!`,
          );
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
        const updatedRoom = await roomRepo.save(room);

        // 3. Tái tạo lại danh sách ghế nếu có truyền cấu hình ghế mới
        if (dto.seatConfigurations && dto.seatConfigurations.length > 0) {
          await seatRepo.delete({ roomId: id });

          const seatTypeQueue: number[] = [];
          for (const config of dto.seatConfigurations) {
            for (let i = 0; i < config.totalSeats; i++) {
              seatTypeQueue.push(config.seatTypeId);
            }
          }

          const totalToGenerate = Math.min(
            updatedRoom.totalSeats,
            seatTypeQueue.length,
          );
          const seatsPerRow = 10;
          const rowCount = Math.ceil(totalToGenerate / seatsPerRow);

          const newSeats: Partial<Seat>[] = [];
          let currentSeatIndex = 0;

          for (let r = 0; r < rowCount; r++) {
            const rowLetter = seatRow(r);

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

          await seatRepo.save(newSeats);
        }

        return {
          message: `Cập nhật thông tin phòng chiếu ID ${id} thành công`,
          data: updatedRoom,
        };
      } catch (error) {
        if (error instanceof ConflictException) throw error;
        throw new BadRequestException(
          'Không thể tái tạo sơ đồ ghế do phòng đã phát sinh vé đặt hoặc dữ liệu khóa ngoại!',
        );
      }
    });
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
      throw new BadRequestException(
        'Không thể xóa phòng chiếu này vì đã có dữ liệu vé đặt liên quan!',
      );
    }
  }
}
