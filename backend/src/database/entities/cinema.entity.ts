import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { CinemaRoom } from './cinema-room.entity';

@Entity('cinemas')
export class Cinema {
  @PrimaryGeneratedColumn()
  id: number;

  @Index('idx_cinema_name')
  @Column({ length: 150 })
  name: string;

  @Column({ length: 255 })
  address: string;

  @Index('idx_cinema_city')
  @Column({ length: 100 })
  city: string;

  @OneToMany(() => CinemaRoom, (room) => room.cinema, { cascade: true })
  rooms: CinemaRoom[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
