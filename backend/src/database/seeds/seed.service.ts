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
    const sampleMovies = [
      {
        title: 'Dune: Part Two',
        description:
          'Hành trình huyền thoại của Paul Atreides khi anh hợp nhất với Chani và người Fremen để trả thù những kẻ đã hủy diệt gia tộc mình.',
        durationMinutes: 166,
        releaseDate: new Date('2024-03-01'),
        genre: 'Khoa học viễn tưởng, Phiêu lưu',
        director: 'Denis Villeneuve',
        cast: 'Timothée Chalamet, Zendaya, Rebecca Ferguson',
        posterUrl: 'https://image.tmdb.org/t/p/original/1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg',
        trailerUrl: 'https://www.youtube.com/watch?v=Way9Dexny3w',
        status: MovieStatus.NOW_SHOWING,
        rating: 8.5,
      },
      {
        title: 'Oppenheimer',
        description:
          'Câu chuyện kịch tính về cuộc đời và sự dằn vặt đạo đức của J. Robert Oppenheimer trong dự án Manhattan chế tạo bom nguyên tử đầu tiên.',
        durationMinutes: 180,
        releaseDate: new Date('2023-07-21'),
        genre: 'Tiểu sử, Lịch sử, Chính kịch',
        director: 'Christopher Nolan',
        cast: 'Cillian Murphy, Emily Blunt, Matt Damon, Robert Downey Jr.',
        posterUrl: 'https://image.tmdb.org/t/p/original/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg',
        trailerUrl: 'https://www.youtube.com/watch?v=uYPbbksJxIg',
        status: MovieStatus.NOW_SHOWING,
        rating: 8.9,
      },
      {
        title: 'Interstellar',
        description:
          'Một nhóm phi hành gia du hành qua một hố sâu bí ẩn ngoài không gian nhằm tìm kiếm hành tinh mới có thể duy trì sự sống cho nhân loại.',
        durationMinutes: 169,
        releaseDate: new Date('2014-11-07'),
        genre: 'Khoa học viễn tưởng, Phiêu lưu',
        director: 'Christopher Nolan',
        cast: 'Matthew McConaughey, Anne Hathaway, Jessica Chastain',
        posterUrl: 'https://image.tmdb.org/t/p/original/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg',
        trailerUrl: 'https://www.youtube.com/watch?v=zSWdZVtXT7E',
        status: MovieStatus.NOW_SHOWING,
        rating: 8.7,
      },
      {
        title: 'Deadpool & Wolverine',
        description:
          'Wade Wilson tái xuất giang hồ và buộc phải kéo Wolverine ra khỏi cơn khủng hoảng nhằm bảo vệ dòng thời gian quê hương khỏi diệt vong.',
        durationMinutes: 128,
        releaseDate: new Date('2024-07-26'),
        genre: 'Hành động, Hài hước, Siêu anh hùng',
        director: 'Shawn Levy',
        cast: 'Ryan Reynolds, Hugh Jackman, Emma Corrin',
        posterUrl: 'https://image.tmdb.org/t/p/original/8cdWjvZQUExUUTzyp4t6EDMubfO.jpg',
        trailerUrl: 'https://www.youtube.com/watch?v=73_1biulkYk',
        status: MovieStatus.NOW_SHOWING,
        rating: 7.8,
      },
      {
        title: 'Godzilla x Kong: The New Empire',
        description:
          'Hai thế lực quái thú hùng mạnh nhất lịch sử buộc phải bắt tay để chống lại một mối hiểm họa tiềm ẩn từ sâu trong Lòng Đất Rỗng.',
        durationMinutes: 115,
        releaseDate: new Date('2024-03-29'),
        genre: 'Hành động, Quái thú, Giả tưởng',
        director: 'Adam Wingard',
        cast: 'Rebecca Hall, Brian Tyree Henry, Dan Stevens',
        posterUrl: 'https://image.tmdb.org/t/p/original/tMefBSflR6PGQLv7WvFPpKLZkyk.jpg',
        trailerUrl: 'https://www.youtube.com/watch?v=1qjV_cc7pVM',
        status: MovieStatus.NOW_SHOWING,
        rating: 7.2,
      },
      {
        title: 'Inside Out 2',
        description:
          'Khi cô bé Riley bước vào tuổi dậy thì, trụ sở cảm xúc trong tâm trí bất ngờ đón nhận những cảm xúc mới nổi loạn, dẫn đầu là Anxiety.',
        durationMinutes: 96,
        releaseDate: new Date('2024-06-14'),
        genre: 'Hoạt hình, Gia đình, Hài kịch',
        director: 'Kelsey Mann',
        cast: 'Amy Poehler, Maya Hawke, Phyllis Smith',
        posterUrl: 'https://image.tmdb.org/t/p/original/vpnVM9B6NMmQpWeZvzLvDESb2QY.jpg',
        trailerUrl: 'https://www.youtube.com/watch?v=mg50EkStx-s',
        status: MovieStatus.NOW_SHOWING,
        rating: 7.9,
      },
      {
        title: 'Spider-Man: Across the Spider-Verse',
        description:
          'Miles Morales bước vào chuyến phiêu lưu xuyên qua đa vũ trụ nhện và phải đưa ra lựa chọn định mệnh giữa người mình yêu và trách nhiệm.',
        durationMinutes: 140,
        releaseDate: new Date('2023-06-02'),
        genre: 'Hoạt hình, Hành động, Viễn tưởng',
        director: 'Joaquim Dos Santos, Kemp Powers',
        cast: 'Shameik Moore, Hailee Steinfeld, Oscar Isaac',
        posterUrl: 'https://image.tmdb.org/t/p/original/8Vt6mWEReuy4Of61Lnj5Xj704m8.jpg',
        trailerUrl: 'https://www.youtube.com/watch?v=cqGjhVJWtEg',
        status: MovieStatus.NOW_SHOWING,
        rating: 8.7,
      },
      {
        title: 'Kung Fu Panda 4',
        description:
          'Po chuẩn bị tiếp nhận vai trò Thủ lĩnh tinh thần của Thung lũng Hòa Bình nhưng phải đối đầu với phù thủy Tắc Kè Bông biến hình nguy hiểm.',
        durationMinutes: 94,
        releaseDate: new Date('2024-03-08'),
        genre: 'Hoạt hình, Hành động, Hài hước',
        director: 'Mike Mitchell',
        cast: 'Jack Black, Awkwafina, Viola Davis',
        posterUrl: 'https://image.tmdb.org/t/p/original/kDp1vUBnMpe8ak4rjgl3cLELqjU.jpg',
        trailerUrl: 'https://www.youtube.com/watch?v=xCVBU07uGf4',
        status: MovieStatus.NOW_SHOWING,
        rating: 7.1,
      },
      {
        title: 'Avatar: Fire and Ash',
        description:
          'Chương thứ ba tái hiện thế giới Pandora kỳ vĩ, đưa gia đình Jake Sully chạm trán với Tộc Tro tàn (Ash People) tàn bạo và hiếu chiến.',
        durationMinutes: 190,
        releaseDate: new Date('2025-12-19'),
        genre: 'Khoa học viễn tưởng, Phiêu lưu, Hành động',
        director: 'James Cameron',
        cast: 'Sam Worthington, Zoe Saldana, Sigourney Weaver',
        posterUrl: 'https://image.tmdb.org/t/p/original/t6HIqrRAclMCA60NsSmeqe9RmNV.jpg',
        trailerUrl: 'https://www.youtube.com/watch?v=Eb2TjJr21Nk',
        status: MovieStatus.COMING_SOON,
        rating: 0.0,
      },
      {
        title: 'Captain America: Brave New World',
        description:
          'Sam Wilson chính thức gánh vác chiếc khiên Captain America trong một cuộc khủng hoảng quốc tế mới liên quan đến tổng thống Thaddeus Ross.',
        durationMinutes: 125,
        releaseDate: new Date('2025-02-14'),
        genre: 'Hành động, Giật gân, Siêu anh hùng',
        director: 'Julius Onah',
        cast: 'Anthony Mackie, Harrison Ford, Danny Ramirez',
        posterUrl: 'https://theposterdb.com/api/assets/595571/view',
        trailerUrl: 'https://www.youtube.com/watch?v=FEa9pPqGhPY',
        status: MovieStatus.COMING_SOON,
        rating: 0.0,
      },
    ];

    let newMoviesCount = 0;
    for (const movieData of sampleMovies) {
      const existingMovie = await movieRepo.findOne({
        where: { title: movieData.title },
      });

      if (!existingMovie) {
        await movieRepo.save(movieRepo.create(movieData));
        newMoviesCount++;
      }
    }

    if (newMoviesCount > 0) {
      this.logger.log(`-> Đã nạp thêm ${newMoviesCount} phim mới vào cơ sở dữ liệu.`);
    } else {
      this.logger.log('-> Toàn bộ phim mẫu đã tồn tại trong database, bỏ qua.');
    }

      // 4. Tạo Suất chiếu mẫu
      // 4.1. Lấy danh sách các phim đang chiếu và các phòng chiếu hiện có
    const nowShowingMovies = await movieRepo.find({
      where: { status: MovieStatus.NOW_SHOWING },
    });

    const allRooms = await roomRepo.find();

    if (nowShowingMovies.length > 0 && allRooms.length > 0) {
      // Hàm tiện ích: Tạo mốc thời gian chuẩn (ngày + giờ:phút)
      const buildScheduleDate = (daysFromNow: number, hours: number, minutes: number) => {
        const date = new Date();
        date.setDate(date.getDate() + daysFromNow);
        date.setHours(hours, minutes, 0, 0);
        return date;
      };

      // 4.2. Cấu hình danh sách 8 suất chiếu mẫu
      // Phân bổ các phim hot (Dune, Oppenheimer, Deadpool, Inside Out 2) vào các phòng khác nhau
      const showtimeConfigs = [
        // --- HÔM NAY (daysFromNow = 0) ---
        {
          movieTitle: 'Dune: Part Two',
          roomIndex: 0, // Phòng 01 - IMAX Laser (CGV Landmark 81)
          daysFromNow: 0,
          hour: 18,
          minute: 30,
          basePrice: 120000,
        },
        {
          movieTitle: 'Inside Out 2',
          roomIndex: 1, // Phòng 02 - Gold Class (CGV Landmark 81)
          daysFromNow: 0,
          hour: 19,
          minute: 0,
          basePrice: 100000,
        },
        {
          movieTitle: 'Deadpool & Wolverine',
          roomIndex: 2, // Phòng 01 - IMAX (Galaxy Sala)
          daysFromNow: 0,
          hour: 20,
          minute: 0,
          basePrice: 110000,
        },

        // --- NGÀY MAI (daysFromNow = 1) ---
        {
          movieTitle: 'Dune: Part Two',
          roomIndex: 0,
          daysFromNow: 1,
          hour: 14,
          minute: 0,
          basePrice: 100000,
        },
        {
          movieTitle: 'Oppenheimer',
          roomIndex: 0,
          daysFromNow: 1,
          hour: 18,
          minute: 0,
          basePrice: 120000,
        },
        {
          movieTitle: 'Spider-Man: Across the Spider-Verse',
          roomIndex: 2,
          daysFromNow: 1,
          hour: 16,
          minute: 30,
          basePrice: 95000,
        },
        {
          movieTitle: 'Godzilla x Kong: The New Empire',
          roomIndex: 4, // Phòng 01 - Super Plex (Lotte Gò Vấp)
          daysFromNow: 1,
          hour: 19,
          minute: 30,
          basePrice: 105000,
        },
        {
          movieTitle: 'Kung Fu Panda 4',
          roomIndex: 6, // Phòng 01 - First Class (BHD Cầu Giấy)
          daysFromNow: 1,
          hour: 17,
          minute: 0,
          basePrice: 90000,
        },
      ];

      let newShowtimesCount = 0;

      for (const config of showtimeConfigs) {
        const targetMovie = nowShowingMovies.find((m) => m.title === config.movieTitle);
        const targetRoom = allRooms[config.roomIndex] || allRooms[0];

        if (targetMovie && targetRoom) {
          const startTime = buildScheduleDate(config.daysFromNow, config.hour, config.minute);

          // Tự động tính endTime = startTime + durationMinutes (cộng thêm 10 phút nghỉ chuyển suất)
          const endTime = new Date(startTime.getTime() + (targetMovie.durationMinutes + 10) * 60 * 1000);

          // Kiểm tra xem phòng đó vào đúng thời điểm đó đã có suất chiếu chưa
          const existingShowtime = await showtimeRepo.findOne({
            where: {
              roomId: targetRoom.id,
              startTime: startTime,
            },
          });

          if (!existingShowtime) {
            await showtimeRepo.save(
              showtimeRepo.create({
                movieId: targetMovie.id,
                roomId: targetRoom.id,
                startTime,
                endTime,
                basePrice: config.basePrice,
              }),
            );
            newShowtimesCount++;
          }
        }
      }

      if (newShowtimesCount > 0) {
        this.logger.log(`-> Đã nạp thành công ${newShowtimesCount} suất chiếu mẫu mới.`);
      } else {
        this.logger.log('-> Toàn bộ suất chiếu mẫu đã tồn tại, bỏ qua.');
      }
    }

    this.logger.log('✅ Khởi tạo Seed Data hoàn tất!');
  }
}
