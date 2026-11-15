# Hướng dẫn chạy và demo trên máy cá nhân

Hệ thống dùng MySQL để lưu dữ liệu nghiệp vụ, Redis để giữ ghế và lưu OTP, Stripe Test Mode để thử thanh toán.

Hướng dẫn dưới đây dùng Windows PowerShell và file `compose.test.yml`.

## 1. Chuẩn bị

Cần cài:

- Node.js 24 LTS và npm.
- Docker Desktop, đã khởi động.
- Stripe CLI nếu muốn thử thanh toán.

Ví dụ cấu trúc thư mục:

```text
movie-test/
├── BTL_DBMS_BE/
│   ├── compose.test.yml
│   ├── LOCAL_DEMO.md
│   └── backend/
└── movie-fe/
```

Các cổng được sử dụng:

| Thành phần | Địa chỉ/cổng trên máy |
|---|---|
| Frontend | http://localhost:3001 |
| Backend | http://localhost:3000 |
| MySQL | 127.0.0.1:3317 |
| Redis | 127.0.0.1:6387 |
| phpMyAdmin | http://localhost:8080 |

Các lệnh Docker trong tài liệu phải chạy tại thư mục gốc repo BE, nơi chứa `compose.test.yml`.

## 2. Khởi động MySQL, Redis và phpMyAdmin

Kiểm tra đường dẫn mount SQL trong `compose.test.yml`:

```yaml
- ./backend/database/movie_ticket_db.sql:/docker-entrypoint-initdb.d/01-schema.sql:ro
```

Tại thư mục gốc repo BE, chạy:

```powershell
docker compose -p movie-zip-test -f compose.test.yml up -d --wait
```

Kiểm tra các container:

```powershell
docker compose -p movie-zip-test -f compose.test.yml ps
```

Nếu trước đây đã dùng bản Compose nằm ở thư mục `movie-test`, giữ cùng project `movie-zip-test` và tên volume `mysql_test` để dùng lại dữ liệu MySQL hiện có.

## 3. Cấu hình môi trường

### Backend

Tại thư mục gốc repo BE, tạo `.env` nếu chưa có:

```powershell
if (-not (Test-Path .\backend\.env)) {
    Copy-Item .\backend\.env.example .\backend\.env
}
```

Mở `backend/.env`, giữ các biến cần thiết trong file mẫu và chỉnh:

```env
PORT=3000
NODE_ENV=development

DB_HOST=127.0.0.1
DB_PORT=3317
DB_USERNAME=movie_user
DB_PASSWORD=movie_password
DB_NAME=movie_ticket_db

REDIS_HOST=127.0.0.1
REDIS_PORT=6387
REDIS_PASSWORD=

FRONTEND_URL=http://localhost:3001
EMAIL_DELIVERY=console

STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
```

Đặt `JWT_SECRET` riêng trong `.env`.

Thông tin MySQL trên tương ứng với tài khoản phát triển trong `compose.test.yml`. Nếu đã thay tài khoản Docker thì cập nhật backend cho khớp.

### Frontend

Mở terminal khác tại thư mục gốc repo `movie-fe`, tạo `.env.local` nếu chưa có:

```powershell
if (-not (Test-Path .env.local)) {
    Copy-Item .env.example .env.local
}
```

Nội dung cấu hình API:

```env
NEXT_PUBLIC_API_URL=http://localhost:3000
```

Không commit `.env`, `.env.local` hoặc các khóa riêng lên GitHub. Repo chỉ lưu file cấu hình mẫu.

## 4. Cấu hình Stripe Test Mode

Có thể chạy các chức năng xem phim và giữ ghế trước khi cấu hình Stripe. Để hoàn tất thanh toán, cần thực hiện các bước sau.

### Cài và đăng nhập Stripe CLI

Tải Stripe CLI từ:

https://github.com/stripe/stripe-cli/releases/latest

Chọn bản phù hợp với máy. Với Windows Intel/AMD 64-bit, chọn file dạng:

```text
stripe_<version>_windows_x86_64.zip
```

Giải nén để có file:

```text
%USERPROFILE%\Tools\stripe\stripe.exe
```

Trong PowerShell, kiểm tra và đăng nhập:

```powershell
& "$env:USERPROFILE\Tools\stripe\stripe.exe" --version
& "$env:USERPROFILE\Tools\stripe\stripe.exe" login
```

Làm theo hướng dẫn trên trình duyệt để cấp quyền. Thường chỉ cần đăng nhập lần đầu; đăng nhập lại khi CLI yêu cầu hoặc khi đổi tài khoản/sandbox.

### Lấy Secret key

Đăng nhập Stripe Dashboard, chọn môi trường Test/Sandbox, mở mục API keys và lấy Secret key bắt đầu bằng `sk_test_`.

Điền vào `backend/.env`:

```env
STRIPE_SECRET_KEY=sk_test_...
```

Thay toàn bộ giá trị mẫu bằng khóa test thực tế. Dashboard và Stripe CLI phải dùng cùng tài khoản/sandbox.

