import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';
import { StatisticsService } from './statistics.service';
import { JwtAuthGuard, RolesGuard } from '../../common/guards';
import { Roles } from '../../common/decorators';
import { UserRole } from '../../common/enums';
import {
  OverviewSummaryDto,
  TopMovieRevenueDto,
  MonthlyRevenueDto,
  SeatOccupancyDto,
  ExplainQueryDto,
  BenchmarkResponseDto,
} from './dto/statistics.dto';

@ApiTags(
  'Statistics - Thống kê doanh thu & Query Processing (UC10: Mai Anh Tuấn)',
)
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('statistics')
export class StatisticsController {
  constructor(private readonly statisticsService: StatisticsService) {}

  @Get('summary')
  @ApiOperation({
    summary:
      'Thống kê tổng quan KPIs (Tổng doanh thu, vé bán, booking thành công/hủy)',
  })
  @ApiResponse({
    status: 200,
    description: 'Chỉ số KPIs kinh doanh tổng quan',
    type: OverviewSummaryDto,
  })
  getSummary() {
    return this.statisticsService.getOverviewSummary();
  }

  @Get('top-movies')
  @ApiOperation({
    summary: 'Thống kê các phim có doanh thu và số vé bán cao nhất',
  })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  @ApiResponse({
    status: 200,
    description: 'Danh sách Top phim bán chạy nhất',
    type: [TopMovieRevenueDto],
  })
  getTopMovies(@Query('limit') limit?: string) {
    return this.statisticsService.getRevenueByMovies(
      limit ? Number(limit) : 10,
    );
  }

  @Get('monthly-revenue')
  @ApiOperation({ summary: 'Thống kê doanh thu theo từng tháng' })
  @ApiResponse({
    status: 200,
    description: 'Doanh thu gom nhóm theo tháng (YYYY-MM)',
    type: [MonthlyRevenueDto],
  })
  getMonthlyRevenue() {
    return this.statisticsService.getRevenueByMonth();
  }

  @Get('seat-occupancy')
  @ApiOperation({
    summary: 'Thống kê tỷ lệ lấp đầy ghế theo suất chiếu (Occupancy Rate %)',
  })
  @ApiResponse({
    status: 200,
    description: 'Tỷ lệ lấp đầy ghế của từng suất chiếu',
    type: [SeatOccupancyDto],
  })
  getSeatOccupancy() {
    return this.statisticsService.getSeatOccupancyRate();
  }

  @Post('explain')
  @ApiOperation({
    summary:
      'Phân tích kế hoạch thực thi EXPLAIN query (Chuyên đề Query Processing)',
  })
  @ApiResponse({
    status: 200,
    description:
      'Kế hoạch thực thi EXPLAIN và thời gian đáp ứng của câu truy vấn',
  })
  explainQuery(@Body() dto: ExplainQueryDto) {
    return this.statisticsService.explainQuery(dto.query);
  }

  @Get('benchmark/mysql-vs-redis')
  @ApiOperation({
    summary:
      'Thực nghiệm đo lường so sánh hiệu năng trực tiếp giữa MySQL và Redis (Point Read vs Complex Join)',
  })
  @ApiQuery({
    name: 'iterations',
    required: false,
    example: 100,
    description: 'Số lần lặp thử nghiệm (10 - 1000)',
  })
  @ApiResponse({
    status: 200,
    description:
      'Bảng số liệu so sánh thời gian thực thi, throughput và nhận xét kỹ thuật giữa MySQL và Redis',
    type: BenchmarkResponseDto,
  })
  benchmark(@Query('iterations') iterations?: string) {
    return this.statisticsService.benchmarkMysqlVsRedis(
      iterations ? Number(iterations) : 100,
    );
  }
}
