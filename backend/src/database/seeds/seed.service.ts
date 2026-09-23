import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User, Movie, Cinema, CinemaRoom, Seat, Showtime } from '../entities';
import { UserRole, SeatType, MovieStatus } from '../../common/enums';

@Injectable()
export class SeedService {
  private readonly logger = new Logger(SeedService.name);

  constructor(private readonly dataSource: DataSource) {}

  async runSeed() {
    this.logger.log('Bắt đầu khởi tạo dữ liệu mẫu (Seed Data)...');

    const userRepo = this.dataSource.getRepository(User);
    const movieRepo = this.dataSource.getRepository(Movie);
    const cinemaRepo = this.dataSource.getRepository(Cinema);
    const roomRepo = this.dataSource.getRepository(CinemaRoom);
    const seatRepo = this.dataSource.getRepository(Seat);
    const showtimeRepo = this.dataSource.getRepository(Showtime);

    // 1. Tạo Users mẫu (Admin & Customer)
    const rawUsers = [
      {
        email: 'ha.quach@cinema.vn',
        fullName: 'Quách Văn Hà',
        phoneNumber: '0901234567',
        role: UserRole.ADMIN,
        rawPassword: 'HaQuach@Admin2026',
      },
      {
        email: 'long.nguyen@cinema.vn',
        fullName: 'Nguyễn Hoàng Long',
        phoneNumber: '0908889999',
        role: UserRole.ADMIN,
        rawPassword: 'LongNguyen@Admin88',
      },
      {
        email: 'nam.tran@cinema.vn',
        fullName: 'Trần Bảo Nam',
        phoneNumber: '0902223344',
        role: UserRole.ADMIN,
        rawPassword: 'BaoNam#Admin2026',
      },
      {
        email: 'thao.le@cinema.vn',
        fullName: 'Lê Phương Thảo',
        phoneNumber: '0903334455',
        role: UserRole.ADMIN,
        rawPassword: 'PhuongThao!Admin99',
      },
      {
        email: 'mai.tran@gmail.com',
        fullName: 'Trần Thị Mai',
        phoneNumber: '0981112233',
        role: UserRole.CUSTOMER,
        rawPassword: 'MaiTran@Pass123',
      },
      {
        email: 'duc.pham@gmail.com',
        fullName: 'Phạm Minh Đức',
        phoneNumber: '0982223344',
        role: UserRole.CUSTOMER,
        rawPassword: 'MinhDuc#Secure89',
      },
      {
        email: 'linh.vu@gmail.com',
        fullName: 'Vũ Thảo Linh',
        phoneNumber: '0983334455',
        role: UserRole.CUSTOMER,
        rawPassword: 'ThaoLinh@2026!',
      },
      {
        email: 'huy.dang@gmail.com',
        fullName: 'Đặng Quốc Huy',
        phoneNumber: '0984445566',
        role: UserRole.CUSTOMER,
        rawPassword: 'QuocHuy$9988',
      },
      {
        email: 'anh.bui@gmail.com',
        fullName: 'Bùi Ngọc Ánh',
        phoneNumber: '0985556677',
        role: UserRole.CUSTOMER,
        rawPassword: 'NgocAnh_Cinema@1',
      },
      {
        email: 'long.do@gmail.com',
        fullName: 'Đỗ Thành Long',
        phoneNumber: '0986667788',
        role: UserRole.CUSTOMER,
        rawPassword: 'ThanhLong#Pass77',
      },
      {
        email: 'my.ho@gmail.com',
        fullName: 'Hồ Diệu My',
        phoneNumber: '0987778899',
        role: UserRole.CUSTOMER,
        rawPassword: 'DieuMy@LoveMovie',
      },
      {
        email: 'khai.ngo@gmail.com',
        fullName: 'Ngô Quang Khải',
        phoneNumber: '0988889900',
        role: UserRole.CUSTOMER,
        rawPassword: 'KhaiNgo@Secret12',
      },
      {
        email: 'hang.duong@gmail.com',
        fullName: 'Dương Thúy Hằng',
        phoneNumber: '0989990011',
        role: UserRole.CUSTOMER,
        rawPassword: 'ThuyHang!Cinema26',
      },
      {
        email: 'bao.ly@gmail.com',
        fullName: 'Lý Gia Bảo',
        phoneNumber: '0971112233',
        role: UserRole.CUSTOMER,
        rawPassword: 'GiaBao$Fast2026',
      },
      {
        email: 'thu.phan@gmail.com',
        fullName: 'Phan Hoài Thu',
        phoneNumber: '0972223344',
        role: UserRole.CUSTOMER,
        rawPassword: 'HoaiThu@Movie2026',
      },
      {
        email: 'tung.trinh@gmail.com',
        fullName: 'Trịnh Thanh Tùng',
        phoneNumber: '0973334455',
        role: UserRole.CUSTOMER,
        rawPassword: 'ThanhTung#Pass99',
      },
      {
        email: 'quynh.vo@gmail.com',
        fullName: 'Võ Trúc Quỳnh',
        phoneNumber: '0974445566',
        role: UserRole.CUSTOMER,
        rawPassword: 'TrucQuynh$Cinema8',
      },
      {
        email: 'bach.mai@gmail.com',
        fullName: 'Mai Xuân Bách',
        phoneNumber: '0975556677',
        role: UserRole.CUSTOMER,
        rawPassword: 'XuanBach@Pro2026',
      },
      {
        email: 'tuan.ta@gmail.com',
        fullName: 'Tạ Minh Tuấn',
        phoneNumber: '0976667788',
        role: UserRole.CUSTOMER,
        rawPassword: 'MinhTuan#Cinema01',
      },
      {
        email: 'ngan.kim@gmail.com',
        fullName: 'Kim Thúy Ngân',
        phoneNumber: '0977778899',
        role: UserRole.CUSTOMER,
        rawPassword: 'ThuyNgan@Pass2026',
      },
    ];

    for (const u of rawUsers) {

      const exists = await userRepo.findOne({ where: { email: u.email } });
      
      if (!exists) {
        const hashedPassword = await bcrypt.hash(u.rawPassword, 10);
        await userRepo.save(
          userRepo.create({
            email: u.email,
            fullName: u.fullName,
            phoneNumber: u.phoneNumber,
            role: u.role,
            password: hashedPassword,
          }),
        );
        this.logger.log(`-> Đã thêm mới user: ${u.email}`);
      }
    }

    // 2. Tạo Rạp & Phòng chiếu mẫu
    const cinemaConfigs = [
      // 2.1. CGV Landmark 81 (TP.HCM)
      {
        name: 'CGV Landmark 81',
        address: '772 Điện Biên Phủ, Phường 22, Bình Thạnh',
        city: 'TP. Hồ Chí Minh',
        rooms: [
          { name: 'Phòng 01 - IMAX Laser', rows: ['A', 'B', 'C', 'D'], cols: 10 }, // 40 ghế
          { name: 'Phòng 02 - Gold Class', rows: ['A', 'B', 'C'], cols: 10 },       // 30 ghế
        ],
      },
      // 2.2. Galaxy Sala (TP.HCM)
      {
        name: 'Galaxy Sala',
        address: 'Tầng 3 Thiso Mall Sala, 10 Mai Chí Thọ, Thủ Đức',
        city: 'TP. Hồ Chí Minh',
        rooms: [
          { name: 'Phòng 01 - IMAX', rows: ['A', 'B', 'C', 'D'], cols: 10 },         // 40 ghế
          { name: 'Phòng 02 - Atmos', rows: ['A', 'B', 'C', 'D'], cols: 10 },        // 40 ghế
        ],
      },
      // 2.3. Lotte Cinema Gò Vấp (TP.HCM)
      {
        name: 'Lotte Cinema Gò Vấp',
        address: 'Tầng 4 Lotte Mart, 242 Nguyễn Văn Lượng, Gò Vấp',
        city: 'TP. Hồ Chí Minh',
        rooms: [
          { name: 'Phòng 01 - Super Plex', rows: ['A', 'B', 'C', 'D'], cols: 10 },   // 40 ghế
          { name: 'Phòng 02 - Standard 2D', rows: ['A', 'B', 'C'], cols: 10 },       // 30 ghế
        ],
      },
      // 2.4. BHD Star Cầu Giấy (Hà Nội)
      {
        name: 'BHD Star Cầu Giấy',
        address: 'Tầng 8 Discovery Complex, 302 Cầu Giấy',
        city: 'Hà Nội',
        rooms: [
          { name: 'Phòng 01 - First Class', rows: ['A', 'B', 'C'], cols: 10 },       // 30 ghế
          { name: 'Phòng 02 - Digital 2D', rows: ['A', 'B', 'C'], cols: 10 },        // 30 ghế
        ],
      },
    ];

    let newCinemasCount = 0;
    let newRoomsCount = 0;

    for (const config of cinemaConfigs) {
      // Tầng 1: Tìm hoặc tạo Cụm rạp
      let cinema = await cinemaRepo.findOne({
        where: { name: config.name },
      });

      if (!cinema) {
        cinema = await cinemaRepo.save(
          cinemaRepo.create({
            name: config.name,
            address: config.address,
            city: config.city,
          }),
        );
        newCinemasCount++;
        this.logger.log(`-> Tạo mới rạp: ${config.name}`);
      }

      // Tầng 2: Kiểm tra từng Phòng chiếu bên trong Rạp đó
      for (const roomData of config.rooms) {
        let room = await roomRepo.findOne({
          where: {
            name: roomData.name,
            cinemaId: cinema.id,
          },
        });

        // Nếu phòng này chưa tồn tại trong rạp -> Tạo phòng và sinh ghế tương ứng
        if (!room) {
          const totalSeatsCount = roomData.rows.length * roomData.cols;
          room = await roomRepo.save(
            roomRepo.create({
              name: roomData.name,
              cinemaId: cinema.id,
              totalSeats: totalSeatsCount,
            }),
          );
          newRoomsCount++;

          // Tầng 3: Tự động sinh sơ đồ ghế cho phòng mới
          const seatsToInsert: Partial<Seat>[] = [];
          for (const row of roomData.rows) {
            // Hàng C và D là ghế VIP (hệ số giá 1.25), hàng A và B là ghế thường (1.0)
            const isVip = row === 'C' || row === 'D';
            for (let col = 1; col <= roomData.cols; col++) {
              seatsToInsert.push({
                roomId: room.id,
                row,
                column: col,
                seatNumber: `${row}${col}`,
                type: isVip ? SeatType.VIP : SeatType.REGULAR,
                priceMultiplier: isVip ? 1.25 : 1.0,
              });
            }
          }
          await seatRepo.save(seatsToInsert);
          this.logger.log(`   + Tạo '${room.name}' (${config.name}) kèm ${seatsToInsert.length} ghế`);
        }
      }
    }

    if (newCinemasCount > 0 || newRoomsCount > 0) {
      this.logger.log(
        `-> Hoàn tất nạp dữ liệu: +${newCinemasCount} rạp mới, +${newRoomsCount} phòng chiếu mới.`,
      );
    } else {
      this.logger.log('-> Toàn bộ rạp và phòng chiếu đã tồn tại đầy đủ, bỏ qua.');
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
          genre: 'Khoa học viễn tưởng, Phiêu lưu',
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
          genre: 'Tiểu sử, Lịch sử, Chính kịch',
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

      /* 4. Tạo Suất chiếu mẫu
      if (room1) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(19, 0, 0, 0);

        const endTomorrow = new Date(tomorrow);
        endTomorrow.setHours(21, 46, 0, 0);

        await showtimeRepo.save([
          showtimeRepo.create({
            movieId: movieDune.id,
            roomId: room1.id,
            startTime: tomorrow,
            endTime: endTomorrow,
            basePrice: 100000,
          }),
        ]);
        this.logger.log('-> Đã tạo suất chiếu mẫu cho ngày mai');
      }
      */
    }

    this.logger.log('✅ Khởi tạo Seed Data hoàn tất!');
  }
}
