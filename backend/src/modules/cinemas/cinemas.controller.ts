import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CinemasService } from './cinemas.service';
import { CreateCinemaDto, CreateRoomDto, UpdateCinemaDto, UpdateRoomDto } from './dto/cinema.dto';
import { Public, Roles } from '../../common/decorators';
import { JwtAuthGuard, RolesGuard } from '../../common/guards';
import { UserRole } from '../../common/enums';

@ApiTags('Cinemas - Quản lý rạp và phòng chiếu (UC2: Quách Văn Hà)')
@Controller('cinemas')
export class CinemasController {
  constructor(private readonly cinemasService: CinemasService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Lấy danh sách tất cả các cụm rạp' })
  findAllCinemas() {
    return this.cinemasService.findAllCinemas();
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Lấy thông tin chi tiết một rạp' })
  findCinemaById(@Param('id', ParseIntPipe) id: number) {
    return this.cinemasService.findCinemaById(id);
  }

  @Public()
  @Get(':id/rooms')
  @ApiOperation({ summary: 'Lấy danh sách phòng chiếu của rạp' })
  findRoomsByCinema(@Param('id', ParseIntPipe) cinemaId: number) {
    return this.cinemasService.findRoomsByCinema(cinemaId);
  }

  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post()
  @ApiOperation({ summary: 'Thêm rạp chiếu phim mới (Chỉ dành cho ADMIN)' })
  createCinema(@Body() dto: CreateCinemaDto) {
    return this.cinemasService.createCinema(dto);
  }

  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Delete(':id')
  @ApiOperation({ summary: 'Xóa rạp chiếu phim (Chỉ dành cho ADMIN)' })
  deleteCinema(@Param('id', ParseIntPipe) id: number) {
    return this.cinemasService.deleteCinema(id);
  }

  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post('rooms')
  @ApiOperation({ summary: 'Thêm phòng chiếu cho rạp (Chỉ dành cho ADMIN)' })
  createRoom(@Body() dto: CreateRoomDto) {
    return this.cinemasService.createRoom(dto);
  }

  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Delete('rooms/:id')
  @ApiOperation({ summary: 'Xóa phòng chiếu (Chỉ dành cho ADMIN)' })
  deleteRoom(@Param('id', ParseIntPipe) id: number) {
    return this.cinemasService.deleteRoom(id);
  }

  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Put(':id')
  @ApiOperation({ summary: 'Cập nhật thông tin rạp (Chỉ ADMIN)' })
  updateCinema(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCinemaDto) {
    return this.cinemasService.updateCinema(id, dto);
  }

  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Put('rooms/:id')
  @ApiOperation({ summary: 'Cập nhật thông tin phòng chiếu (Chỉ ADMIN)' })
  updateRoom(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateRoomDto) {
    return this.cinemasService.updateRoom(id, dto);
  }
}
