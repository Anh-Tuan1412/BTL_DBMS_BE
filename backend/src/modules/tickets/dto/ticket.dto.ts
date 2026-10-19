import { ApiProperty } from '@nestjs/swagger';

export class CancelTicketResponseDto {
  @ApiProperty({
    example: 'BK-1728901234-A1B2',
    description: 'Mã đặt chỗ (booking code)',
  })
  bookingCode: string;

  @ApiProperty({
    example: 'CANCELLED',
    description: 'Trạng thái booking sau khi hủy thành công',
  })
  status: string;

  @ApiProperty({
    example: 'MOCK',
    description: 'Chế độ hoàn tiền (MOCK hoặc STRIPE)',
  })
  mode: string;
}

export class SeatSummaryDto {
  @ApiProperty({ example: 12, description: 'ID của ghế' })
  id: number;

  @ApiProperty({ example: 'C5', description: 'Số/Tên ghế' })
  seatNumber: string;

  @ApiProperty({ example: 'REGULAR', description: 'Loại ghế' })
  type: string;
}

export class TicketItemDto {
  @ApiProperty({ example: 45, description: 'ID vé' })
  id: number;

  @ApiProperty({ example: 'TK-1728901234-C5', description: 'Mã vé' })
  ticketCode: string;

  @ApiProperty({ example: 90000.0, description: 'Giá vé' })
  price: number;

  @ApiProperty({ example: 'CONFIRMED', description: 'Trạng thái vé' })
  status: string;

  @ApiProperty({ type: () => SeatSummaryDto, description: 'Thông tin ghế ngồi' })
  seat?: SeatSummaryDto;
}
