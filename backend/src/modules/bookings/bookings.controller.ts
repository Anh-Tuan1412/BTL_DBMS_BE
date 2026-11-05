import { StripePaymentsService } from './stripe-payments.service';
import { StripeBookingDto } from './dto/booking.dto';
import { Get, Param, Req, Headers, BadRequestException } from '@nestjs/common';
import type { Request } from 'express';
import type { RawBodyRequest } from '@nestjs/common';
import { Public } from '../../common/decorators';
import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
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

@ApiTags('Bookings - Giữ ghế Redis & Thanh toán Stripe (UC7 & UC8: Định)')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('bookings')
export class BookingsController {
  constructor(
    private readonly bookingsService: BookingsService,
    private readonly stripePayments: StripePaymentsService,
  ) {}

  @Post('hold-seat')
  @ApiOperation({
    summary: 'UC7: Giữ ghế tạm thời bằng Redis TTL (5 phút)',
    description:
      'Khóa nguyên tử bằng Redis SET NX EX 300s, ngăn chặn user khác chọn cùng một ghế tại cùng một thời điểm.',
  })
  @ApiResponse({ status: 201, description: 'Giữ ghế thành công trong 5 phút' })
  @ApiResponse({
    status: 409,
    description: 'Ghế đã có người giữ hoặc đã được mua',
  })
  holdSeat(@CurrentUser() user: User, @Body() dto: HoldSeatDto) {
    return this.bookingsService.holdSeat(user.id, dto);
  }

  @Post('release-seat')
  @ApiOperation({
    summary: 'UC7: Giải phóng ghế tạm thời khi user chủ động hủy chọn',
  })
  releaseSeat(@CurrentUser() user: User, @Body() dto: ReleaseSeatDto) {
    return this.bookingsService.releaseSeat(user.id, dto);
  }

  @Post('create')
  @ApiOperation({
    summary: 'UC8: Tạo đơn đặt vé (MySQL ACID Transaction)',
    description:
      'Chạy Database Transaction kiểm tra ghế và tạo Booking + Tickets với trạng thái PENDING.',
  })
  createBooking(@CurrentUser() user: User, @Body() dto: CreateBookingDto) {
    return this.bookingsService.createBooking(user.id, dto);
  }

  @Post('pay-mock')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'UC8: Thanh toán mô phỏng nội bộ (chưa gọi Stripe)',
    description:
      'Xác nhận thanh toán, chuyển status sang CONFIRMED, vé thành VALID và giải phóng khóa Redis.',
  })
  mockPayment(@CurrentUser() user: User, @Body() dto: MockStripePaymentDto) {
    return this.bookingsService.mockStripePayment(user.id, dto);
  }

  @Post('stripe/checkout')
  @ApiOperation({ summary: 'Tạo Stripe Checkout Test Mode' })
  checkout(@CurrentUser() user: User, @Body() dto: StripeBookingDto) {
    return this.stripePayments.checkout(dto.bookingCode, user.id);
  }
  @Get('stripe/status/:bookingCode')
  @ApiOperation({ summary: 'Đối chiếu kết quả thanh toán với Stripe' })
  stripeStatus(@CurrentUser() user: User, @Param('bookingCode') code: string) {
    return this.stripePayments.status(code, user.id);
  }
  @Public()
  @Post('stripe/webhook')
  @HttpCode(HttpStatus.OK)
  webhook(
    @Req() request: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    if (!request.rawBody || !signature)
      throw new BadRequestException('Thiếu Stripe webhook signature');
    return this.stripePayments.webhook(request.rawBody, signature);
  }
}
