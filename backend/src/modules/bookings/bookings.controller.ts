import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { BookingsService } from './bookings.service';
import {
  HoldSeatDto,
  ReleaseSeatDto,
  CreateBookingDto,
  MockStripePaymentDto,
} from './dto/booking.dto';
import { JwtAuthGuard } from '../../common/guards';
import { CurrentUser } from '../../common/decorators';
import { User } from '../../database/entities/user.entity';

@ApiTags('Bookings - Giữ ghế Redis & Đặt vé Stripe (UC7 & UC8: Định)')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post('hold-seat')
  @ApiOperation({
    summary: 'UC7: Giữ ghế tạm thời bằng Redis TTL (5 phút)',
    description:
      'Khóa nguyên tử bằng Redis SET NX EX, ngăn các user khác chọn cùng một ghế',
  })
  holdSeat(@CurrentUser() user: User, @Body() dto: HoldSeatDto) {
    return this.bookingsService.holdSeat(user.id, dto);
  }

  @Post('release-seat')
  @ApiOperation({ summary: 'Giải phóng ghế tạm thời khi user hủy chọn' })
  releaseSeat(@CurrentUser() user: User, @Body() dto: ReleaseSeatDto) {
    return this.bookingsService.releaseSeat(user.id, dto);
  }

  @Post('create')
  @ApiOperation({
    summary: 'UC8: Tạo đơn đặt vé (MySQL Serializable Transaction)',
    description: 'Chạy transaction kiểm tra và tạo Booking + Tickets an toàn',
  })
  createBooking(@CurrentUser() user: User, @Body() dto: CreateBookingDto) {
    return this.bookingsService.createBooking(user.id, dto);
  }

  @Post('pay-mock')
  @ApiOperation({
    summary: 'UC8: Thanh toán qua Stripe Test Mode (Mô phỏng)',
    description:
      'Xác nhận thanh toán, chuyển status sang CONFIRMED và giải phóng lock Redis',
  })
  mockPayment(@CurrentUser() user: User, @Body() dto: MockStripePaymentDto) {
    return this.bookingsService.mockStripePayment(user.id, dto);
  }
}
