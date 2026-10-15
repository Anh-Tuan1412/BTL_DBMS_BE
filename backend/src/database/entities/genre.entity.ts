import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
@Entity('genres')
export class Genre {
  @PrimaryGeneratedColumn({ name: 'genre_id' })
  id: number;
  @Column({ name: 'genre_name', length: 100, unique: true })
  name: string;
}
