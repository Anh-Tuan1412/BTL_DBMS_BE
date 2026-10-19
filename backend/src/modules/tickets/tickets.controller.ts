import { Controller, Get, Post, Param, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { TicketsService } from './tickets.service';
import { JwtAuthGuard } from '../../common/guards';
import { CurrentUser } from '../../common/decorators';
import { User } from '../../database/entities/user.entity';
import { UserRole } from '../../common/enums';
import { CancelTicketResponseDto } from './dto/ticket.dto';

@ApiTags('Tickets - Quản lý vé & Hoàn hủy (UC9: Mai Anh Tuấn)')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('tickets')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Get('my-history')
  @ApiOperation({ summary: 'Xem lịch sử các vé/booking đã đặt của bản thân' })
  @ApiResponse({
    status: 200,
    description: 'Danh sách lịch sử đặt vé của người dùng kèm thông tin rạp, suất chiếu',
  })
  getMyBookings(@CurrentUser() user: User) {
    return this.ticketsService.getMyBookings(user.id);
  }

  @Get(':bookingCode')
  @ApiOperation({ summary: 'Xem chi tiết thông tin vé theo mã đặt chỗ' })
  @ApiParam({
    name: 'bookingCode',
    description: 'Mã đặt chỗ (ví dụ: BK-1728901234-A1B2)',
    example: 'BK-1728901234-A1B2',
  })
  @ApiResponse({
    status: 200,
    description: 'Chi tiết thông tin vé, rạp, phòng và ghế',
  })
  @ApiResponse({
    status: 404,
    description: 'Không tìm thấy booking hoặc không có quyền truy cập',
  })
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
  @ApiParam({
    name: 'bookingCode',
    description: 'Mã đặt chỗ cần hủy và hoàn tiền',
    example: 'BK-1728901234-A1B2',
  })
  @ApiResponse({
    status: 200,
    description: 'Hủy vé và kích hoạt hoàn tiền thành công',
    type: CancelTicketResponseDto,
  })
  @ApiResponse({
    status: 409,
    description:
      'Xung đột nghiệp vụ: Hủy vé quá muộn (< 60 phút) hoặc vé đã qua sử dụng',
  })
  @ApiResponse({
    status: 404,
    description: 'Không tìm thấy booking',
  })
  cancelAndRefund(
    @Param('bookingCode') bookingCode: string,
    @CurrentUser() user: User,
  ) {
    return this.ticketsService.cancelAndRefund(bookingCode, user.id);
  }
}
