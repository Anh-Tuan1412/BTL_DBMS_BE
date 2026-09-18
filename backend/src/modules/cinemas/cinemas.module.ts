import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Cinema } from '../../database/entities/cinema.entity';
import { CinemaRoom } from '../../database/entities/cinema-room.entity';
import { CinemasService } from './cinemas.service';
import { CinemasController } from './cinemas.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Cinema, CinemaRoom])],
  controllers: [CinemasController],
  providers: [CinemasService],
  exports: [CinemasService],
})
export class CinemasModule {}
