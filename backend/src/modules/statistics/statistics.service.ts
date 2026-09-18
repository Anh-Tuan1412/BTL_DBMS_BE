import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class StatisticsService {
  constructor(private readonly dataSource: DataSource) {}

  // =========================================================================
  // TODO: Mai Anh Tuấn - Hiện thực UC10: Thống kê doanh thu & Báo cáo DBMS
  // Nghiên cứu Query Processing (JOIN, Aggregate, Subquery, EXPLAIN plan)
  // =========================================================================

  // 1. Thống kê tổng quan KPIs (Tổng doanh thu, vé bán, booking thành công/hủy)
  async getOverviewSummary() {
    // TODO: Tuấn viết câu truy vấn tổng hợp KPIs (Aggregate: SUM, COUNT...)
    return {
      message: 'TODO: Tuấn viết truy vấn thống kê tổng quan KPIs',
      totalRevenue: 0,
      totalTicketsSold: 0,
      successfulBookings: 0,
      cancelledBookings: 0,
    };
  }

  // 2. Thống kê doanh thu theo từng bộ phim (Phim bán chạy nhất)
  async getRevenueByMovies(limit = 10) {
    // TODO: Tuấn viết truy vấn JOIN giữa movies, showtimes, bookings, tickets + GROUP BY + SUM
    return {
      message: 'TODO: Tuấn viết truy vấn thống kê top phim bán chạy',
      limit,
      data: [],
    };
  }

  // 3. Doanh thu theo ngày/tháng
  async getRevenueByMonth() {
    // TODO: Tuấn viết truy vấn nhóm theo DATE_FORMAT(createdAt, '%Y-%m')
    return {
      message: 'TODO: Tuấn viết truy vấn doanh thu theo tháng',
      data: [],
    };
  }

  // 4. Thống kê tỷ lệ lấp đầy ghế theo suất chiếu (Occupancy Rate %)
  async getSeatOccupancyRate() {
    // TODO: Tuấn viết truy vấn tính tỉ lệ số ghế bán được / tổng số ghế của phòng chiếu
    return {
      message: 'TODO: Tuấn viết truy vấn tỉ lệ lấp đầy ghế',
      data: [],
    };
  }

  // 5. Query Processing Benchmark (Hỗ trợ chạy EXPLAIN phân tích query plan cho báo cáo)
  async explainQuery(rawSql: string) {
    // TODO: Chạy EXPLAIN cho rawSql và đo lường thời gian thực thi
    return this.dataSource.query(`EXPLAIN ${rawSql}`);
  }
}
