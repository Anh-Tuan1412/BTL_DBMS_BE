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
  Unique,
} from 'typeorm';
import { SeatType } from '../../common/enums';
import { CinemaRoom } from './cinema-room.entity';
import { Ticket } from './ticket.entity';

@Entity('seats')
@Unique(['roomId', 'seatNumber'])
export class Seat {
  @PrimaryGeneratedColumn()
  id: number;

  @Index('idx_seat_room_id')
  @Column()
  roomId: number;

  @Column({ length: 5 })
  row: string; // e.g. A, B, C, D

  @Column({ type: 'int' })
  column: number; // e.g. 1, 2, 3

  @Column({ length: 10 })
  seatNumber: string; // e.g. A1, A2, B3

  @Column({
    type: 'enum',
    enum: SeatType,
    default: SeatType.REGULAR,
  })
  type: SeatType;

  @Column({ type: 'decimal', precision: 3, scale: 2, default: 1.0 })
  priceMultiplier: number;

  @ManyToOne(() => CinemaRoom, (room) => room.seats, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'roomId' })
  room: CinemaRoom;

  @OneToMany(() => Ticket, (ticket) => ticket.seat)
  tickets: Ticket[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
