import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Seat } from '../../database/entities/seat.entity';
import { Showtime } from '../../database/entities/showtime.entity';
import { Ticket } from '../../database/entities/ticket.entity';
import { CinemaRoom } from '../../database/entities/cinema-room.entity';
import { SeatTypeEntity } from '../../database/entities/seat-type.entity';
import { SeatsService } from './seats.service';
import { SeatsController } from './seats.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Seat, Showtime, Ticket, CinemaRoom, SeatTypeEntity])],
  controllers: [SeatsController],
  providers: [SeatsService],
  exports: [SeatsService],
})
export class SeatsModule {}
