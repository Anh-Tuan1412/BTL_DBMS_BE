import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Showtime } from '../../database/entities/showtime.entity';
import { Movie } from '../../database/entities/movie.entity';
import { CinemaRoom } from '../../database/entities/cinema-room.entity';
import { Booking } from '../../database/entities/booking.entity';
import { ShowtimesService } from './showtimes.service';
import { ShowtimesController } from './showtimes.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Showtime, Movie, CinemaRoom, Booking])],
  controllers: [ShowtimesController],
  providers: [ShowtimesService],
  exports: [ShowtimesService],
})
export class ShowtimesModule {}
