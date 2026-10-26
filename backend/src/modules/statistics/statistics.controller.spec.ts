import { Test, TestingModule } from '@nestjs/testing';
import { StatisticsController } from './statistics.controller';
import { StatisticsService } from './statistics.service';

describe('StatisticsController (UC10: Mai Anh Tuấn)', () => {
  let controller: StatisticsController;
  let service: {
    getOverviewSummary: jest.Mock;
    getRevenueByMovies: jest.Mock;
    getRevenueByMonth: jest.Mock;
    getSeatOccupancyRate: jest.Mock;
    explainQuery: jest.Mock;
    benchmarkMysqlVsRedis: jest.Mock;
  };

  beforeEach(async () => {
    service = {
      getOverviewSummary: jest.fn(),
      getRevenueByMovies: jest.fn(),
      getRevenueByMonth: jest.fn(),
      getSeatOccupancyRate: jest.fn(),
      explainQuery: jest.fn(),
      benchmarkMysqlVsRedis: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [StatisticsController],
      providers: [
        {
          provide: StatisticsService,
          useValue: service,
        },
      ],
    }).compile();

    controller = module.get<StatisticsController>(StatisticsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getSummary', () => {
    it('should call statisticsService.getOverviewSummary', async () => {
      const mockResult = {
        totalRevenue: 485000000,
        totalTicketsSold: 5240,
        successfulBookings: 2180,
        cancelledBookings: 85,
        cancellationRate: '3.75%',
      };
      service.getOverviewSummary.mockResolvedValue(mockResult);

      const result = await controller.getSummary();

      expect(service.getOverviewSummary).toHaveBeenCalled();
      expect(result).toBe(mockResult);
    });
  });

  describe('getTopMovies', () => {
    it('should call getRevenueByMovies with parsed limit number', async () => {
      const mockResult = [{ movieId: 1, title: 'Mai', totalTickets: 2450, totalRevenue: 225000000 }];
      service.getRevenueByMovies.mockResolvedValue(mockResult);

      const result = await controller.getTopMovies('5');

      expect(service.getRevenueByMovies).toHaveBeenCalledWith(5);
      expect(result).toBe(mockResult);
    });

    it('should default to 10 when limit is not provided', async () => {
      service.getRevenueByMovies.mockResolvedValue([]);

      await controller.getTopMovies(undefined);

      expect(service.getRevenueByMovies).toHaveBeenCalledWith(10);
    });
  });

  describe('getMonthlyRevenue', () => {
    it('should call getRevenueByMonth', async () => {
      const mockResult = [{ month: '2026-10', bookingCount: 835, revenue: 168000000 }];
      service.getRevenueByMonth.mockResolvedValue(mockResult);

      const result = await controller.getMonthlyRevenue();

      expect(service.getRevenueByMonth).toHaveBeenCalled();
      expect(result).toBe(mockResult);
    });
  });

  describe('getSeatOccupancy', () => {
    it('should call getSeatOccupancyRate', async () => {
      const mockResult = [
        {
          showtimeId: 101,
          movieTitle: 'Mai',
          roomName: 'Room 1',
          startTime: new Date(),
          bookedSeats: 48,
          totalRoomSeats: 50,
          occupancyRate: '96.00%',
        },
      ];
      service.getSeatOccupancyRate.mockResolvedValue(mockResult);

      const result = await controller.getSeatOccupancy();

      expect(service.getSeatOccupancyRate).toHaveBeenCalled();
      expect(result).toBe(mockResult);
    });
  });

  describe('explainQuery', () => {
    it('should call explainQuery with sql string from DTO', async () => {
      const mockResult = { query: 'SELECT 1', executionTimeMs: '1.200 ms', executionPlan: [] };
      service.explainQuery.mockResolvedValue(mockResult);

      const result = await controller.explainQuery({ query: 'SELECT 1' });

      expect(service.explainQuery).toHaveBeenCalledWith('SELECT 1');
      expect(result).toBe(mockResult);
    });
  });

  describe('benchmark', () => {
    it('should call benchmarkMysqlVsRedis with parsed iterations', async () => {
      const mockResult = { benchmarkOverview: 'OK' };
      service.benchmarkMysqlVsRedis.mockResolvedValue(mockResult);

      const result = await controller.benchmark('50');

      expect(service.benchmarkMysqlVsRedis).toHaveBeenCalledWith(50);
      expect(result).toBe(mockResult);
    });

    it('should default to 100 iterations if not provided', async () => {
      service.benchmarkMysqlVsRedis.mockResolvedValue({});

      await controller.benchmark(undefined);

      expect(service.benchmarkMysqlVsRedis).toHaveBeenCalledWith(100);
    });
  });
});
