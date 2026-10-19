import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  OverviewSummaryDto,
  TopMovieRevenueDto,
  MonthlyRevenueDto,
  SeatOccupancyDto,
} from './dto/statistics.dto';

@Injectable()
export class StatisticsService {
  constructor(private readonly dataSource: DataSource) {}

  // =========================================================================
  // Use Case 10: Thống kê doanh thu & Báo cáo DBMS (Mai Anh Tuấn - MSSV: 2313739)
  // Chuyên đề: Query Processing (JOIN, Aggregate, Subquery, EXPLAIN Execution Plan)
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
}