### Chạy webhook

Mở một terminal riêng và chạy:

```powershell
& "$env:USERPROFILE\Tools\stripe\stripe.exe" listen --events "checkout.session.completed,checkout.session.async_payment_succeeded" --forward-to http://localhost:3000/api/bookings/stripe/webhook
```

Chờ thông báo `Ready!` cùng khóa bắt đầu bằng `whsec_`.

Sao chép khóa đó vào `backend/.env`:

```env
STRIPE_WEBHOOK_SECRET=whsec_...
```

Giữ terminal Stripe CLI chạy trong lúc thử thanh toán.

Hai khóa thường được giữ nguyên qua các lần chạy. Nếu CLI hiển thị `whsec_` khác với giá trị trong `.env`, cập nhật lại. Sau khi sửa `.env`, khởi động lại backend.

## 5. Cài dependency, seed và chạy ứng dụng

### Terminal backend

Mở terminal tại thư mục gốc repo BE:

```powershell
cd backend
npm ci
npm run seed
npm run start:dev
```

Giữ terminal chạy.

Kiểm tra API tại:

http://localhost:3000/api/movies

### Terminal frontend

Tại thư mục gốc repo FE:

```powershell
npm ci
npm run dev
```

Mở:

http://localhost:3001

`npm ci` dùng khi mới cài hoặc khi dependency thay đổi, không cần chạy lại mỗi lần mở ứng dụng.

### Dữ liệu khởi tạo

Có hai bước riêng:

- `backend/database/movie_ticket_db.sql` tạo bảng và nạp dữ liệu ban đầu khi MySQL khởi tạo volume mới.
- `npm run seed` chạy `seed.service.ts`, bổ sung dữ liệu còn thiếu và suất chiếu tương lai.

`npm run seed` không import lại file SQL. Seed giữ dữ liệu đã tồn tại, không đặt lại mật khẩu tài khoản cũ và không tạo booking/thanh toán giả.

Nếu không còn suất chiếu tương lai, có thể chạy lại seed.

Dữ liệu đang sử dụng được lưu trong MySQL và Docker volume; website đọc từ backend API.

### Tài khoản phát triển

Seed tạo các tài khoản sau nếu chưa tồn tại:

| Vai trò | Email | Mật khẩu mẫu |
|---|---|---|
| Admin | admin@cinema.com | Admin@123 |
| Khách hàng | customer@gmail.com | Admin@123 |

Nếu tài khoản đã có mật khẩu khác, seed không đổi lại mật khẩu.

Với `EMAIL_DELIVERY=console`, mã OTP đăng ký hoặc đặt lại mật khẩu xuất hiện trong terminal backend.

## 6. Thử thanh toán

Đảm bảo Docker, backend, frontend và Stripe CLI đều đang chạy.

1. Mở http://localhost:3001.
2. Đăng nhập.
3. Chọn phim và suất chiếu trong tương lai.
4. Chọn ghế rồi tiếp tục đặt vé, thanh toán.
5. Hoàn tất trong thời gian giữ ghế tối đa 5 phút.
6. Trên trang Stripe, nhập thẻ test:

| Trường | Giá trị |
|---|---|
| Số thẻ | 4242 4242 4242 4242 |
| Ngày hết hạn | Một ngày trong tương lai, ví dụ 12/30 |
| CVC | 123 |

Sau khi Stripe gửi webhook hợp lệ, backend cập nhật trạng thái booking và thanh toán. Kiểm tra kết quả tại mục Vé của tôi.

Stripe Test Mode không trừ tiền thật. Booking và trạng thái thanh toán vẫn được lưu trong MySQL.

Dùng luồng mặc định để demo dữ liệu thật. Các trang có `demo=1` trong URL là chế độ minh họa, không tạo booking/thanh toán thật.

## 7. Xem dữ liệu bằng phpMyAdmin

Mở:

http://localhost:8080

Theo cấu hình phát triển đã thống nhất:

| Trường | Giá trị |
|---|---|
| Máy chủ, nếu có hỏi | mysql |
| Tên đăng nhập | movie_user |
| Mật khẩu | movie_password |

Chọn database `movie_ticket_db`.

Các bảng có thể kiểm tra:

- `movies`: phim.
- `cinemas`, `rooms`, `seats`: rạp, phòng và ghế.
- `showtimes`: suất chiếu.
- `bookings`: booking.
- `booking_details`: chi tiết vé.
- `payments`: thanh toán.

Cách demo:

1. Thêm hoặc sửa phim trên trang quản trị.
2. Mở bảng `movies` trong phpMyAdmin và làm mới để thấy thay đổi.
3. Đặt vé và thanh toán Stripe Test.
4. Kiểm tra các bản ghi tương ứng trong `bookings`, `booking_details` và `payments`.

phpMyAdmin kết nối MySQL bằng tên dịch vụ `mysql` và cổng nội bộ `3306`. Backend chạy trên Windows dùng cổng đã publish là `3317`.

## 8. Xem và demo dữ liệu Redis

