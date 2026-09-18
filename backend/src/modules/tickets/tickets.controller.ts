import { Controller, Get, Post, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TicketsService } from './tickets.service';
import { JwtAuthGuard } from '../../common/guards';
import { CurrentUser } from '../../common/decorators';
import { User } from '../../database/entities/user.entity';

import { UserRole } from '../../common/enums';

@ApiTags('Tickets - Quản lý vé & Hoàn hủy (UC9: Mai Anh Tuấn)')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('tickets')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Get('my-history')
  @ApiOperation({ summary: 'Xem lịch sử các vé/booking đã đặt của bản thân' })
  getMyBookings(@CurrentUser() user: User) {
    return this.ticketsService.getMyBookings(user.id);
  }

  @Get(':bookingCode')
  @ApiOperation({ summary: 'Xem chi tiết thông tin vé theo mã đặt chỗ' })
  getBookingDetail(
    @Param('bookingCode') bookingCode: string,
    @CurrentUser() user: User,
  ) {
    return this.ticketsService.getBookingDetail(
      bookingCode,
      user.id,
      user.role === UserRole.ADMIN,
    );
  }

  @Post(':bookingCode/cancel')
  @ApiOperation({
    summary: 'Hủy vé và hoàn tiền theo điều kiện (ít nhất trước 60 phút)',
    description:
      'Chỉ chấp nhận hủy nếu suất chiếu chưa bắt đầu và còn cách trên 60 phút',
  })
  cancelAndRefund(
    @Param('bookingCode') bookingCode: string,
    @CurrentUser() user: User,
  ) {
    return this.ticketsService.cancelAndRefund(bookingCode, user.id);
  }
}
