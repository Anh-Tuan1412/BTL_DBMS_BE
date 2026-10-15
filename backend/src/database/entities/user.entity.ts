import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { UserRole } from '../../common/enums';
import { Booking } from './booking.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn({ name: 'user_id' })
  id: number;

  @Index('idx_user_email', { unique: true })
  @Column({ unique: true, length: 150 })
  email: string;

  @Column({ name: 'password_hash', select: false })
  password: string;

  @Column({ name: 'fullname', length: 100 })
  fullName: string;

  @Column({ name: 'phone', length: 20, nullable: true, unique: true })
  phoneNumber: string;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.CUSTOMER,
  })
  role: UserRole;

  @Column({
    type: 'enum',
    enum: ['ACTIVE', 'INACTIVE', 'BANNED'],
    default: 'ACTIVE',
  })
  status: string;

  @OneToMany(() => Booking, (booking) => booking.user)
  bookings: Booking[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
