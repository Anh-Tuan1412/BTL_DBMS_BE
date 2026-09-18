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

@Entity('showtimes')
export class Showtime {
  @PrimaryGeneratedColumn()
  id: number;

  @Index('idx_showtime_movie_id')
  @Column()
  movieId: number;

  @Index('idx_showtime_room_id')
  @Column()
  roomId: number;

  @Index('idx_showtime_start_time')
  @Column({ type: 'datetime' })
  startTime: Date;

  @Column({ type: 'datetime' })
  endTime: Date;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 90000.0 })
  basePrice: number;

  @ManyToOne(() => Movie, (movie) => movie.showtimes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'movieId' })
  movie: Movie;

  @ManyToOne(() => CinemaRoom, (room) => room.showtimes, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'roomId' })
  room: CinemaRoom;

  @OneToMany(() => Booking, (booking) => booking.showtime)
  bookings: Booking[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
