import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { Showtime, Movie, CinemaRoom, Booking } from '../../database/entities';
import { BookingStatus, ShowtimeStatus, MovieStatus } from '../../common/enums';
import {
  CreateShowtimeDto,
  UpdateShowtimeDto,
  CheckConflictDto,
  QueryShowtimeDto,
} from './dto/showtime.dto';

@Injectable()
export class ShowtimesService {
  constructor(
    @InjectRepository(Showtime)
    private readonly showtimeRepository: Repository<Showtime>,
    @InjectRepository(Movie)
    private readonly movieRepository: Repository<Movie>,
    @InjectRepository(CinemaRoom)
    private readonly roomRepository: Repository<CinemaRoom>,
    @InjectRepository(Booking)
    private readonly bookingRepository: Repository<Booking>,
    private readonly dataSource: DataSource,
  ) {}

  // =========================================================================
  // UC4: Đặng Minh Quang - Quản lý suất chiếu & Kiểm tra xung đột lịch chiếu
  // =========================================================================

  /**
   * Lấy danh sách tất cả các suất chiếu, hỗ trợ lọc đa tiêu chí:
   * - movieId: ID phim
   * - roomId: ID phòng chiếu
   * - cinemaId: ID rạp
   * - date: Ngày chiếu (YYYY-MM-DD)
   * - status: SCHEDULED, CANCELLED, COMPLETED...
   *
   * Tận dụng Indexing trên database:
   *  - idx_showtime_movie_id
   *  - idx_showtime_room_id
   *  - idx_showtime_start_time
   */
  async findAll(filter?: QueryShowtimeDto) {
    const query = this.showtimeRepository
      .createQueryBuilder('showtime')
      .leftJoinAndSelect('showtime.movie', 'movie')
      .leftJoinAndSelect('showtime.room', 'room')
      .leftJoinAndSelect('room.cinema', 'cinema')
      .orderBy('showtime.startTime', 'ASC');

    if (filter?.movieId) {
      query.andWhere('showtime.movieId = :movieId', {
        movieId: filter.movieId,
      });
    }

    if (filter?.roomId) {
      query.andWhere('showtime.roomId = :roomId', { roomId: filter.roomId });
    }

    if (filter?.cinemaId) {
      query.andWhere('cinema.id = :cinemaId', { cinemaId: filter.cinemaId });
    }

    if (filter?.status) {
      query.andWhere('showtime.status = :status', { status: filter.status });
    }

    if (filter?.date) {
      const dayStart = new Date(`${filter.date}T00:00:00`);
      const dayEnd = new Date(`${filter.date}T23:59:59.999`);
      if (
        Number.isFinite(dayStart.getTime()) &&
        Number.isFinite(dayEnd.getTime())
      ) {
        query.andWhere(
          'showtime.startTime >= :dayStart AND showtime.startTime <= :dayEnd',
          { dayStart, dayEnd },
        );
      }
    }

    return query.getMany();
  }

  /**
   * Lấy danh sách suất chiếu của một phim cụ thể.
   * Chỉ lấy các suất chưa hủy và sắp xếp theo thời gian bắt đầu.
   */
  async findByMovie(movieId: number) {
    const movie = await this.movieRepository.findOneBy({ id: movieId });
    if (!movie) {
      throw new NotFoundException(`Không tìm thấy phim ID ${movieId}`);
    }

    return this.showtimeRepository.find({
      where: {
        movieId,
      },
      relations: {
        movie: true,
        room: { cinema: true },
      },
      order: { startTime: 'ASC' },
    });
  }

  /**
   * Lấy danh sách suất chiếu của một phòng chiếu cụ thể.
   */
  async findByRoom(roomId: number) {
    const room = await this.roomRepository.findOneBy({ id: roomId });
    if (!room) {
      throw new NotFoundException(`Không tìm thấy phòng chiếu ID ${roomId}`);
    }

    return this.showtimeRepository.find({
      where: { roomId },
      relations: {
        movie: true,
        room: { cinema: true },
      },
      order: { startTime: 'ASC' },
    });
  }

  /**
   * Xem chi tiết một suất chiếu theo ID.
   */
  async findOne(id: number) {
    const showtime = await this.showtimeRepository.findOne({
      where: { id },
      relations: { movie: true, room: { cinema: true } },
    });
    if (!showtime) throw new NotFoundException('Không tìm thấy suất chiếu');
    return showtime;
  }

