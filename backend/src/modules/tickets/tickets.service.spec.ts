import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { Booking } from '../../database/entities/booking.entity';
import { Ticket } from '../../database/entities/ticket.entity';
import { BookingsService } from '../bookings/bookings.service';

describe('TicketsService (UC9: Mai Anh Tuấn)', () => {
  let service: TicketsService;
  let bookingRepository: {
    find: jest.Mock;
    findOne: jest.Mock;
  };
  let ticketRepository: {
    find: jest.Mock;
  };
  let bookingsService: {
    cancelAndRefund: jest.Mock;
  };

  beforeEach(async () => {
    bookingRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
    };
    ticketRepository = {
      find: jest.fn(),
    };
    bookingsService = {
      cancelAndRefund: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TicketsService,
        {
          provide: getRepositoryToken(Booking),
          useValue: bookingRepository,
        },
        {
          provide: getRepositoryToken(Ticket),
          useValue: ticketRepository,
        },
        {
          provide: BookingsService,
          useValue: bookingsService,
        },
      ],
    }).compile();

    service = module.get<TicketsService>(TicketsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getMyBookings', () => {
    it('should query bookings belonging to the user sorted by createdAt DESC', async () => {
      const mockResult = [
        {
          id: 1,
          bookingCode: 'BK-101',
          userId: 99,
          tickets: [{ id: 10, seat: { seatNumber: 'C5' } }],
          showtime: {
            movie: { title: 'Mai' },
            room: { name: 'Cinema 1', cinema: { name: 'CGV' } },
          },
        },
      ];
      bookingRepository.find.mockResolvedValue(mockResult);

      const result = await service.getMyBookings(99);

      expect(bookingRepository.find).toHaveBeenCalledWith({
        where: { userId: 99 },
        relations: {
          tickets: { seat: true },
          payments: true,
          showtime: { movie: true, room: { cinema: true } },
        },
        order: { createdAt: 'DESC' },
      });
      expect(result).toEqual(mockResult);
    });
  });

  describe('getBookingDetail', () => {
    it('should return booking when found for regular user', async () => {
      const mockBooking = {
        id: 1,
        bookingCode: 'BK-101',
        userId: 99,
      };
      bookingRepository.findOne.mockResolvedValue(mockBooking);

      const result = await service.getBookingDetail('BK-101', 99, false);

      expect(bookingRepository.findOne).toHaveBeenCalledWith({
        where: { bookingCode: 'BK-101', userId: 99 },
        relations: {
          tickets: { seat: true },
          payments: true,
          showtime: { movie: true, room: { cinema: true } },
        },
      });
      expect(result).toEqual(mockBooking);
    });

    it('should query without userId restriction when user is admin', async () => {
      const mockBooking = { id: 2, bookingCode: 'BK-ADMIN' };
      bookingRepository.findOne.mockResolvedValue(mockBooking);

      const result = await service.getBookingDetail('BK-ADMIN', 99, true);

      expect(bookingRepository.findOne).toHaveBeenCalledWith({
        where: { bookingCode: 'BK-ADMIN' },
        relations: {
          tickets: { seat: true },
          payments: true,
          showtime: { movie: true, room: { cinema: true } },
        },
      });
      expect(result).toEqual(mockBooking);
    });

    it('should throw NotFoundException if booking does not exist', async () => {
      bookingRepository.findOne.mockResolvedValue(null);

      await expect(
        service.getBookingDetail('NOT_EXIST', 99, false),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('cancelAndRefund', () => {
    it('should delegate cancel and refund operation to bookingsService', async () => {
      const mockOutcome = {
        bookingCode: 'BK-101',
        status: 'CANCELLED',
        mode: 'MOCK',
      };
      bookingsService.cancelAndRefund.mockResolvedValue(mockOutcome);

      const result = await service.cancelAndRefund('BK-101', 99);

      expect(bookingsService.cancelAndRefund).toHaveBeenCalledWith(
        'BK-101',
        99,
      );
      expect(result).toEqual(mockOutcome);
    });
  });
});
