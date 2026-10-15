import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { BookingStatus } from '../../common/enums';
import { User } from './user.entity';
import { Showtime } from './showtime.entity';
import { Ticket } from './ticket.entity';
import { Payment } from './payment.entity';

@Entity('bookings')
export class Booking {
  @PrimaryGeneratedColumn({ name: 'booking_id' })
  id: number;
  @Column({ name: 'booking_code', length: 50, unique: true })
  bookingCode: string;
  @Column({ name: 'user_id' })
  userId: number;
  @Column({ name: 'showtime_id' })
  showtimeId: number;
  @Column({ name: 'voucher_id', type: 'int', nullable: true })
  voucherId: number | null;
  @Column({
    name: 'total_amount',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
  })
  totalAmount: number;
  @Column({
    name: 'discount_amount',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
  })
  discountAmount: number;
  @Column({
    name: 'booking_status',
    type: 'enum',
    enum: BookingStatus,
    default: BookingStatus.PENDING,
  })
  status: BookingStatus;
  @Column({ name: 'hold_expires_at', type: 'datetime', nullable: true })
  holdExpiresAt: Date | null;
  @Column({ name: 'cancelled_at', type: 'datetime', nullable: true })
  cancelledAt: Date | null;
  @Column({
    name: 'cancellation_reason',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  cancellationReason: string | null;
  @ManyToOne(() => User, (user) => user.bookings, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'user_id' })
  user: User;
  @ManyToOne(() => Showtime, (showtime) => showtime.bookings, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'showtime_id' })
  showtime: Showtime;
  @OneToMany(() => Ticket, (ticket) => ticket.booking)
  tickets: Ticket[];
  @OneToMany(() => Payment, (payment) => payment.booking)
  payments: Payment[];
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
