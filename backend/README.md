# 🎬 Movie Ticket Booking System - Backend (NestJS, MySQL & Redis)

> **BTL Hệ Quản Trị Cơ Sở Dữ Liệu - HCMUT**  
> Dự án: Xây dựng hệ thống đặt vé xem phim trực tuyến kết hợp **MySQL** và **Redis**.

---

Hướng dẫn tích hợp cập nhật: [../INTEGRATION.md](../INTEGRATION.md).

## 👥 Bảng phân công nhiệm vụ thành viên & Cấu trúc thư mục

| Thành viên | Trách nhiệm chính (Use Cases & Báo cáo DBMS) | Thư mục phụ trách trong `backend/src/` |
| :--- | :--- | :--- |
| **Quách Văn Hà** | • Auth Backend (Đăng ký, Đăng nhập)<br>• **UC1**: Quản lý phim (Thêm, sửa, xóa, danh sách)<br>• **UC2**: Quản lý rạp và phòng chiếu<br>• Báo cáo lý thuyết & thực nghiệm **Transaction** | `modules/auth/`<br>`modules/movies/`<br>`modules/cinemas/` |
| **Đặng Minh Quang** | • **UC3**: Quản lý ghế, loại ghế (Regular/VIP), ma trận hàng/cột<br>• **UC4**: Quản lý suất chiếu & kiểm tra xung đột lịch chiếu<br>• Báo cáo lý thuyết & thực nghiệm **Indexing** | `modules/seats/`<br>`modules/showtimes/` |
| **Nguyễn Thị Cẩm Vân** | • Frontend (Next.js/React)<br>• **UC5**: Tìm kiếm & lọc phim đa tiêu chí (tên, rạp, giá, ngày)<br>• **UC6**: Sơ đồ trạng thái ghế (Trống / Đang giữ / Đã đặt)<br>• Báo cáo thực nghiệm **Concurrency** | `modules/search/`<br>`modules/seats/seats.service.ts`<br>*(Kết nối Swagger API)* |
| **Định** | • Cấu hình Database & Auth<br>• **UC7**: Giữ ghế tạm thời 5 phút (**Redis TTL + SET NX EX**)<br>• **UC8**: Đặt vé (MySQL Transaction) & Stripe Test Mode<br>• Báo cáo **Data Storage & Management** | `modules/redis/`<br>`modules/bookings/`<br>`database/` |
| **Mai Anh Tuấn** | • **Tạo nền tảng Backend**<br>• **UC9**: Quản lý vé đã đặt, xem lịch sử, hủy vé & hoàn tiền<br>• **UC10**: Thống kê doanh thu, tỷ lệ lấp đầy ghế<br>• Báo cáo thực nghiệm **Query Processing** (EXPLAIN SQL) | `modules/tickets/`<br>`modules/statistics/`<br>`common/` |

---

## 🚀 Hướng dẫn khởi chạy nhanh cho cả nhóm (3 bước)

