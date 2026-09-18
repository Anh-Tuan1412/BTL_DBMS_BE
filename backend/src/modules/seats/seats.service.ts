import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Seat } from '../../database/entities/seat.entity';
import { Showtime } from '../../database/entities/showtime.entity';
import { Ticket } from '../../database/entities/ticket.entity';
import { RedisService } from '../redis/redis.service';
import { CreateSeatDto, GenerateSeatsForRoomDto } from './dto/seat.dto';

@Injectable()
export class SeatsService {
  constructor(
    @InjectRepository(Seat)
    private readonly seatRepository: Repository<Seat>,
    @InjectRepository(Showtime)
    private readonly showtimeRepository: Repository<Showtime>,
    @InjectRepository(Ticket)
    private readonly ticketRepository: Repository<Ticket>,
    private readonly redisService: RedisService,
  ) {}

  // =========================================================================
  // TODO: Đặng Minh Quang - Hiện thực UC3: Quản lý ghế
  // =========================================================================

  async findByRoom(roomId: number) {
    // TODO: Viết logic lấy danh sách ghế theo phòng chiếu
    return {
      message: `TODO: Quang viết logic lấy danh sách ghế phòng ID ${roomId}`,
      roomId,
      data: [],
    };
  }

  async createSeat(dto: CreateSeatDto) {
    // TODO: Viết logic tạo một ghế mới
    return {
      message: 'TODO: Quang viết logic tạo ghế lẻ',
      payload: dto,
    };
  }

  async generateSeatsGrid(dto: GenerateSeatsForRoomDto) {
    // TODO: Viết logic tự động tạo lưới ghế theo hàng/cột (VD: Hàng A->F, Cột 1->10)
    return {
      message: 'TODO: Quang viết logic tạo lưới ma trận ghế cho phòng chiếu',
      payload: dto,
    };
  }

  async deleteSeat(id: number) {
    // TODO: Viết logic xóa ghế
    return {
      message: `TODO: Quang viết logic xóa ghế ID ${id}`,
    };
  }

  // =========================================================================
  // TODO: Nguyễn Thị Cẩm Vân - Hiện thực UC6: Xem sơ đồ và trạng thái ghế
  // Kết hợp MySQL (ghế đã đặt) và Redis (ghế đang giữ tạm thời)
  // =========================================================================

  async getSeatMatrixForShowtime(showtimeId: number, currentUserId?: number) {
    // TODO: Vân viết logic tổng hợp trạng thái từng ghế:
    // 1. Lấy tất cả ghế phòng chiếu từ MySQL
    // 2. Lấy vé đã đặt từ bảng tickets (MySQL) -> Trạng thái BOOKED
    // 3. Lấy ghế đang giữ từ Redis (TTL 5p) -> Trạng thái HOLDING
    // 4. Các ghế còn lại -> AVAILABLE
    return {
      message: `TODO: Vân viết logic tổng hợp sơ đồ trạng thái ghế cho suất chiếu ID ${showtimeId}`,
      showtimeId,
      currentUserId,
      seats: [],
    };
  }
}
