import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToMany,
  ManyToMany,
  JoinTable,
} from 'typeorm';
import { MovieStatus } from '../../common/enums';
import { Showtime } from './showtime.entity';
import { Genre } from './genre.entity';

@Entity('movies')
export class Movie {
  @PrimaryGeneratedColumn({ name: 'movie_id' })
  id: number;

  @Index('idx_movie_title')
  @Column({ length: 255 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ name: 'duration', type: 'int' })
  durationMinutes: number;

  @Index('idx_movie_release_date')
  @Column({ name: 'release_date', type: 'date', nullable: true })
  releaseDate: Date;

  @ManyToMany(() => Genre, { eager: true })
  @JoinTable({
    name: 'movie_genres',
    joinColumn: { name: 'movie_id' },
    inverseJoinColumn: { name: 'genre_id' },
  })
  genres: Genre[];

  @Column({ name: 'age_rating', length: 10, nullable: true })
  ageRating: string;

  @Column({ length: 100, nullable: true })
  director: string;

  @Column({ name: 'cast_members', type: 'text', nullable: true })
  cast: string;

  @Column({ name: 'poster_url', type: 'text', nullable: true })
  posterUrl: string;

  @Column({ name: 'trailer_url', type: 'text', nullable: true })
  trailerUrl: string;

  @Index('idx_movie_status')
  @Column({
    type: 'enum',
    enum: MovieStatus,
    default: MovieStatus.COMING_SOON,
  })
  status: MovieStatus;

  @Column({ type: 'decimal', precision: 3, scale: 1, default: 0 })
  rating: number;

  @OneToMany(() => Showtime, (showtime) => showtime.movie)
  showtimes: Showtime[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
