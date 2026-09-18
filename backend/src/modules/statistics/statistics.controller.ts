import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { StatisticsService } from './statistics.service';
import { JwtAuthGuard, RolesGuard } from '../../common/guards';
import { Roles } from '../../common/decorators';
import { UserRole } from '../../common/enums';

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
  getSummary() {
    return this.statisticsService.getOverviewSummary();
  }

  @Get('top-movies')
  @ApiOperation({
    summary: 'Thống kê các phim có doanh thu và số vé bán cao nhất',
  })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  getTopMovies(@Query('limit') limit?: string) {
    return this.statisticsService.getRevenueByMovies(
      limit ? Number(limit) : 10,
    );
  }

  @Get('monthly-revenue')
  @ApiOperation({ summary: 'Thống kê doanh thu theo từng tháng' })
  getMonthlyRevenue() {
    return this.statisticsService.getRevenueByMonth();
  }

  @Get('seat-occupancy')
  @ApiOperation({
    summary: 'Thống kê tỷ lệ lấp đầy ghế theo suất chiếu (Occupancy Rate %)',
  })
  getSeatOccupancy() {
    return this.statisticsService.getSeatOccupancyRate();
  }
}
