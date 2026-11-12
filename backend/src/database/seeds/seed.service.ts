import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import {
  Cinema,
  CinemaRoom,
  Genre,
  Movie,
  Seat,
  SeatTypeEntity,
  Showtime,
  User,
} from '../entities';
import { MovieStatus, SeatType, UserRole } from '../../common/enums';
import { ShowtimesService } from '../../modules/showtimes/showtimes.service';

@Injectable()
export class SeedService {
  private readonly logger = new Logger(SeedService.name);
  constructor(
    private readonly db: DataSource,
    private readonly showtimes: ShowtimesService,
  ) {}

  async runSeed() {
    const types = this.db.getRepository(SeatTypeEntity);
    await types
      .createQueryBuilder()
      .insert()
      .values([
        { name: SeatType.REGULAR, priceCoefficient: 1 },
        { name: SeatType.VIP, priceCoefficient: 1.2 },
        { name: SeatType.COUPLE, priceCoefficient: 1.5 },
      ])
      .orIgnore()
      .updateEntity(false)
      .execute();
    const genres = this.db.getRepository(Genre);
    await genres
      .createQueryBuilder()
      .insert()
      .values(
        [
          'Khoa học viễn tưởng',
          'Phiêu lưu',
          'Tiểu sử',
          'Lịch sử',
          'Chính kịch',
        ].map((name) => ({ name })),
      )
      .orIgnore()
      .updateEntity(false)
      .execute();

    // Look up each account independently. Never reset an existing account's
    // password/role and never reuse another fixture's unique phone number.
    const users = this.db.getRepository(User);
    for (const account of [
      {
        email: 'admin@cinema.com',
        fullName: 'Quản trị viên',
        role: UserRole.ADMIN,
      },
      {
        email: 'customer@gmail.com',
        fullName: 'Khách hàng mẫu',
        role: UserRole.CUSTOMER,
      },
    ]) {
      if (!(await users.findOneBy({ email: account.email }))) {
        await users.save(
          users.create({
            ...account,
            password: await bcrypt.hash('Admin@123', 10),
            status: 'ACTIVE',
          }),
        );
      }
    }

    const cinemas = this.db.getRepository(Cinema);
    let cinema = await cinemas.findOneBy({ name: 'CGV Landmark 81' });
    if (!cinema)
      cinema = await cinemas.save(
        cinemas.create({
          name: 'CGV Landmark 81',
          address: '772 Điện Biên Phủ, Bình Thạnh',
          city: 'TP. Hồ Chí Minh',
          status: 'ACTIVE',
        }),
      );
    const rooms = this.db.getRepository(CinemaRoom);
    let room = await rooms.findOne({
      where: { cinemaId: cinema.id, status: 'ACTIVE' },
      order: { id: 'ASC' },
    });
    if (!room)
      room = await rooms.save(
        rooms.create({
          cinemaId: cinema.id,
          name: 'Phòng 01',
          totalSeats: 0,
          status: 'ACTIVE',
        }),
      );
    const seats = this.db.getRepository(Seat);
    if (!(await seats.countBy({ roomId: room.id }))) {
      const allTypes = await types.find();
      await seats.save(
        ['A', 'B', 'C', 'D'].flatMap((row, index) =>
          Array.from({ length: 10 }, (_, col) =>
            seats.create({
              roomId: room!.id,
              row,
              column: col + 1,
              seatNumber: `${row}${col + 1}`,
              seatTypeId: allTypes.find(
                (t) =>
                  t.name === (index >= 2 ? SeatType.VIP : SeatType.REGULAR),
              )!.id,
              status: 'AVAILABLE',
            }),
          ),
        ),
      );
      await rooms.update(room.id, { totalSeats: 40 });
    }

    const movies = this.db.getRepository(Movie);
    for (const sample of [
      {
        title: 'Dune: Part Two',
        durationMinutes: 166,
        director: 'Denis Villeneuve',
      },
      {
        title: 'Oppenheimer',
        durationMinutes: 180,
        director: 'Christopher Nolan',
      },
    ]) {
      if (!(await movies.findOneBy({ title: sample.title }))) {
        await movies.save(
          movies.create({
            ...sample,
            status: MovieStatus.NOW_SHOWING,
            releaseDate: new Date(),
            genres: await genres.find({ take: 2 }),
            rating: 8.5,
          }),
        );
      }
    }

    const allMovies = await movies.find({
      where: { status: MovieStatus.NOW_SHOWING },
      order: { id: 'ASC' },
    });
    const screenings = this.db.getRepository(Showtime);
    for (const [index, movie] of allMovies.entries()) {
      const future = await screenings
        .createQueryBuilder('s')
        .where(
          's.movieId = :movie AND s.status = :status AND s.startTime > :now',
          { movie: movie.id, status: 'SCHEDULED', now: new Date() },
        )
        .getOne();
      if (future) continue;
      const day = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Ho_Chi_Minh',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date(Date.now() + (index + 1) * 86400000));
      const start = new Date(`${day}T19:00:00+07:00`);
      const end = new Date(start.getTime() + movie.durationMinutes * 60000);
      const dto = {
        movieId: movie.id,
        roomId: room.id,
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        basePrice: 100000,
      };
      const conflict = await this.showtimes.checkConflict(dto);
      if (conflict.hasConflict) {
        this.logger.warn(
          `Bỏ qua lịch mẫu xung đột cho phim ID ${movie.id}; giữ nguyên lịch đã có.`,
        );
        continue;
      }
      await this.showtimes.create(dto);
    }
    this.logger.log(
      'Seed hoàn tất: giữ dữ liệu hiện có, bổ sung tài khoản/phim/lịch chiếu tương lai còn thiếu. Không tạo booking hay thanh toán giả.',
    );
  }
}
