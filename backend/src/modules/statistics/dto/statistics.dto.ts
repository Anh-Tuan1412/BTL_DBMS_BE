import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class OverviewSummaryDto {
  @ApiProperty({ example: 485000000.0, description: 'Tổng doanh thu ròng (VND)' })
  totalRevenue: number;

  @ApiProperty({ example: 5240, description: 'Tổng số vé bán ra thành công' })
  totalTicketsSold: number;

  @ApiProperty({ example: 2180, description: 'Số lượng đơn đặt vé thành công' })
  successfulBookings: number;

  @ApiProperty({ example: 85, description: 'Số lượng đơn đặt vé bị hủy' })
  cancelledBookings: number;

  @ApiProperty({ example: '3.75%', description: 'Tỷ lệ hủy vé (%)' })
  cancellationRate: string;
}

export class TopMovieRevenueDto {
  @ApiProperty({ example: 1, description: 'ID phim' })
  movieId: number;

  @ApiProperty({ example: 'Mai (2024)', description: 'Tên bộ phim' })
  title: string;

  @ApiProperty({ example: 2450, description: 'Tổng số vé bán được của phim' })
  totalTickets: number;

  @ApiProperty({ example: 225000000.0, description: 'Tổng doanh thu phim mang lại (VND)' })
  totalRevenue: number;
}

export class MonthlyRevenueDto {
  @ApiProperty({ example: '2026-10', description: 'Tháng thống kê (YYYY-MM)' })
  month: string;

  @ApiProperty({ example: 835, description: 'Tổng số đơn booking trong tháng' })
  bookingCount: number;

  @ApiProperty({ example: 168000000.0, description: 'Doanh thu trong tháng (VND)' })
  revenue: number;
}

export class SeatOccupancyDto {
  @ApiProperty({ example: 101, description: 'ID suất chiếu' })
  showtimeId: number;

  @ApiProperty({ example: 'Mai (2024)', description: 'Tên phim' })
  movieTitle: string;

  @ApiProperty({ example: 'Cinema 1 (IMAX)', description: 'Tên phòng chiếu' })
  roomName: string;

  @ApiProperty({ example: '2026-10-15T19:00:00.000Z', description: 'Thời gian bắt đầu suất chiếu' })
  startTime: Date;

  @ApiProperty({ example: 48, description: 'Số ghế đã được đặt/bán' })
  bookedSeats: number;

  @ApiProperty({ example: 50, description: 'Tổng sức chứa ghế của phòng chiếu' })
  totalRoomSeats: number;

  @ApiProperty({ example: '96.00%', description: 'Tỷ lệ lấp đầy ghế (%)' })
  occupancyRate: string;
}

export class ExplainQueryDto {
  @ApiProperty({
    example: 'SELECT * FROM bookings WHERE booking_status = "CONFIRMED"',
    description: 'Câu lệnh SQL cần phân tích kế hoạch thực thi (EXPLAIN plan)',
  })
  @IsString()
  @IsNotEmpty()
  query: string;
}
