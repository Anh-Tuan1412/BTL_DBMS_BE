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
  @PrimaryGeneratedColumn({ name: 'cinema_id' })
  id: number;

  @Index('idx_cinema_name')
  @Column({ name: 'cinema_name', length: 150 })
  name: string;

  @Column({ name: 'address', length: 255 })
  address: string;

  @Index('idx_cinema_city')
  @Column({ name: 'city', length: 100 })
  city: string;

  @Column({ length: 15, nullable: true })
  phone: string;

  @Column({ type: 'enum', enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE' })
  status: string;

  @OneToMany(() => CinemaRoom, (room) => room.cinema, { cascade: true })
  rooms: CinemaRoom[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