Redis CLI đã có trong container Redis, không cần cài thêm hoặc sửa `.env` để mở công cụ này.

Tại thư mục gốc repo BE:

```powershell
docker compose -p movie-zip-test -f compose.test.yml exec redis redis-cli
```

Khi thấy prompt `127.0.0.1:6379>`, nhập các lệnh Redis bên dưới. Cổng `6379` là cổng nội bộ container.

### Liệt kê key giữ ghế

Đăng nhập trên website và chọn một ghế, sau đó chạy:

```text
SCAN 0 MATCH "seat_lock:*" COUNT 100
```

Kết quả có hai phần:

- Con trỏ cho lượt tiếp theo.
- Danh sách key tìm được.

Con trỏ `0` nghĩa là đã duyệt hết. Nếu khác `0`, tiếp tục dùng con trỏ đó, ví dụ:

```text
SCAN 12 MATCH "seat_lock:*" COUNT 100
```

`COUNT 100` là gợi ý số phần tử duyệt mỗi lượt, không bắt buộc trả đúng 100 key.

### Kiểm tra key và TTL

Ví dụ SCAN trả về:

```text
seat_lock:showtime:14:seat:392
```

Key này tương ứng suất chiếu ID 14 và ghế ID 392. ID ghế không phải nhãn ghế trên giao diện.

Thay key trong các lệnh sau bằng key thực tế từ SCAN:

```text
EXISTS seat_lock:showtime:14:seat:392
TTL seat_lock:showtime:14:seat:392
```

Ý nghĩa:

| Kết quả | Ý nghĩa |
|---|---|
| EXISTS trả 1 | Key tồn tại |
| EXISTS trả 0 | Key không tồn tại |
| TTL là số dương | Số giây còn lại |
| TTL trả -2 | Key không tồn tại |
| TTL trả -1 | Key tồn tại nhưng không có thời hạn |

Chạy lại TTL sau vài giây để thấy thời gian giảm. Đọc TTL không gia hạn giữ ghế.

### Kịch bản demo

1. Trước khi chọn ghế, kiểm tra danh sách key.
2. Tài khoản A chọn một ghế trên website.
3. SCAN thấy key giữ ghế xuất hiện.
4. EXISTS trả 1, TTL trả số giây còn lại và giảm dần.
5. Để nguyên ghế đã chọn, chờ hết thời gian giữ.
6. TTL trả -2 và EXISTS trả 0 sau khi key hết hạn.

Có thể dùng một trình duyệt thường và một cửa sổ ẩn danh, đăng nhập hai tài khoản khác nhau để kiểm tra cùng chọn một ghế. Khi A đang giữ, B không thể giữ cùng ghế. Sau khi hết hạn và sơ đồ được cập nhật, B có thể chọn ghế.

Nếu A chủ động bỏ chọn ghế, key cũng được giải phóng. Đây là demo nhả ghế chủ động, khác với chờ TTL tự hết hạn.

Nhập lệnh sau để thoát Redis CLI:

```text
exit
```

Thoát CLI không dừng dịch vụ Redis.

## 9. Bật và tắt cho những lần sử dụng sau

### Bật Docker

Tại thư mục gốc repo BE:

```powershell
docker compose -p movie-zip-test -f compose.test.yml up -d --wait
```

Sau đó mở các terminal cần thiết:

- Backend, tại thư mục `backend`: `npm run start:dev`.
- Frontend, tại thư mục repo FE: `npm run dev`.
- Stripe CLI: chạy lại lệnh webhook ở mục 4 nếu muốn thử thanh toán.

Redis CLI chỉ mở khi cần xem hoặc demo dữ liệu Redis.

### Dừng

Dừng backend, frontend và Stripe CLI bằng `Ctrl+C` tại từng terminal.

Tại thư mục gốc repo BE, dừng các dịch vụ Docker:

```powershell
docker compose -p movie-zip-test -f compose.test.yml stop
```

Lần sau dùng lại `up -d --wait` để bật.

Quy trình này giữ dữ liệu MySQL trong volume. Không dùng `down -v` khi muốn giữ dữ liệu, vì tùy chọn `-v` xóa các volume do Compose quản lý.

## 10. Kiểm tra khi gặp lỗi

- Không mở được phpMyAdmin: kiểm tra dịch vụ `phpmyadmin` bằng lệnh Compose `ps`, đồng thời kiểm tra cổng 8080.
- Backend không kết nối DB: kiểm tra MySQL/Redis đã chạy và các cổng trong `.env` là 3317/6387 theo bộ Compose này.
- Stripe thanh toán xong nhưng vé chưa cập nhật: kiểm tra terminal webhook, khóa `whsec_`, log backend và thời hạn giữ ghế.
- Redis không có key: kiểm tra đang chọn ghế trong luồng thật; key có thể đã hết hạn hoặc được nhả.
- Sửa file SQL nhưng dữ liệu cũ không đổi: SQL khởi tạo chỉ tự chạy khi volume MySQL mới được tạo. Không xóa volume đang dùng để cập nhật dữ liệu.
