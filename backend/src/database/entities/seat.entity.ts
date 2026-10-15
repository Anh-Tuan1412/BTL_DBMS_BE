import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Unique,
} from 'typeorm';
import { CinemaRoom } from './cinema-room.entity';
import { Ticket } from './ticket.entity';
import { SeatTypeEntity } from './seat-type.entity';

@Entity('seats')
@Unique(['roomId', 'row', 'column'])
@Unique(['roomId', 'seatNumber'])
export class Seat {
  @PrimaryGeneratedColumn({ name: 'seat_id' })
  id: number;
  @Column({ name: 'room_id' })
  roomId: number;
  @Column({ name: 'seat_row', length: 5 })
  row: string;
  @Column({ name: 'seat_number', type: 'int' })
  column: number;
  @Column({ name: 'seat_label', length: 10 })
  seatNumber: string;
  @Column({ name: 'seat_type_id' })
  seatTypeId: number;
  @Column({
    type: 'enum',
    enum: ['AVAILABLE', 'INACTIVE'],
    default: 'AVAILABLE',
  })
  status: string;
  @ManyToOne(() => SeatTypeEntity, { eager: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'seat_type_id' })
  seatType: SeatTypeEntity;
  @ManyToOne(() => CinemaRoom, (room) => room.seats, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'room_id' })
  room: CinemaRoom;
  @OneToMany(() => Ticket, (ticket) => ticket.seat)
  tickets: Ticket[];
}
