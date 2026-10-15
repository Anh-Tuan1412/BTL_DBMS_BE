import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { Showtime, Movie, CinemaRoom, Booking } from '../../database/entities';
import { BookingStatus, ShowtimeStatus, MovieStatus } from '../../common/enums';
import { CreateShowtimeDto, UpdateShowtimeDto } from './dto/showtime.dto';

@Injectable()
export class ShowtimesService {
  constructor(private readonly dataSource: DataSource) {}

  async findAll() {
    return this.dataSource.getRepository(Showtime).find({
      relations: { movie: true, room: { cinema: true } },
      order: { startTime: 'ASC' },
    });
  }

  async findByMovie(movieId: number) {
    return this.dataSource.getRepository(Showtime).find({
      where: { movieId },
      relations: { room: { cinema: true } },
      order: { startTime: 'ASC' },
    });
  }

  async findOne(id: number) {
    const showtime = await this.dataSource.getRepository(Showtime).findOne({
      where: { id },
      relations: { movie: true, room: { cinema: true } },
    });
    if (!showtime) throw new NotFoundException('Không tìm thấy suất chiếu');
    return showtime;
  }

  private async validate(
    manager: EntityManager,
    dto: CreateShowtimeDto,
    excludeId = 0,
  ) {
    const start = new Date(dto.startTime);
    const end = new Date(dto.endTime);
    const cleanup = dto.cleanupMinutes ?? 15;
    if (
      !Number.isFinite(start.getTime()) ||
      !Number.isFinite(end.getTime()) ||
      end <= start ||
      start <= new Date()
    ) {
      throw new BadRequestException(
        'Thời gian suất chiếu không hợp lệ hoặc đã qua',
      );
    }
    const movie = await manager.findOneBy(Movie, { id: dto.movieId });
    if (!movie || movie.status === MovieStatus.END_OF_SHOW)
      throw new BadRequestException('Phim không khả dụng');
    if (end.getTime() - start.getTime() < movie.durationMinutes * 60000) {
      throw new BadRequestException(
        'Thời gian suất chiếu phải đủ thời lượng phim',
      );
    }
    const overlaps = await manager.query(
      `
      SELECT showtime_id FROM showtimes
      WHERE room_id = ? AND showtime_id <> ? AND status <> 'CANCELLED'
        AND start_time < DATE_ADD(?, INTERVAL ? MINUTE)
        AND DATE_ADD(end_time, INTERVAL cleanup_minutes MINUTE) > ?
      LIMIT 1`,
      [dto.roomId, excludeId, end, cleanup, start],
    );
    if (overlaps.length)
      throw new ConflictException('Trùng lịch chiếu hoặc thời gian dọn phòng');
    return { start, end, cleanup };
  }

  private async lockRoom(manager: EntityManager, roomId: number) {
    const room = await manager.findOne(CinemaRoom, {
      where: { id: roomId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!room || room.status !== 'ACTIVE')
      throw new BadRequestException('Phòng chiếu không khả dụng');
  }

  async create(dto: CreateShowtimeDto) {
    return this.dataSource.transaction('READ COMMITTED', async (manager) => {
      // Serialize scheduling even when this room has no screenings yet.
      await this.lockRoom(manager, dto.roomId);
      const { start, end, cleanup } = await this.validate(manager, dto);
      const showtime = await manager.save(
        Showtime,
        manager.create(Showtime, {
          movieId: dto.movieId,
          roomId: dto.roomId,
          startTime: start,
          endTime: end,
          basePrice: dto.basePrice,
          cleanupMinutes: cleanup,
          status: ShowtimeStatus.SCHEDULED,
        }),
      );
      await manager.query(
        `INSERT INTO showtime_seats (showtime_id, seat_id, room_id)
        SELECT ?, seat_id, room_id FROM seats WHERE room_id = ? AND status = 'AVAILABLE'`,
        [showtime.id, dto.roomId],
      );
      return showtime;
    });
  }

  async update(id: number, dto: UpdateShowtimeDto) {
    const previous = await this.findOne(id);
    return this.dataSource.transaction('READ COMMITTED', async (manager) => {
      const roomIds = [
        ...new Set([previous.roomId, dto.roomId ?? previous.roomId]),
      ].sort((a, b) => a - b);
      for (const roomId of roomIds) await this.lockRoom(manager, roomId);
      const showtime = await manager.findOne(Showtime, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!showtime) throw new NotFoundException('Không tìm thấy suất chiếu');
      if (showtime.roomId !== previous.roomId)
        throw new ConflictException('Suất chiếu vừa thay đổi, hãy tải lại');
      if (showtime.status !== ShowtimeStatus.SCHEDULED)
        throw new ConflictException('Chỉ sửa suất chưa chiếu');
      // Historical bookings must retain their screening information and prices.
      if (await manager.count(Booking, { where: { showtimeId: id } })) {
        throw new ConflictException('Không sửa suất chiếu đã có booking');
      }
      const merged: CreateShowtimeDto = {
        movieId: dto.movieId ?? showtime.movieId,
        roomId: dto.roomId ?? showtime.roomId,
        startTime: dto.startTime ?? showtime.startTime.toISOString(),
        endTime: dto.endTime ?? showtime.endTime.toISOString(),
        basePrice: dto.basePrice ?? Number(showtime.basePrice),
        cleanupMinutes: dto.cleanupMinutes ?? showtime.cleanupMinutes,
      };
      const { start, end, cleanup } = await this.validate(manager, merged, id);
      await manager.query('DELETE FROM showtime_seats WHERE showtime_id = ?', [
        id,
      ]);
      Object.assign(showtime, {
        movieId: merged.movieId,
        roomId: merged.roomId,
        startTime: start,
        endTime: end,
        basePrice: merged.basePrice,
        cleanupMinutes: cleanup,
      });
      await manager.save(showtime);
      await manager.query(
        `INSERT INTO showtime_seats (showtime_id, seat_id, room_id)
        SELECT ?, seat_id, room_id FROM seats WHERE room_id = ? AND status = 'AVAILABLE'`,
        [id, merged.roomId],
      );
      return showtime;
    });
  }

  async remove(id: number) {
    const previous = await this.findOne(id);
    return this.dataSource.transaction('READ COMMITTED', async (manager) => {
      await this.lockRoom(manager, previous.roomId);
      const showtime = await manager.findOne(Showtime, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!showtime) throw new NotFoundException('Không tìm thấy suất chiếu');
      if (showtime.roomId !== previous.roomId)
        throw new ConflictException('Suất chiếu vừa thay đổi, hãy tải lại');
      if (showtime.status === ShowtimeStatus.CANCELLED) return showtime;
      if (
        showtime.status !== ShowtimeStatus.SCHEDULED ||
        showtime.startTime <= new Date()
      ) {
        throw new ConflictException('Chỉ hủy suất chưa chiếu');
      }
      const active = await manager
        .createQueryBuilder(Booking, 'b')
        .where('b.showtimeId = :id', { id })
        .andWhere('b.status IN (:...statuses)', {
          statuses: [BookingStatus.PENDING, BookingStatus.CONFIRMED],
        })
        .getCount();
      if (active)
        throw new ConflictException(
          'Cần xử lý các booking hiện hành trước khi hủy suất',
        );
      showtime.status = ShowtimeStatus.CANCELLED;
      return manager.save(showtime);
    });
  }
}