  /**
   * UC4 — Endpoint kiểm tra xung đột lịch chiếu độc lập.
   * Dùng cho client/admin kiểm tra trực tiếp trước khi tạo suất chiếu.
   *
   * Logic xung đột 2 khoảng thời gian [Start1, End1 + Cleanup1] và [Start2, End2 + Cleanup2]:
   *  Xung đột <=> Start1 < End2 + Cleanup2 AND End1 + Cleanup1 > Start2
   */
  async checkConflict(dto: CheckConflictDto) {
    const start = new Date(dto.startTime);
    const end = new Date(dto.endTime);
    const cleanup = dto.cleanupMinutes ?? 15;
    const excludeId = dto.excludeShowtimeId ?? 0;

    if (
      !Number.isFinite(start.getTime()) ||
      !Number.isFinite(end.getTime()) ||
      end <= start
    ) {
      throw new BadRequestException(
        'Thời gian bắt đầu và kết thúc không hợp lệ (endTime phải sau startTime)',
      );
    }

    const room = await this.roomRepository.findOneBy({ id: dto.roomId });
    if (!room) {
      throw new NotFoundException(
        `Không tìm thấy phòng chiếu ID ${dto.roomId}`,
      );
    }

    // Query kiểm tra trùng lịch có tính cả thời gian dọn phòng (cleanup_minutes)
    const overlaps: {
      showtimeId: number;
      startTime: Date;
      endTime: Date;
      cleanupMinutes: number;
      movieTitle: string;
    }[] = await this.dataSource.query(
      `
      SELECT 
        s.showtime_id AS showtimeId,
        s.start_time AS startTime,
        s.end_time AS endTime,
        s.cleanup_minutes AS cleanupMinutes,
        m.title AS movieTitle
      FROM showtimes s
      JOIN movies m ON m.movie_id = s.movie_id
      WHERE s.room_id = ? 
        AND s.showtime_id <> ? 
        AND s.status <> 'CANCELLED'
        AND s.start_time < DATE_ADD(?, INTERVAL ? MINUTE)
        AND DATE_ADD(s.end_time, INTERVAL s.cleanup_minutes MINUTE) > ?
      `,
      [dto.roomId, excludeId, end, cleanup, start],
    );

    if (overlaps.length > 0) {
      return {
        hasConflict: true,
        message: `Phát hiện xung đột lịch chiếu hoặc thời gian dọn phòng tại phòng '${room.name}'`,
        conflicts: overlaps.map((o) => ({
          showtimeId: o.showtimeId,
          movieTitle: o.movieTitle,
          startTime: o.startTime,
          endTime: o.endTime,
          cleanupMinutes: o.cleanupMinutes,
        })),
      };
    }

    return {
      hasConflict: false,
      message: `Khung giờ khả dụng, phòng '${room.name}' không bị trùng lịch`,
      conflicts: [],
    };
  }

