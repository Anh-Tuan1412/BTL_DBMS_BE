import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import {
  User,
  Movie,
  Cinema,
  CinemaRoom,
  Seat,
  SeatTypeEntity,
  Genre,
} from '../entities';
import { ShowtimesService } from '../../modules/showtimes/showtimes.service';
import { UserRole, SeatType, MovieStatus } from '../../common/enums';

@Injectable()
export class SeedService {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly showtimesService: ShowtimesService,
  ) {}

  async runSeed() {
    this.logger.log('Bắt đầu khởi tạo dữ liệu mẫu (Seed Data)...');

    const userRepo = this.dataSource.getRepository(User);
    const movieRepo = this.dataSource.getRepository(Movie);
    const cinemaRepo = this.dataSource.getRepository(Cinema);
    const roomRepo = this.dataSource.getRepository(CinemaRoom);
    const seatRepo = this.dataSource.getRepository(Seat);
    const typeRepo = this.dataSource.getRepository(SeatTypeEntity);
    await typeRepo
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
    const types = await typeRepo.find();
    const genreRepo = this.dataSource.getRepository(Genre);
    const genreNames = [
      'Khoa học viễn tưởng',
      'Phiêu lưu',
      'Tiểu sử',
      'Lịch sử',
      'Chính kịch',
    ];
    await genreRepo
      .createQueryBuilder()
      .insert()
      .values(genreNames.map((name) => ({ name })))
      .orIgnore()
      .updateEntity(false)
      .execute();
    const genres = await genreRepo.find();

    // 1. Tạo Users mẫu (Admin & Customer)
    const existingAdmin = await userRepo.findOne({
      where: { email: 'admin@cinema.com' },
    });
    if (!existingAdmin) {
      const passwordHash = await bcrypt.hash('Admin@123', 10);
      await userRepo.save([
        userRepo.create({
          email: 'admin@cinema.com',
          password: passwordHash,
          fullName: 'Quản Trị Viên (Admin)',
          phoneNumber: '0901234567',
          role: UserRole.ADMIN,
        }),
        userRepo.create({
          email: 'customer@gmail.com',
          password: passwordHash,
          fullName: 'Khách Hàng Mẫu',
          phoneNumber: '0988888888',
          role: UserRole.CUSTOMER,
        }),
      ]);
      this.logger.log(
        '-> Đã tạo tài khoản mẫu: admin@cinema.com (Admin@123), customer@gmail.com (Admin@123)',
      );
    }

    // 2. Tạo Rạp & Phòng chiếu mẫu
    let cinema = await cinemaRepo.findOne({
      where: { name: 'CGV Landmark 81' },
    });
    let room1: CinemaRoom;

    if (!cinema) {
      cinema = await cinemaRepo.save(
        cinemaRepo.create({
          name: 'CGV Landmark 81',
          address: '772 Điện Biên Phủ, Phường 22, Bình Thạnh',
          city: 'TP. Hồ Chí Minh',
        }),
      );

      room1 = await roomRepo.save(
        roomRepo.create({
          name: 'Phòng 01 - IMAX Laser',
          cinemaId: cinema.id,
          totalSeats: 40,
        }),
      );

      await roomRepo.save(
        roomRepo.create({
          name: 'Phòng 02 - Gold Class',
          cinemaId: cinema.id,
          totalSeats: 0,
        }),
      );

      // Tạo ghế cho phòng 1 (4 hàng A-D, 10 ghế mỗi hàng)
      const seatsToInsert: Partial<Seat>[] = [];
      const rows = ['A', 'B', 'C', 'D'];
      for (const row of rows) {
        const isVip = row === 'C' || row === 'D';
        for (let col = 1; col <= 10; col++) {
          seatsToInsert.push({
            roomId: room1.id,
            row,
            column: col,
            seatNumber: `${row}${col}`,
            seatTypeId: types.find(
              (type) =>
                type.name === String(isVip ? SeatType.VIP : SeatType.REGULAR),
            )!.id,
          });
        }
      }
      await seatRepo.save(seatsToInsert);
      this.logger.log(
        `-> Đã tạo rạp '${cinema.name}', 2 phòng chiếu và 40 ghế mẫu`,
      );
    } else {
      room1 = (await roomRepo.findOne({ where: { cinemaId: cinema.id } }))!;
    }

    // 3. Tạo Phim mẫu
    const existingMovie = await movieRepo.findOne({
      where: { title: 'Dune: Part Two' },
    });
    let movieDune: Movie;

    if (!existingMovie) {
      movieDune = await movieRepo.save(
        movieRepo.create({
          title: 'Dune: Part Two',
          description:
            'Hành trình huyền thoại của Paul Atreides khi anh hợp nhất với Chani và Fremen để trả thù...',
          durationMinutes: 166,
          releaseDate: new Date('2026-03-01'),
          genres: genres.filter((genre) =>
            ['Khoa học viễn tưởng', 'Phiêu lưu'].includes(genre.name),
          ),
          director: 'Denis Villeneuve',
          cast: 'Timothée Chalamet, Zendaya, Rebecca Ferguson',
          posterUrl:
            'https://images.unsplash.com/photo-1534447677768-be436bb09401',
          trailerUrl: 'https://www.youtube.com/watch?v=Way9Dexny3w',
          status: MovieStatus.NOW_SHOWING,
          rating: 8.8,
        }),
      );

      await movieRepo.save(
        movieRepo.create({
          title: 'Oppenheimer',
          description:
            'Câu chuyện về nhà vật lý lý thuyết J. Robert Oppenheimer, cha đẻ của bom nguyên tử...',
          durationMinutes: 180,
          releaseDate: new Date('2026-02-15'),
          genres: genres.filter((genre) =>
            ['Tiểu sử', 'Lịch sử', 'Chính kịch'].includes(genre.name),
          ),
          director: 'Christopher Nolan',
          cast: 'Cillian Murphy, Emily Blunt, Matt Damon',
          posterUrl:
            'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba',
          trailerUrl: 'https://www.youtube.com/watch?v=uYPbbksJxIg',
          status: MovieStatus.NOW_SHOWING,
          rating: 8.9,
        }),
      );

      this.logger.log('-> Đã tạo 2 phim mẫu: Dune: Part Two & Oppenheimer');

      // 4. Tạo Suất chiếu mẫu
      if (room1) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(19, 0, 0, 0);

        const endTomorrow = new Date(tomorrow);
        endTomorrow.setHours(21, 46, 0, 0);

        await this.showtimesService.create({
          movieId: movieDune.id,
          roomId: room1.id,
          startTime: tomorrow.toISOString(),
          endTime: endTomorrow.toISOString(),
          basePrice: 100000,
        });
        this.logger.log('-> Đã tạo suất chiếu mẫu cho ngày mai');
      }
    }

    this.logger.log('✅ Khởi tạo Seed Data hoàn tất!');
  }
}