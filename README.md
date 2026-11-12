# 🎬 Movie Ticket Booking System using MySQL and Redis (BTL DBMS HCMUT)

> Hệ thống Đặt Vé Xem Phim Trực Tuyến áp dụng công nghệ **NestJS**, **MySQL** và **Redis**.

Hướng dẫn chạy đồng bộ với frontend, cấu hình OTP/Stripe và kiểm thử: [INTEGRATION.md](INTEGRATION.md).

## 👥 Nhóm Thực Hiện
- **Quách Văn Hà** (MSSV: 2410858)
- **Đặng Minh Quang** (MSSV: 2312785)
- **Nguyễn Thị Cẩm Vân** (MSSV: 2313870)
- **Định**
- **Mai Anh Tuấn** (MSSV: 2313739)

---

## ⚡ Bắt đầu nhanh trong 1 phút

1. **Khởi động Database & Redis:**
   ```bash
   docker compose up -d
   ```
   - MySQL 8.0: `localhost:3307`
   - Redis: `localhost:6379`
   - phpMyAdmin (Giao diện xem DB): `http://localhost:8080` (User: `root`, Pass: `rootpassword`)

2. **Khởi động Backend NestJS:**
   ```bash
   cd backend
   test -f .env || cp .env.example .env   # chỉ khi chưa có cấu hình
   npm ci
   npm run seed       # Nạp tài khoản Admin mẫu, Phim, Rạp, Ghế mẫu
   npm run start:dev  # Khởi chạy server
   ```
   - API Docs (Swagger): `http://localhost:3000/api/docs`

👉 **Xem hướng dẫn chi tiết về cấu trúc code và phân công nhiệm vụ từng người tại:** [backend/README.md](backend/README.md)
