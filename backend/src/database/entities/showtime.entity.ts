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
import { Movie } from './movie.entity';
import { CinemaRoom } from './cinema-room.entity';
import { Booking } from './booking.entity';
import { ShowtimeStatus } from '../../common/enums';

@Entity('showtimes')
export class Showtime {
  @PrimaryGeneratedColumn({ name: 'showtime_id' })
  id: number;

  @Index('idx_showtime_movie_id')
  @Column({ name: 'movie_id' })
  movieId: number;

  @Index('idx_showtime_room_id')
  @Column({ name: 'room_id' })
  roomId: number;

  @Index('idx_showtime_start_time')
  @Column({ name: 'start_time', type: 'datetime' })
  startTime: Date;

  @Column({ name: 'end_time', type: 'datetime' })
  endTime: Date;

  @Column({
    name: 'base_price',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 90000.0,
  })
  basePrice: number;

  @Column({
    name: 'cleanup_minutes',
    type: 'smallint',
    unsigned: true,
    default: 15,
  })
  cleanupMinutes: number;

  @Column({
    type: 'enum',
    enum: ShowtimeStatus,
    default: ShowtimeStatus.SCHEDULED,
  })
  status: ShowtimeStatus;

  @ManyToOne(() => Movie, (movie) => movie.showtimes, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'movie_id' })
  movie: Movie;

  @ManyToOne(() => CinemaRoom, (room) => room.showtimes, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'room_id' })
  room: CinemaRoom;

  @OneToMany(() => Booking, (booking) => booking.showtime)
  bookings: Booking[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
