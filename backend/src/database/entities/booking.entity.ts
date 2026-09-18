import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { BookingStatus, PaymentStatus } from '../../common/enums';
import { User } from './user.entity';
import { Showtime } from './showtime.entity';
import { Ticket } from './ticket.entity';

@Entity('bookings')
export class Booking {
  @PrimaryGeneratedColumn()
  id: number;

  @Index('idx_booking_code', { unique: true })
  @Column({ length: 50, unique: true })
  bookingCode: string;

  @Index('idx_booking_user_id')
  @Column()
  userId: number;

  @Index('idx_booking_showtime_id')
  @Column()
  showtimeId: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0.0 })
  totalAmount: number;

  @Index('idx_booking_status')
  @Column({
    type: 'enum',
    enum: BookingStatus,
    default: BookingStatus.PENDING,
  })
  status: BookingStatus;

  @Index('idx_payment_status')
  @Column({
    type: 'enum',
    enum: PaymentStatus,
    default: PaymentStatus.PENDING,
  })
  paymentStatus: PaymentStatus;

  @Column({ length: 50, default: 'STRIPE' })
  paymentMethod: string;

  @Column({ length: 100, nullable: true })
  paymentTransactionId: string;

  @ManyToOne(() => User, (user) => user.bookings, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @ManyToOne(() => Showtime, (showtime) => showtime.bookings, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'showtimeId' })
  showtime: Showtime;

  @OneToMany(() => Ticket, (ticket) => ticket.booking, { cascade: true })
  tickets: Ticket[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
