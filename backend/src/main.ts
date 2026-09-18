import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformResponseInterceptor } from './common/interceptors/transform-response.interceptor';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3000);

  // 1. Kích hoạt CORS cho Frontend (Next.js / React)
  app.enableCors({
    origin: true,
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
  });

  // 2. Tiền tố toàn cục cho toàn bộ API
  app.setGlobalPrefix('api');

  // 3. Validation Pipe toàn cục
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // 4. Global Interceptors & Exception Filters
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new TransformResponseInterceptor());

  // 5. Cấu hình Swagger API Documentation
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Movie Ticket Booking System API - BTL DBMS')
    .setDescription(
      'Hệ thống Đặt Vé Xem Phim Trực Tuyến sử dụng MySQL và Redis (HCMUT)\n\n' +
        '**Phân công nhóm:**\n' +
        '- **Quách Văn Hà**: Auth backend + UC1 (Phim) + UC2 (Rạp/Phòng) + Transaction\n' +
        '- **Đặng Minh Quang**: UC3 (Ghế) + UC4 (Suất chiếu) + Indexing\n' +
        '- **Nguyễn Thị Cẩm Vân**: UC5 (Tìm kiếm/Lọc) + UC6 (Sơ đồ ghế) + Concurrency\n' +
        '- **Định**: Auth + UC7 (Giữ ghế Redis TTL) + UC8 (Đặt vé Stripe) + Data Storage\n' +
        '- **Mai Anh Tuấn**: UC9 (Quản lý vé đã đặt) + UC10 (Thống kê doanh thu) + Query Processing',
    )
    .setVersion('1.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Nhập JWT token sau khi đăng nhập',
        in: 'header',
      },
      'JWT-auth',
    )
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: 'none',
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
  });

  await app.listen(port);
  logger.log(`==========================================================`);
  logger.log(
    `🚀 Server Backend NestJS đang chạy tại: http://localhost:${port}`,
  );
  logger.log(
    `📚 Swagger API Docs truy cập tại:     http://localhost:${port}/api/docs`,
  );
  logger.log(`==========================================================`);
}

void bootstrap();
