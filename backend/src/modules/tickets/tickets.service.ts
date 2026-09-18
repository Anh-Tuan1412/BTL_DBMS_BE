import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Booking } from '../../database/entities/booking.entity';
import { Ticket } from '../../database/entities/ticket.entity';

@Injectable()
export class TicketsService {
  constructor(
    @InjectRepository(Booking)
    private readonly bookingRepository: Repository<Booking>,
    @InjectRepository(Ticket)
    private readonly ticketRepository: Repository<Ticket>,
  ) {}

  // =========================================================================
  // TODO: Mai Anh Tuấn - Hiện thực UC9: Quản lý vé đã đặt & Hủy vé, hoàn tiền
  // =========================================================================

  // 1. Xem lịch sử đặt vé của bản thân người dùng
  async getMyBookings(userId: number) {
    // TODO: Tuấn viết logic truy vấn danh sách vé/đơn đặt chỗ của user này
    return {
      message: `TODO: Tuấn viết logic lấy lịch sử đặt vé của user ID ${userId}`,
      userId,
      data: [],
    };
  }

  // 2. Xem chi tiết vé theo mã đặt chỗ (bookingCode)
  async getBookingDetail(bookingCode: string, userId: number, isAdmin = false) {
    // TODO: Tuấn viết logic lấy chi tiết booking, bao gồm danh sách ghế và phim
    return {
      message: `TODO: Tuấn viết logic lấy chi tiết vé với mã ${bookingCode}`,
      bookingCode,
      userId,
      isAdmin,
    };
  }

  // 3. Hủy vé và hoàn tiền theo điều kiện quy định
  async cancelAndRefund(bookingCode: string, userId: number) {
    // TODO: Tuấn viết logic:
    // - Kiểm tra điều kiện: suất chiếu chưa bắt đầu và còn cách ít nhất 60 phút
    // - Cập nhật status booking sang CANCELLED, paymentStatus sang REFUNDED
    // - Cập nhật trạng thái các ticket sang REFUNDED
    return {
      message: `TODO: Tuấn viết logic hủy vé và hoàn tiền cho mã ${bookingCode}`,
      bookingCode,
      userId,
    };
  }
}
