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
  Genre,
  SeatTypeEntity,
  ShowtimeSeat,
  Payment,
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
        username:
          configService.get<string>('DB_USERNAME') ||
          configService.get<string>('DB_USER', 'movie_user'),
        password: configService.get<string>('DB_PASSWORD', 'movie_password'),
        database: configService.get<string>('DB_NAME', 'movie_ticket_db'),
        timezone: 'Z',
        charset: 'utf8mb4',
        entities: [
          User,
          Movie,
          Cinema,
          CinemaRoom,
          Seat,
          Showtime,
          Booking,
          Ticket,
          Genre,
          SeatTypeEntity,
          ShowtimeSeat,
          Payment,
        ],
        synchronize: false, // SQL migrations own the schema; never auto-alter existing data.
        logging: configService.get<string>('NODE_ENV') === 'development',
      }),
    }),
  ],
})
export class DatabaseModule {}
