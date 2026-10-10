import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { MovieStatus } from '../../common/enums';
import { Showtime } from './showtime.entity';

@Entity('movies')
export class Movie {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index('idx_movie_title')
  @Column({ length: 255 })
  title!: string;

  @Column({ type: 'text', nullable: true })
  description!: string;

  @Column({ type: 'int', default: 120 })
  durationMinutes!: number;

  @Index('idx_movie_release_date')
  @Column({ type: 'date' })
  releaseDate!: Date;

  @Index('idx_movie_genre')
  @Column({ length: 100, nullable: true })
  genre!: string;

  @Column({ length: 100, nullable: true })
  director!: string;

  @Column({ type: 'text', nullable: true })
  cast!: string;

  @Column({ type: 'text', nullable: true })
  posterUrl!: string;

  @Column({ type: 'text', nullable: true })
  trailerUrl!: string;

  @Index('idx_movie_status')
  @Column({
    type: 'enum',
    enum: MovieStatus,
    default: MovieStatus.NOW_SHOWING,
  })
  status!: MovieStatus;

  @Column({ type: 'decimal', precision: 3, scale: 1, default: 8.5 })
  rating!: number;

  @OneToMany(() => Showtime, (showtime) => showtime.movie)
  showtimes!: Showtime[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
