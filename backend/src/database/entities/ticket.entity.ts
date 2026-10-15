import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { Booking } from './booking.entity';
import { Seat } from './seat.entity';

@Entity('booking_details')
@Unique(['bookingId', 'seatId'])
export class Ticket {
  @PrimaryGeneratedColumn({ name: 'booking_detail_id' })
  id: number;
  @Column({ name: 'ticket_code', length: 50, unique: true })
  ticketCode: string;
  @Column({ name: 'hold_token', length: 100, select: false })
  holdToken: string;
  @Column({ name: 'booking_id' })
  bookingId: number;
  @Column({ name: 'showtime_id' })
  showtimeId: number;
  @Column({ name: 'seat_id' })
  seatId: number;
  @Column({ name: 'ticket_price', type: 'decimal', precision: 10, scale: 2 })
  price: number;
  @Column({
    name: 'ticket_status',
    type: 'enum',
    enum: ['PENDING', 'VALID', 'USED', 'CANCELLED', 'EXPIRED', 'REFUNDED'],
    default: 'PENDING',
  })
  status: string;
  @ManyToOne(() => Booking, (booking) => booking.tickets, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'booking_id' })
  booking: Booking;
  @ManyToOne(() => Seat, (seat) => seat.tickets, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'seat_id' })
  seat: Seat;
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
