import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import {
  User,
  Movie,
  Cinema,
  CinemaRoom,
  Seat,
  Showtime,
  Booking,
  Ticket,
} from './entities';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'mysql',
        host: configService.get<string>('DB_HOST', 'localhost'),
        port: Number(configService.get<number>('DB_PORT', 3306)),
        username: configService.get<string>('DB_USER', 'movie_user'),
        password: configService.get<string>('DB_PASSWORD', 'movie_password'),
        database: configService.get<string>('DB_NAME', 'movie_booking_db'),
        entities: [
          User,
          Movie,
          Cinema,
          CinemaRoom,
          Seat,
          Showtime,
          Booking,
          Ticket,
        ],
        synchronize: true, // Tự động đồng bộ schema database trong môi trường dev
        logging: configService.get<string>('NODE_ENV') === 'development',
      }),
    }),
  ],
})
export class DatabaseModule {}
