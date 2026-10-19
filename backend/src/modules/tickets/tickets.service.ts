import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Booking } from '../../database/entities/booking.entity';
import { Ticket } from '../../database/entities/ticket.entity';
import { BookingsService } from '../bookings/bookings.service';

@Injectable()
export class TicketsService {
  constructor(
    @InjectRepository(Booking)
    private readonly bookingRepository: Repository<Booking>,
    @InjectRepository(Ticket)
    private readonly ticketRepository: Repository<Ticket>,
    private readonly bookingsService: BookingsService,
  ) {}

  // 1. Xem lịch sử đặt vé của bản thân người dùng
  async getMyBookings(userId: number) {
    return this.bookingRepository.find({
      where: { userId },
      relations: {
        tickets: { seat: true },
        payments: true,
        showtime: { movie: true, room: { cinema: true } },
      },
      order: { createdAt: 'DESC' },
    });
  }

  // 2. Xem chi tiết vé theo mã đặt chỗ (bookingCode)
  async getBookingDetail(bookingCode: string, userId: number, isAdmin = false) {
    const booking = await this.bookingRepository.findOne({
      where: isAdmin ? { bookingCode } : { bookingCode, userId },
      relations: {
        tickets: { seat: true },
        payments: true,
        showtime: { movie: true, room: { cinema: true } },
      },
    });
    if (!booking) throw new NotFoundException('Không tìm thấy booking');
    return booking;
  }

  // 3. Hủy vé và hoàn tiền theo điều kiện quy định
  async cancelAndRefund(bookingCode: string, userId: number) {
    return this.bookingsService.cancelAndRefund(bookingCode, userId);
  }
}
