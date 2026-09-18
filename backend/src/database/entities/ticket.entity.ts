import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Booking } from './booking.entity';
import { Seat } from './seat.entity';

@Entity('tickets')
export class Ticket {
  @PrimaryGeneratedColumn()
  id: number;

  @Index('idx_ticket_code', { unique: true })
  @Column({ length: 50, unique: true })
  ticketCode: string;

  @Index('idx_ticket_booking_id')
  @Column()
  bookingId: number;

  @Index('idx_ticket_seat_id')
  @Column()
  seatId: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price: number;

  @Column({ length: 20, default: 'VALID' })
  status: string; // VALID, USED, REFUNDED

  @ManyToOne(() => Booking, (booking) => booking.tickets, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'bookingId' })
  booking: Booking;

  @ManyToOne(() => Seat, (seat) => seat.tickets, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'seatId' })
  seat: Seat;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