### 📋 Yêu cầu môi trường
- [Node.js](https://nodejs.org/) v20 trở lên (khuyên dùng v22 hoặc v24)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (bật Docker Desktop trước khi chạy)

---

### Bước 1: Khởi động MySQL, Redis & phpMyAdmin bằng Docker
Mở terminal tại thư mục gốc của đồ án (`BTL_DBMS`):
```bash
docker compose up -d
```
> Lệnh này sẽ tự động tải và khởi chạy 3 container:
> 1. **MySQL 8.0**: Chạy cổng host `3307` (User: `movie_user`, Pass: `movie_password`, DB: `movie_ticket_db`)
> 2. **Redis 7**: Chạy cổng `6379` (In-memory lock & caching)
> 3. **phpMyAdmin**: Chạy cổng `8080` (Giao diện xem và quản lý Database trực quan)

---

### Bước 2: Cài đặt thư viện Backend
Mở terminal và di chuyển vào thư mục `backend`:
```bash
cd backend
test -f .env || cp .env.example .env  # nếu chưa có .env
npm ci
```

Kiểm tra file `.env` (đã được cấu hình sẵn theo Docker):
```env
PORT=3000
DB_HOST=localhost
DB_PORT=3307
DB_USER=movie_user
DB_PASSWORD=movie_password
DB_NAME=movie_ticket_db

REDIS_HOST=localhost
REDIS_PORT=6379
JWT_SECRET=super_secret_jwt_key_movie_booking_2026
JWT_EXPIRATION=7d
SEAT_HOLD_TTL_SECONDS=300
```

---

### Bước 3: Nạp dữ liệu mẫu (Seed Data) & Chạy Server
Chạy lệnh seed để tự động tạo tài khoản Admin mẫu, Phim mẫu, Rạp, Phòng và ghế mẫu và các suất chiếu tương lai còn thiếu:
```bash
npm run seed
```

Khởi chạy server NestJS ở chế độ Hot-Reload:
```bash
npm run start:dev
```

---

## 📖 Địa chỉ các công cụ sau khi chạy

| Dịch vụ | Địa chỉ truy cập | Ghi chú |
| :--- | :--- | :--- |
| **Backend API** | `http://localhost:3000/api` | Tiền tố API toàn hệ thống |
| **Swagger API Docs** | `http://localhost:3000/api/docs` | Giao diện tương tác test mọi API |
| **phpMyAdmin (DB UI)** | `http://localhost:8080` | User: `root`, Pass: `rootpassword` |
| **Redis Server** | `localhost:6379` | Dùng cho khóa ghế tạm thời 5 phút |

---

## 🔑 Tài khoản đăng nhập mẫu (Seed Data)

| Vai trò | Email | Mật khẩu | Quyền hạn |
| :--- | :--- | :--- | :--- |
| **Admin (Quản trị viên)** | `admin@cinema.com` | `Admin@123` | Toàn quyền thêm phim, rạp, phòng, suất chiếu, xem thống kê |
| **Customer (Khách hàng)** | `customer@gmail.com` | `Admin@123` | Xem phim, chọn ghế, đặt vé, xem lịch sử, hủy vé |

> **Cách test với Swagger**:
> 1. Truy cập `http://localhost:3000/api/docs`.
> 2. Mở mục **Auth** -> Gọi endpoint `POST /api/auth/login` với tài khoản trên.
> 3. Copy chuỗi `accessToken` trả về trong JSON.
> 4. Nhấn nút **Authorize 🔓** ở góc trên cùng bên phải Swagger -> Dán token vào -> Bấm **Authorize**.
> 5. Bây giờ bạn có thể test mọi API yêu cầu bảo mật!

---

## 💡 Cấu trúc Source Code NestJS (`backend/src/`)

```
src/
├── main.ts                         # Cấu hình CORS, Global Pipes, Filters, Swagger Docs
├── app.module.ts                   # Module gốc liên kết tất cả các module
├── common/                         # Dùng chung cho toàn bộ dự án
│   ├── decorators/                 # @CurrentUser(), @Roles(), @Public()
│   ├── guards/                     # JwtAuthGuard, RolesGuard
│   ├── filters/                    # HttpExceptionFilter (Chuẩn hóa lỗi)
│   ├── interceptors/               # TransformResponseInterceptor (Chuẩn hóa response JSON)
│   └── enums/                      # UserRole, SeatType, SeatStatus, BookingStatus...
├── database/
│   ├── database.module.ts          # Kết nối TypeORM với MySQL
│   ├── entities/                   # User, Movie, Cinema, CinemaRoom, Seat, Showtime, Booking, Ticket
│   └── seeds/                      # SeedService nạp dữ liệu mẫu
└── modules/
    ├── redis/                      # RedisService: atomic lock, holdSeat (TTL 300s), releaseSeat
    ├── auth/                       # Đăng ký, đăng nhập JWT, quên mật khẩu (Hà & Định)
    ├── users/                      # Quản lý tài khoản người dùng
    ├── movies/                     # UC1: CRUD phim (Hà)
    ├── cinemas/                    # UC2: Quản lý cụm rạp, phòng chiếu (Hà)
    ├── seats/                      # UC3: Quản lý ghế & UC6: Ma trận trạng thái ghế (Quang & Vân)
    ├── showtimes/                  # UC4: Quản lý suất chiếu & kiểm tra trùng lịch (Quang)
    ├── search/                     # UC5: Tìm kiếm & lọc phim đa tiêu chí (Vân)
    ├── bookings/                   # UC7: Giữ ghế Redis TTL & UC8: Đặt vé Stripe (Định)
    ├── tickets/                    # UC9: Lịch sử đặt vé, hủy vé & hoàn tiền (Tuấn)
    └── statistics/                 # UC10: Thống kê KPIs, phim bán chạy, tỷ lệ lấp đầy ghế (Tuấn)
```

---

## 🛠️ Quy tắc Git & Hợp tác nhóm

1. **Không commit đè trực tiếp lên nhánh `main`**.
2. Mỗi người tạo nhánh riêng theo tính năng mình làm:
   ```bash
   # Ví dụ bạn Hà làm UC1
   git checkout -b feature/uc1-movies

   # Ví dụ bạn Quang làm UC3
   git checkout -b feature/uc3-seats

   # Ví dụ bạn Vân làm UC5
   git checkout -b feature/uc5-search
   ```
3. Trước khi commit và tạo Pull Request (PR), hãy đảm bảo chạy lệnh sau không có lỗi:
   ```bash
   npm run build
   ```
