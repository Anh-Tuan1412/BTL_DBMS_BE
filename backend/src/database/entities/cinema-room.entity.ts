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
import { Cinema } from './cinema.entity';
import { Seat } from './seat.entity';
import { Showtime } from './showtime.entity';

@Entity('rooms')
export class CinemaRoom {
  @PrimaryGeneratedColumn({ name: 'room_id' })
  id: number;

  @Column({ name: 'room_name', length: 100 })
  name: string;

  @Index('idx_room_cinema_id')
  @Column({ name: 'cinema_id' })
  cinemaId: number;

  @Column({ name: 'total_seats', type: 'int', default: 0 })
  totalSeats: number;

  @Column({ type: 'enum', enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE' })
  status: string;

  @ManyToOne(() => Cinema, (cinema) => cinema.rooms, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'cinema_id' })
  cinema: Cinema;

  @OneToMany(() => Seat, (seat) => seat.room, { cascade: true })
  seats: Seat[];

  @OneToMany(() => Showtime, (showtime) => showtime.room)
  showtimes: Showtime[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}