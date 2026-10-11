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

@Entity('cinema_rooms')
export class CinemaRoom {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ length: 100 })
  name!: string;

  @Index('idx_room_cinema_id')
  @Column()
  cinemaId!: number;

  @Column({ type: 'int', default: 50 })
  totalSeats!: number;

  @ManyToOne(() => Cinema, (cinema) => cinema.rooms, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'cinemaId' })
  cinema!: Cinema;

  @OneToMany(() => Seat, (seat) => seat.room, { cascade: true })
  seats!: Seat[];

  @OneToMany(() => Showtime, (showtime) => showtime.room)
  showtimes!: Showtime[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
