import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Cinema } from '../../database/entities/cinema.entity';
import { CinemaRoom } from '../../database/entities/cinema-room.entity';
import { Seat } from '../../database/entities/seat.entity'; // 👈 Import Seat Entity
import { CinemasService } from './cinemas.service';
import { CinemasController } from './cinemas.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Cinema, CinemaRoom, Seat])], // 👈 Bổ sung Seat vào đây
  controllers: [CinemasController],
  providers: [CinemasService],
  exports: [CinemasService],
})
export class CinemasModule {}