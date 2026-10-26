import { Column, Entity, PrimaryColumn } from 'typeorm';
@Entity('showtime_seats')
export class ShowtimeSeat {
  @PrimaryColumn({ name: 'showtime_id' })
  showtimeId: number;
  @PrimaryColumn({ name: 'seat_id' })
  seatId: number;
  @Column({ name: 'room_id' })
  roomId: number;
  @Column({ name: 'booking_id', type: 'int', nullable: true })
  bookingId: number | null;
  @Column({
    name: 'seat_status',
    type: 'enum',
    enum: ['AVAILABLE', 'PENDING', 'BOOKED'],
    default: 'AVAILABLE',
  })
  status: string;
}
