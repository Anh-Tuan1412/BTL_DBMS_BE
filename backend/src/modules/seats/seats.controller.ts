import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
  Header,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SeatsService } from './seats.service';
import {
  CreateSeatDto,
  GenerateSeatsForRoomDto,
  UpdateSeatDto,
} from './dto/seat.dto';
import { Public, Roles, CurrentUser } from '../../common/decorators';
import {
  JwtAuthGuard,
  RolesGuard,
  OptionalJwtAuthGuard,
} from '../../common/guards';
import { UserRole } from '../../common/enums';
import { User } from '../../database/entities/user.entity';

@ApiTags('Seats - Quản lý ghế & Sơ đồ ghế (UC3: Quang, UC6: Vân)')
@Controller('seats')
export class SeatsController {
  constructor(private readonly seatsService: SeatsService) {}

  @Public()
  @Get('types')
  findTypes() {
    return this.seatsService.findTypes();
  }

  @Public()
  @Get('room/:roomId')
  @ApiOperation({ summary: 'Lấy danh sách ghế của phòng chiếu' })
  findByRoom(@Param('roomId', ParseIntPipe) roomId: number) {
    return this.seatsService.findByRoom(roomId);
  }

  @Public()
  @Get('matrix/showtime/:showtimeId')
  @UseGuards(OptionalJwtAuthGuard)
  @Header('Cache-Control', 'private, no-store')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'UC6: Xem sơ đồ và trạng thái ghế (kết hợp MySQL & Redis)',
    description:
      'Không cần đăng nhập. Gửi JWT hợp lệ để nhận isHeldByMe. Trả trạng thái hiện tại khi gọi: AVAILABLE, HOLDING, BOOKED, INACTIVE; client cần gọi lại để cập nhật.',
  })
  getSeatMatrix(
    @Param('showtimeId', ParseIntPipe) showtimeId: number,
    @CurrentUser() user?: User,
  ) {
    return this.seatsService.getSeatMatrixForShowtime(showtimeId, user?.id);
  }

  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post()
  @ApiOperation({
    summary: 'Thêm một ghế đơn lẻ vào phòng (Chỉ dành cho ADMIN)',
  })
  createSeat(@Body() dto: CreateSeatDto) {
    return this.seatsService.createSeat(dto);
  }

  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch(':id')
  @ApiOperation({
    summary: 'Cập nhật vị trí, mã và loại ghế trước khi mở lịch chiếu',
  })
  updateSeat(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSeatDto,
  ) {
    return this.seatsService.updateSeat(id, dto);
  }

  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post('generate-grid')
  @ApiOperation({
    summary:
      'Tự động tạo ma trận ghế theo hàng/cột cho phòng chiếu (Chỉ dành cho ADMIN)',
  })
  generateGrid(@Body() dto: GenerateSeatsForRoomDto) {
    return this.seatsService.generateSeatsGrid(dto);
  }

  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Delete(':id')
  @ApiOperation({ summary: 'Xóa ghế (Chỉ dành cho ADMIN)' })
  deleteSeat(@Param('id', ParseIntPipe) id: number) {
    return this.seatsService.deleteSeat(id);
  }
}
