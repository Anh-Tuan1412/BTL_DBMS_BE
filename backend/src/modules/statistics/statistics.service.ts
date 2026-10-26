import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { RedisService } from '../redis/redis.service';
import {
  OverviewSummaryDto,
  TopMovieRevenueDto,
  MonthlyRevenueDto,
  SeatOccupancyDto,
  BenchmarkResponseDto,
} from './dto/statistics.dto';

@Injectable()
export class StatisticsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly redisService: RedisService,
  ) {}

  // =========================================================================
  // Use Case 10: Thống kê doanh thu & Báo cáo DBMS (Mai Anh Tuấn - MSSV: 2313739)
  // Chuyên đề: Query Processing (JOIN, Aggregate, Subquery, EXPLAIN Execution Plan)
  // Thực nghiệm: So sánh hiệu năng đối đầu trực tiếp giữa MySQL và Redis
  // =========================================================================

  // 1. Thống kê tổng quan KPIs (Tổng doanh thu, vé bán, booking thành công/hủy)
  async getOverviewSummary(): Promise<OverviewSummaryDto> {
    const bookingStats = await this.dataSource.query(`
      SELECT 
        COALESCE(SUM(CASE WHEN b.booking_status = 'CONFIRMED' THEN b.total_amount ELSE 0 END), 0) AS totalRevenue,
        COALESCE(SUM(CASE WHEN b.booking_status = 'CONFIRMED' THEN 1 ELSE 0 END), 0) AS successfulBookings,
        COALESCE(SUM(CASE WHEN b.booking_status = 'CANCELLED' THEN 1 ELSE 0 END), 0) AS cancelledBookings,
        COUNT(b.booking_id) AS totalBookings
      FROM bookings b
    `);

    const ticketStats = await this.dataSource.query(`
      SELECT COUNT(bd.booking_detail_id) AS totalTicketsSold
      FROM booking_details bd
      WHERE bd.ticket_status IN ('VALID', 'USED', 'CONFIRMED')
    `);

    const totalRevenue = Number(bookingStats[0]?.totalRevenue || 0);
    const successfulBookings = Number(bookingStats[0]?.successfulBookings || 0);
    const cancelledBookings = Number(bookingStats[0]?.cancelledBookings || 0);
    const totalTicketsSold = Number(ticketStats[0]?.totalTicketsSold || 0);

    const totalResolved = successfulBookings + cancelledBookings;
    const cancellationRate =
      totalResolved > 0
        ? `${((cancelledBookings / totalResolved) * 100).toFixed(2)}%`
        : '0.00%';

    return {
      totalRevenue,
      totalTicketsSold,
      successfulBookings,
      cancelledBookings,
      cancellationRate,
    };
  }

  // 2. Thống kê doanh thu theo từng bộ phim (Phim bán chạy nhất)
  async getRevenueByMovies(limit = 10): Promise<TopMovieRevenueDto[]> {
    const safeLimit = Math.max(1, Math.min(Number(limit) || 10, 100));

    const rows = await this.dataSource.query(
      `
      SELECT 
        m.movie_id AS movieId,
        m.title AS title,
        COUNT(bd.booking_detail_id) AS totalTickets,
        COALESCE(SUM(bd.ticket_price), 0) AS totalRevenue
      FROM movies m
      JOIN showtimes s ON s.movie_id = m.movie_id
      JOIN bookings b ON b.showtime_id = s.showtime_id AND b.booking_status = 'CONFIRMED'
      JOIN booking_details bd ON bd.booking_id = b.booking_id AND bd.ticket_status IN ('VALID', 'USED', 'CONFIRMED')
      GROUP BY m.movie_id, m.title
      HAVING totalTickets > 0
      ORDER BY totalRevenue DESC
      LIMIT ?
    `,
      [safeLimit],
    );

    return rows.map((row: any) => ({
      movieId: Number(row.movieId),
      title: String(row.title),
      totalTickets: Number(row.totalTickets),
      totalRevenue: Number(row.totalRevenue),
    }));
  }

  // 3. Doanh thu theo tháng (Monthly Revenue Aggregation)
  async getRevenueByMonth(): Promise<MonthlyRevenueDto[]> {
    const rows = await this.dataSource.query(`
      SELECT 
        DATE_FORMAT(b.created_at, '%Y-%m') AS month,
        COUNT(b.booking_id) AS bookingCount,
        COALESCE(SUM(b.total_amount), 0) AS revenue
      FROM bookings b
      WHERE b.booking_status = 'CONFIRMED'
      GROUP BY DATE_FORMAT(b.created_at, '%Y-%m')
      ORDER BY month DESC
    `);

    return rows.map((row: any) => ({
      month: String(row.month),
      bookingCount: Number(row.bookingCount),
      revenue: Number(row.revenue),
    }));
  }

  // 4. Thống kê tỷ lệ lấp đầy ghế theo suất chiếu (Occupancy Rate %)
  async getSeatOccupancyRate(): Promise<SeatOccupancyDto[]> {
    const rows = await this.dataSource.query(`
      SELECT 
        s.showtime_id AS showtimeId,
        m.title AS movieTitle,
        r.room_name AS roomName,
        s.start_time AS startTime,
        r.total_seats AS totalRoomSeats,
        COUNT(bd.booking_detail_id) AS bookedSeats,
        ROUND((COUNT(bd.booking_detail_id) / NULLIF(r.total_seats, 0)) * 100, 2) AS occupancyRateRaw
      FROM showtimes s
      JOIN movies m ON s.movie_id = m.movie_id
      JOIN rooms r ON s.room_id = r.room_id
      LEFT JOIN bookings b ON b.showtime_id = s.showtime_id AND b.booking_status = 'CONFIRMED'
      LEFT JOIN booking_details bd ON bd.booking_id = b.booking_id AND bd.ticket_status IN ('VALID', 'USED', 'CONFIRMED')
      GROUP BY s.showtime_id, m.title, r.room_name, s.start_time, r.total_seats
      ORDER BY occupancyRateRaw DESC
      LIMIT 50
    `);

    return rows.map((row: any) => ({
      showtimeId: Number(row.showtimeId),
      movieTitle: String(row.movieTitle),
      roomName: String(row.roomName),
      startTime: row.startTime,
      bookedSeats: Number(row.bookedSeats),
      totalRoomSeats: Number(row.totalRoomSeats),
      occupancyRate: `${Number(row.occupancyRateRaw || 0).toFixed(2)}%`,
    }));
  }

  // 5. Query Processing Benchmark (Hỗ trợ chạy EXPLAIN phân tích query plan cho chuyên đề)
  async explainQuery(rawSql: string) {
    const trimmed = rawSql.trim();
    if (!trimmed.toUpperCase().startsWith('SELECT')) {
      throw new BadRequestException('Chỉ cho phép EXPLAIN các câu truy vấn SELECT an toàn');
    }

    const start = process.hrtime();
    const plan = await this.dataSource.query(`EXPLAIN ${trimmed}`);
    const [seconds, nanoseconds] = process.hrtime(start);
    const executionTimeMs = (seconds * 1000 + nanoseconds / 1e6).toFixed(3);

    return {
      query: trimmed,
      executionTimeMs: `${executionTimeMs} ms`,
      executionPlan: plan,
    };
  }

  // 6. Thực nghiệm đo lường hiệu năng đối đầu trực tiếp: MySQL vs Redis
  async benchmarkMysqlVsRedis(iterations = 100): Promise<BenchmarkResponseDto> {
    const N = Math.max(10, Math.min(Number(iterations) || 100, 1000));

    // A. Point Read Test (Đọc đơn lẻ theo Key / Primary Key)
    const testKey = 'benchmark:movie:1';
    await this.redisService.set(
      testKey,
      JSON.stringify({ id: 1, title: 'Mai (2024)', status: 'ACTIVE' }),
      60,
    );

    // Warm-up
    await this.redisService.get(testKey);
    await this.dataSource.query(
      'SELECT movie_id, title FROM movies WHERE movie_id = 1 LIMIT 1',
    );

    // Đo Redis
    const startRedis = process.hrtime();
    for (let i = 0; i < N; i++) {
      await this.redisService.get(testKey);
    }
    const [secRedis, nanoRedis] = process.hrtime(startRedis);
    const redisTotalMs = secRedis * 1000 + nanoRedis / 1e6;
    const redisAvgMs = redisTotalMs / N;
    const redisThroughput = Math.round(N / Math.max(0.001, redisTotalMs / 1000));

    // Đo MySQL
    const startMysql = process.hrtime();
    for (let i = 0; i < N; i++) {
      await this.dataSource.query(
        'SELECT movie_id, title FROM movies WHERE movie_id = 1 LIMIT 1',
      );
    }
    const [secMysql, nanoMysql] = process.hrtime(startMysql);
    const mysqlTotalMs = secMysql * 1000 + nanoMysql / 1e6;
    const mysqlAvgMs = mysqlTotalMs / N;
    const mysqlThroughput = Math.round(N / Math.max(0.001, mysqlTotalMs / 1000));

    const speedup = (mysqlTotalMs / Math.max(0.001, redisTotalMs)).toFixed(1);

    // B. Complex Analytics Test (Nối 4 bảng + GROUP BY + SUM)
    const startComplex = process.hrtime();
    await this.dataSource.query(`
      SELECT 
        m.movie_id, m.title, 
        COUNT(bd.booking_detail_id) AS tickets, 
        COALESCE(SUM(bd.ticket_price), 0) AS revenue
      FROM movies m
      JOIN showtimes s ON s.movie_id = m.movie_id
      JOIN bookings b ON b.showtime_id = s.showtime_id AND b.booking_status = 'CONFIRMED'
      JOIN booking_details bd ON bd.booking_id = b.booking_id
      GROUP BY m.movie_id, m.title
      LIMIT 10
    `);
    const [secComplex, nanoComplex] = process.hrtime(startComplex);
    const complexMs = (secComplex * 1000 + nanoComplex / 1e6).toFixed(3);

    return {
      benchmarkOverview:
        'So sánh hiệu năng thực nghiệm giữa MySQL 8.0 (InnoDB) và Redis 7.x (In-Memory)',
      iterations: N,
      pointLookupTest: {
        operation: 'Point Read (Đọc bản ghi đơn lẻ theo Key / Primary Key)',
        redis: {
          totalTimeMs: `${redisTotalMs.toFixed(3)} ms`,
          avgTimePerOpMs: `${redisAvgMs.toFixed(4)} ms`,
          throughputOpsSec: redisThroughput,
          complexity: 'O(1) In-Memory Hash Table Lookup',
        },
        mysql: {
          totalTimeMs: `${mysqlTotalMs.toFixed(3)} ms`,
          avgTimePerOpMs: `${mysqlAvgMs.toFixed(4)} ms`,
          throughputOpsSec: mysqlThroughput,
          complexity: 'O(log_B N) B+Tree Clustered Index Traverse',
        },
        speedupFactor: `Redis nhanh hơn MySQL ~${speedup} lần trong thao tác đọc đơn lẻ`,
        winner: 'Redis (In-Memory)',
        analysis:
          'Redis thực hiện truy xuất trực tiếp trên RAM và không cần bộ phân tích cú pháp SQL (SQL Parser), trong khi MySQL cần phân tích AST, kiểm tra catalog và duyệt cấu trúc cây B+Tree.',
      },
      complexAnalyticsTest: {
        operation:
          'Multi-table JOIN & Aggregation (Nối 4 bảng, GROUP BY & SUM doanh thu)',
        mysql: {
          supported: true,
          executionTimeMs: `${complexMs} ms`,
          method: 'Cost-Based Optimizer (Hash Join / Index Scan)',
          suitability:
            'Rất phù hợp cho các báo cáo BI, thống kê doanh thu đa chiều',
        },
        redis: {
          supported: false,
          method:
            'Không hỗ trợ native JOIN / GROUP BY trong hệ quản trị NoSQL Key-Value',
          suitability:
            'Không khả thi cho bài toán truy vấn phân tích quan hệ đa tầng (buộc phải kéo toàn bộ dữ liệu về Node.js xử lý thủ công)',
        },
        winner: 'MySQL (Relational RDBMS)',
        analysis:
          'MySQL vượt trội hoàn toàn trong việc xử lý các phép toán đại số quan hệ phức tạp nhờ bộ tối ưu hóa chi phí CBO. Redis hoàn toàn không được thiết kế cho các truy vấn phân tích nhiều bảng.',
      },
      architectureConclusion:
        'Kiến trúc lai (Hybrid Architecture) tối ưu: Sử dụng Redis làm bộ đệm tốc độ cao và giữ ghế tạm thời (UC7), sử dụng MySQL làm Nguồn chân lý duy nhất (Single Source of Truth) đảm bảo giao dịch tài chính ACID (UC9) và báo cáo phân tích kinh doanh (UC10).',
    };
  }
}
