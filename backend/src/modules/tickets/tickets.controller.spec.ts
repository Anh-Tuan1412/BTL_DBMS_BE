import { Test, TestingModule } from '@nestjs/testing';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';
import { User } from '../../database/entities/user.entity';
import { UserRole } from '../../common/enums';

describe('TicketsController (UC9: Mai Anh Tuấn)', () => {
  let controller: TicketsController;
  let service: {
    getMyBookings: jest.Mock;
    getBookingDetail: jest.Mock;
    cancelAndRefund: jest.Mock;
  };

  const mockUser: User = {
    id: 1,
    email: 'user@example.com',
    fullName: 'Mai Anh Tuấn',
    phone: '0901234567',
    passwordHash: 'hash',
    role: UserRole.CUSTOMER,
    createdAt: new Date(),
    updatedAt: new Date(),
    bookings: [],
  };

  beforeEach(async () => {
    service = {
      getMyBookings: jest.fn(),
      getBookingDetail: jest.fn(),
      cancelAndRefund: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TicketsController],
      providers: [
        {
          provide: TicketsService,
          useValue: service,
        },
      ],
    }).compile();

    controller = module.get<TicketsController>(TicketsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getMyBookings', () => {
    it('should call ticketsService.getMyBookings with current user id', async () => {
      const expected = [{ id: 10, bookingCode: 'BK-10' }];
      service.getMyBookings.mockResolvedValue(expected);

      const result = await controller.getMyBookings(mockUser);

      expect(service.getMyBookings).toHaveBeenCalledWith(1);
      expect(result).toBe(expected);
    });
  });

  describe('getBookingDetail', () => {
    it('should pass bookingCode, user id and admin boolean to service', async () => {
      const expected = { id: 10, bookingCode: 'BK-10' };
      service.getBookingDetail.mockResolvedValue(expected);

      const result = await controller.getBookingDetail('BK-10', mockUser);

      expect(service.getBookingDetail).toHaveBeenCalledWith('BK-10', 1, false);
      expect(result).toBe(expected);
    });
  });

  describe('cancelAndRefund', () => {
    it('should call cancelAndRefund with bookingCode and user id', async () => {
      const expected = {
        bookingCode: 'BK-10',
        status: 'CANCELLED',
        mode: 'MOCK',
      };
      service.cancelAndRefund.mockResolvedValue(expected);

      const result = await controller.cancelAndRefund('BK-10', mockUser);

      expect(service.cancelAndRefund).toHaveBeenCalledWith('BK-10', 1);
      expect(result).toBe(expected);
    });
  });
});
