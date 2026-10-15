import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
@Entity('seat_types')
export class SeatTypeEntity {
  @PrimaryGeneratedColumn({ name: 'seat_type_id' })
  id: number;
  @Column({ name: 'type_name', length: 50, unique: true })
  name: string;
  @Column({
    name: 'price_coefficient',
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: 1,
  })
  priceCoefficient: number;
  @Column({ type: 'enum', enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE' })
  status: string;
}
