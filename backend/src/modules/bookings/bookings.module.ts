import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Booking } from '../../database/entities/booking.entity';
import { Ticket } from '../../database/entities/ticket.entity';
import { Showtime } from '../../database/entities/showtime.entity';
import { Seat } from '../../database/entities/seat.entity';
import { BookingsService } from './bookings.service';
import { BookingsController } from './bookings.controller';
import { SeatHoldExpiryService } from './seat-hold-expiry.service';
@Module({
  imports: [TypeOrmModule.forFeature([Booking, Ticket, Showtime, Seat])],
  controllers: [BookingsController],
  providers: [BookingsService, SeatHoldExpiryService],
  exports: [BookingsService, SeatHoldExpiryService],
})
export class BookingsModule {}