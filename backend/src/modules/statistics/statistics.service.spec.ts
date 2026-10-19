import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { BadRequestException } from '@nestjs/common';
import { StatisticsService } from './statistics.service';

describe('StatisticsService (UC10: Mai Anh Tuấn)', () => {
  let service: StatisticsService;
  let dataSource: {
    query: jest.Mock;
  };

  beforeEach(async () => {
    dataSource = {
      query: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StatisticsService,
        {
          provide: DataSource,
          useValue: dataSource,
        },
      ],
    }).compile();

    service = module.get<StatisticsService>(StatisticsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getOverviewSummary', () => {
    it('should compute overview KPIs and cancellation rate correctly', async () => {
      dataSource.query
        .mockResolvedValueOnce([
          {
            totalRevenue: '485000000.00',
            successfulBookings: '2180',
            cancelledBookings: '85',
            totalBookings: '2265',
          },
        ])
        .mockResolvedValueOnce([
          {
            totalTicketsSold: '5240',
          },
        ]);

      const result = await service.getOverviewSummary();

      expect(dataSource.query).toHaveBeenCalledTimes(2);
      expect(result.totalRevenue).toBe(485000000);
      expect(result.successfulBookings).toBe(2180);
      expect(result.cancelledBookings).toBe(85);
      expect(result.totalTicketsSold).toBe(5240);
      expect(result.cancellationRate).toBe('3.75%');
    });

    it('should handle zero bookings gracefully with 0.00% cancellation rate', async () => {
      dataSource.query
        .mockResolvedValueOnce([
          {
            totalRevenue: '0',
            successfulBookings: '0',
            cancelledBookings: '0',
            totalBookings: '0',
          },
        ])
        .mockResolvedValueOnce([{ totalTicketsSold: '0' }]);

      const result = await service.getOverviewSummary();

      expect(result.totalRevenue).toBe(0);
      expect(result.cancellationRate).toBe('0.00%');
    });
  });

  describe('getRevenueByMovies', () => {
    it('should return top movies formatted correctly', async () => {
      const mockRows = [
        {
          movieId: '1',
          title: 'Mai (2024)',
          totalTickets: '2450',
          totalRevenue: '225000000.00',
        },
        {
          movieId: '2',
          title: 'Đào, Phở và Piano',
          totalTickets: '1820',
          totalRevenue: '163800000.00',
        },
      ];
      dataSource.query.mockResolvedValue(mockRows);

      const result = await service.getRevenueByMovies(5);

      expect(dataSource.query).toHaveBeenCalled();
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        movieId: 1,
        title: 'Mai (2024)',
        totalTickets: 2450,
        totalRevenue: 225000000,
      });
    });
  });

  describe('getRevenueByMonth', () => {
    it('should return monthly revenue aggregates', async () => {
      const mockRows = [
        { month: '2026-10', bookingCount: '835', revenue: '168000000.00' },
        { month: '2026-09', bookingCount: '780', revenue: '172000000.00' },
      ];
      dataSource.query.mockResolvedValue(mockRows);

      const result = await service.getRevenueByMonth();

      expect(dataSource.query).toHaveBeenCalled();
      expect(result).toEqual([
        { month: '2026-10', bookingCount: 835, revenue: 168000000 },
        { month: '2026-09', bookingCount: 780, revenue: 172000000 },
      ]);
    });
  });

  describe('getSeatOccupancyRate', () => {
    it('should return occupancy rates with percentage formatting', async () => {
      const startTime = new Date('2026-10-15T19:00:00.000Z');
      const mockRows = [
        {
          showtimeId: '101',
          movieTitle: 'Mai (2024)',
          roomName: 'Room 1 (IMAX)',
          startTime,
          totalRoomSeats: '50',
          bookedSeats: '48',
          occupancyRateRaw: '96.00',
        },
      ];
      dataSource.query.mockResolvedValue(mockRows);

      const result = await service.getSeatOccupancyRate();

      expect(dataSource.query).toHaveBeenCalled();
      expect(result[0]).toEqual({
        showtimeId: 101,
        movieTitle: 'Mai (2024)',
        roomName: 'Room 1 (IMAX)',
        startTime,
        bookedSeats: 48,
        totalRoomSeats: 50,
        occupancyRate: '96.00%',
      });
    });
  });

  describe('explainQuery', () => {
    it('should return explain plan for valid SELECT query', async () => {
      const mockPlan = [{ id: 1, select_type: 'SIMPLE', table: 'bookings' }];
      dataSource.query.mockResolvedValue(mockPlan);

      const result = await service.explainQuery('SELECT * FROM bookings');

      expect(result.query).toBe('SELECT * FROM bookings');
      expect(result.executionPlan).toBe(mockPlan);
      expect(result.executionTimeMs).toBeDefined();
    });

    it('should reject non-SELECT query with BadRequestException', async () => {
      await expect(
        service.explainQuery('DELETE FROM bookings WHERE id = 1'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
