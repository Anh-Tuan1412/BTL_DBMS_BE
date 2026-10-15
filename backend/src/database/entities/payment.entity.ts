import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Booking } from './booking.entity';
import { PaymentStatus } from '../../common/enums';

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn({ name: 'payment_id' })
  id: number;
  @Column({ name: 'booking_id' })
  bookingId: number;
  @Column({
    name: 'payment_method',
    type: 'enum',
    enum: ['STRIPE', 'VNPAY', 'MOMO', 'ZALOPAY', 'CASH'],
    default: 'STRIPE',
  })
  method: string;
  @Column({
    name: 'transaction_code',
    type: 'varchar',
    length: 100,
    nullable: true,
    unique: true,
  })
  transactionCode: string | null;
  @Column({
    name: 'stripe_payment_intent_id',
    type: 'varchar',
    length: 255,
    nullable: true,
    unique: true,
  })
  stripePaymentIntentId: string | null;
  @Column({
    name: 'stripe_session_id',
    type: 'varchar',
    length: 255,
    nullable: true,
    unique: true,
  })
  stripeSessionId: string | null;
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;
  @Column({
    name: 'payment_status',
    type: 'enum',
    enum: PaymentStatus,
    default: PaymentStatus.PENDING,
  })
  status: PaymentStatus;
  @Column({ type: 'char', length: 3, default: 'VND' })
  currency: string;
  @Column({
    name: 'refund_id',
    type: 'varchar',
    length: 255,
    nullable: true,
    unique: true,
  })
  refundId: string | null;
  @Column({
    name: 'refund_amount',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
  })
  refundAmount: number;
  @Column({ name: 'paid_at', type: 'datetime', nullable: true })
  paidAt: Date | null;
  @Column({ name: 'refunded_at', type: 'datetime', nullable: true })
  refundedAt: Date | null;
  @ManyToOne(() => Booking, (booking) => booking.payments, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'booking_id' })
  booking: Booking;
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