  /**
   * Hàm validate nội bộ dùng trong transaction tạo / sửa suất chiếu.
   */
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
        'Thời gian suất chiếu không hợp lệ hoặc phải trong tương lai',
      );
    }

    const movie = await manager.findOneBy(Movie, { id: dto.movieId });
    if (!movie || movie.status === MovieStatus.END_OF_SHOW) {
      throw new BadRequestException('Phim không khả dụng hoặc đã ngừng chiếu');
    }

    const durationMs = movie.durationMinutes * 60000;
    if (end.getTime() - start.getTime() < durationMs) {
      throw new BadRequestException(
        `Thời gian suất chiếu (${Math.round((end.getTime() - start.getTime()) / 60000)} phút) phải tối thiểu bằng thời lượng phim (${movie.durationMinutes} phút)`,
      );
    }

    // Kiểm tra xung đột lịch chiếu trong phòng
    const overlaps: {
      showtime_id: number;
      title: string;
      start_time: Date;
      end_time: Date;
    }[] = await manager.query(
      `
      SELECT s.showtime_id, m.title, s.start_time, s.end_time
      FROM showtimes s
      JOIN movies m ON m.movie_id = s.movie_id
      WHERE s.room_id = ? 
        AND s.showtime_id <> ? 
        AND s.status <> 'CANCELLED'
        AND s.start_time < DATE_ADD(?, INTERVAL ? MINUTE)
        AND DATE_ADD(s.end_time, INTERVAL s.cleanup_minutes MINUTE) > ?
      LIMIT 1`,
      [dto.roomId, excludeId, end, cleanup, start],
    );

    if (overlaps.length) {
      const conflict = overlaps[0];
      throw new ConflictException(
        `Trùng lịch chiếu hoặc thời gian dọn phòng với phim '${conflict.title}' (Suất ID: ${conflict.showtime_id})`,
      );
    }

    return { start, end, cleanup };
  }

  /**
   * Khóa phòng bi quan (Pessimistic Write Lock) để tránh xung đột lịch chiếu khi 2 Admin cùng đặt lịch.
   */
  private async lockRoom(manager: EntityManager, roomId: number) {
    const room = await manager.findOne(CinemaRoom, {
      where: { id: roomId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!room || room.status !== 'ACTIVE') {
      throw new BadRequestException('Phòng chiếu không tồn tại hoặc không khả dụng');
    }
  }

  /**
   * UC4 — Tạo suất chiếu mới (chỉ Admin).
   * 1. Khóa bi quan phòng chiếu để đảm bảo tuần tự hóa (Serialize).
   * 2. Validate thời lượng phim, thời gian tương lai, xung đột phòng & dọn phòng.
   * 3. Lưu suất chiếu mới vào MySQL.
   * 4. Tự động khởi tạo trạng thái ghế trong bảng `showtime_seats` cho các ghế AVAILABLE của phòng.
   */
  async create(dto: CreateShowtimeDto) {
    return this.dataSource.transaction('READ COMMITTED', async (manager) => {
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

      // Tự động khởi tạo ghế cho suất chiếu từ danh sách ghế AVAILABLE của phòng
      await manager.query(
        `INSERT INTO showtime_seats (showtime_id, seat_id, room_id)
        SELECT ?, seat_id, room_id FROM seats WHERE room_id = ? AND status = 'AVAILABLE'`,
        [showtime.id, dto.roomId],
      );

      return showtime;
    });
  }

  /**
   * UC4 — Cập nhật thông tin suất chiếu chưa có booking (chỉ Admin).
   */
  async update(id: number, dto: UpdateShowtimeDto) {
    const previous = await this.findOne(id);

    return this.dataSource.transaction('READ COMMITTED', async (manager) => {
      // Khóa các phòng theo thứ tự ID tăng dần để ngăn ngừa Deadlock
      const roomIds = [
        ...new Set([previous.roomId, dto.roomId ?? previous.roomId]),
      ].sort((a, b) => a - b);

      for (const roomId of roomIds) {
        await this.lockRoom(manager, roomId);
      }

      const showtime = await manager.findOne(Showtime, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!showtime) throw new NotFoundException('Không tìm thấy suất chiếu');

      if (showtime.roomId !== previous.roomId) {
        throw new ConflictException('Suất chiếu vừa thay đổi dữ liệu, hãy tải lại trang');
      }
      if (showtime.status !== ShowtimeStatus.SCHEDULED) {
        throw new ConflictException('Chỉ được cập nhật suất chiếu ở trạng thái SCHEDULED');
      }

      // Không cho phép sửa nếu suất chiếu đã có booking để đảm bảo toàn vẹn giao dịch
      const bookingCount = await manager.count(Booking, {
        where: { showtimeId: id },
      });
      if (bookingCount > 0) {
        throw new ConflictException(
          'Không thể chỉnh sửa suất chiếu đã có khách đặt vé',
        );
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

      // Cập nhật lại sơ đồ ghế showtime_seats nếu thay đổi phòng chiếu
      if (merged.roomId !== showtime.roomId) {
        await manager.query(
          'DELETE FROM showtime_seats WHERE showtime_id = ?',
          [id],
        );
        await manager.query(
          `INSERT INTO showtime_seats (showtime_id, seat_id, room_id)
          SELECT ?, seat_id, room_id FROM seats WHERE room_id = ? AND status = 'AVAILABLE'`,
          [id, merged.roomId],
        );
      }

      Object.assign(showtime, {
        movieId: merged.movieId,
        roomId: merged.roomId,
        startTime: start,
        endTime: end,
        basePrice: merged.basePrice,
        cleanupMinutes: cleanup,
      });

      return manager.save(showtime);
    });
  }

  /**
   * UC4 — Hủy suất chiếu (chỉ Admin).
   * Soft-delete: chuyển status sang CANCELLED, từ chối nếu có booking PENDING/CONFIRMED.
   */
  async remove(id: number) {
    const previous = await this.findOne(id);

    return this.dataSource.transaction('READ COMMITTED', async (manager) => {
      await this.lockRoom(manager, previous.roomId);

      const showtime = await manager.findOne(Showtime, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!showtime) throw new NotFoundException('Không tìm thấy suất chiếu');

      if (showtime.status === ShowtimeStatus.CANCELLED) return showtime;

      if (
        showtime.status !== ShowtimeStatus.SCHEDULED ||
        showtime.startTime <= new Date()
      ) {
        throw new ConflictException('Chỉ được hủy suất chiếu chưa diễn ra');
      }

      // Kiểm tra các booking đang hoạt động
      const activeBookings = await manager
        .createQueryBuilder(Booking, 'b')
        .where('b.showtimeId = :id', { id })
        .andWhere('b.status IN (:...statuses)', {
          statuses: [BookingStatus.PENDING, BookingStatus.CONFIRMED],
        })
        .getCount();

      if (activeBookings > 0) {
        throw new ConflictException(
          'Không thể hủy suất chiếu đang có vé chờ thanh toán hoặc đã xác nhận',
        );
      }

      showtime.status = ShowtimeStatus.CANCELLED;
      return manager.save(showtime);
    });
  }
}

