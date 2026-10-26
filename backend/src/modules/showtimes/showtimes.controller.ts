import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Body,
  Param,
  Query,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ShowtimesService } from './showtimes.service';
import {
  CreateShowtimeDto,
  UpdateShowtimeDto,
  CheckConflictDto,
  QueryShowtimeDto,
} from './dto/showtime.dto';
import { Public, Roles } from '../../common/decorators';
import { JwtAuthGuard, RolesGuard } from '../../common/guards';
import { UserRole } from '../../common/enums';

@ApiTags('Showtimes - Quản lý suất chiếu (UC4: Đặng Minh Quang)')
@Controller('showtimes')
export class ShowtimesController {
  constructor(private readonly showtimesService: ShowtimesService) {}

  @Public()
  @Get()
  @ApiOperation({
    summary: 'Lấy danh sách các suất chiếu (hỗ trợ lọc theo phim, phòng, rạp, ngày, trạng thái)',
  })
  findAll(@Query() query: QueryShowtimeDto) {
    return this.showtimesService.findAll(query);
  }

  @Public()
  @Get('movie/:movieId')
  @ApiOperation({ summary: 'Lấy danh sách suất chiếu của một phim' })
  findByMovie(@Param('movieId', ParseIntPipe) movieId: number) {
    return this.showtimesService.findByMovie(movieId);
  }

  @Public()
  @Get('room/:roomId')
  @ApiOperation({ summary: 'Lấy danh sách suất chiếu của một phòng chiếu' })
  findByRoom(@Param('roomId', ParseIntPipe) roomId: number) {
    return this.showtimesService.findByRoom(roomId);
  }

  @Public()
  @Post('check-conflict')
  @ApiOperation({
    summary: 'UC4: Kiểm tra xung đột lịch chiếu trong phòng chiếu',
    description:
      'Kiểm tra xem khung giờ dự kiến có bị trùng với suất chiếu khác hoặc thời gian dọn phòng (cleanup_minutes) trong cùng phòng hay không.',
  })
  checkConflict(@Body() dto: CheckConflictDto) {
    return this.showtimesService.checkConflict(dto);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Xem chi tiết một suất chiếu' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.showtimesService.findOne(id);
  }

  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post()
  @ApiOperation({ summary: 'Tạo suất chiếu mới (Chỉ dành cho ADMIN)' })
  create(@Body() dto: CreateShowtimeDto) {
    return this.showtimesService.create(dto);
  }

  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật suất chiếu chưa có booking (Chỉ dành cho ADMIN)' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateShowtimeDto,
  ) {
    return this.showtimesService.update(id, dto);
  }

  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Delete(':id')
  @ApiOperation({ summary: 'Hủy suất chiếu (Chỉ dành cho ADMIN)' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.showtimesService.remove(id);
  }
}

