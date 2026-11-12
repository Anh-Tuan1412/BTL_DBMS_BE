# Chạy backend cùng movie-fe

Yêu cầu: Node.js 24 LTS, npm, Docker Compose; checkout `BTL_DBMS_BE` và `movie-fe` cạnh nhau. Backend dùng cổng 3000, frontend 3001, MySQL host 3307 và Redis 6379.

```bash
cd BTL_DBMS_BE
docker compose up -d --wait mysql redis
cd backend
test -f .env || cp .env.example .env             # chỉ khi chưa có .env; giữ cấu hình hiện có
npm ci
npm run seed
npm run start:dev
```

Terminal khác:

```bash
cd movie-fe
test -f .env.local || cp .env.example .env.local   # giữ cấu hình hiện có
npm ci
npm run dev
```

MySQL nạp schema từ `backend/database/movie_ticket_db.sql` khi volume mới được tạo. SQL khai báo `SET NAMES utf8mb4`; kết nối TypeORM cũng dùng utf8mb4 và lưu thời gian UTC. Nếu container MySQL không đọc được file SQL do quyền file checkout, dùng bản sao có quyền đọc trong một Compose override cục bộ. Không xóa volume chứa dữ liệu cần giữ để khắc phục lỗi khởi tạo.

`npm run seed` chỉ bổ sung tài khoản/phim/rạp/phòng/ghế còn thiếu và suất chiếu tương lai theo giờ Việt Nam, không đặt lại mật khẩu tài khoản đã tồn tại và không tạo booking/thanh toán giả. Chạy lại seed không được nhân đôi lịch còn hiệu lực. Tài khoản phát triển được tạo khi chưa tồn tại:

| Vai trò | Email | Mật khẩu mẫu |
|---|---|---|
| Admin | admin@cinema.com | Admin@123 |
| Khách | customer@gmail.com | Admin@123 |

Đây là fixture phát triển; cấu hình JWT_SECRET riêng và tài khoản phù hợp trước khi triển khai thực tế. Sau bản cập nhật này, JWT cũ cần đăng nhập lại; thay đổi mật khẩu cũng làm JWT đã cấp hết hiệu lực.

## Hợp đồng dữ liệu

- `GET /api/genres`, `/api/cinemas`, `/api/showtimes` trả ID từ MySQL.
- `GET /api/search/movies` nhận `keyword`, `genre`, `cinemaId`, `date` (YYYY-MM-DD theo Việt Nam), `minPrice`, `maxPrice`, `status`. `data.items` chứa phim và các suất **SCHEDULED trong tương lai** thỏa bộ lọc, kèm phòng/rạp. Không có bộ lọc lịch thì vẫn trả phim chưa mở lịch.
- Trang quản trị dùng `/api/showtimes` để xem cả lịch cũ; bộ lọc ngày cũng theo Việt Nam.
- `GET /api/seats/matrix/showtime/:id` đọc ghế MySQL và Redis hold. Hold 300 giây; đọc lại không gia hạn TTL. Token giữ ghế chỉ được trả cho người giữ qua API giữ ghế.
- Booking giữ nguyên thời hạn còn lại của hold, tối đa đến giờ bắt đầu chiếu. Redis tự hết TTL; worker backend mỗi 15 giây cập nhật các booking quá hạn thành EXPIRED và dọn inventory MySQL bằng cùng transaction/khóa như luồng thanh toán. Đơn chưa thanh toán có thể hủy ngay, trả refundAmount=0 và giải phóng hold; điều kiện trước 60 phút áp dụng cho vé đã thanh toán.
- `PATCH /api/seats/:id` sửa hàng/cột/mã/loại ghế. Thêm/sinh/xóa ghế cũng khóa phòng và chỉ thực hiện trước khi mở lịch bán vé; số ghế khả dụng của phòng được cập nhật theo dữ liệu ghế thực tế. Không chuyển phòng bằng API này. Để bảo vệ giá và sơ đồ đang mở bán, phòng phải chưa có lịch tương lai và ghế chưa có lịch sử vé. Tên loại ghế/hệ số giá đọc từ `GET /api/seats/types`; client không tự đặt hệ số giá.
- Vé trả tên phòng ở `showtime.room.name`. Admin có thể xem/hủy vé khách theo cùng điều kiện trước suất chiếu ít nhất 60 phút; khách chỉ được thao tác vé của mình.
- `GET /api/statistics/daily-revenue` trả tối đa 90 ngày có booking thành công, gom ngày theo UTC+7; thống kê tháng cũng theo UTC+7.

## Xác thực email và mật khẩu

Đăng ký chỉ tạo CUSTOMER, trạng thái INACTIVE. OTP được tạo bằng nguồn ngẫu nhiên mật mã, lưu digest trong Redis 10 phút, giới hạn gửi lại 60 giây và tối đa 5 lần thử sai; mã hợp lệ chỉ dùng một lần.

- `POST /api/auth/register`: email, fullName, password (8–72 ký tự), phoneNumber tùy chọn.
- `POST /api/auth/verify-email`: email, otp (6 chữ số).
- `POST /api/auth/resend-verification`: email.
- `POST /api/auth/forgot-password`: email; trả thông báo chung để hạn chế lộ tài khoản.
- `PUT /api/auth/reset-password`: email, otp, newPassword.

Trong development/test, `EMAIL_DELIVERY=console` ghi mã vào log backend và frontend thông báo rõ cách lấy mã. Mã vẫn được kiểm tra thực sự trong Redis. Production không cho dùng console: cấu hình `EMAIL_DELIVERY=resend`, `EMAIL_API_KEY`, `EMAIL_FROM` qua môi trường bảo mật. Cho phép HTTPS tới `api.resend.com` khi môi trường giới hạn mạng. Không commit khóa hoặc file .env. Production email cần tài khoản/domain gửi đã được xác minh với nhà cung cấp; kiểm thử tự động thay dịch vụ gửi email bằng adapter ghi nhận mã và vẫn dùng MySQL/Redis thật.

API không cung cấp refresh token; frontend đăng nhập lại khi JWT hết hiệu lực. Thông tin tài khoản bị khóa và mật khẩu mới được kiểm tra trên mỗi yêu cầu; hash mật khẩu không được trả về client.

## Stripe

Đặt `STRIPE_SECRET_KEY` ở chế độ test và `FRONTEND_URL` đúng origin frontend. Cấu hình Stripe CLI/webhook theo `backend/STRIPE_TEST_MODE.md`, cùng `STRIPE_WEBHOOK_SECRET`. Backend dùng `api.stripe.com`; cần cho phép miền này khi có chính sách mạng hạn chế. Với Node 24 trong môi trường proxy, khởi chạy với `NODE_USE_ENV_PROXY=1` và giữ CA/proxy được cung cấp.

Luồng mặc định tạo booking MySQL và Stripe Checkout thật ở test mode. Mock payment chỉ được bật khi **cả** NODE_ENV=test và ALLOW_MOCK_PAYMENTS=true, dành cho kiểm thử transaction; không bật cho server phát triển. Trang demo frontend có nhãn và không gọi API booking/thanh toán.

## Kiểm tra

```bash
cd backend
npm run build
npm test -- --runInBand
npm run test:e2e -- --runInBand   # MySQL/Redis phải đang chạy, schema đã nạp
npm run test:encoding
```

Test tích hợp tạo fixture riêng và xóa theo đúng ID sau khi chạy, không flush Redis hay truncate bảng dùng chung. Test Stripe UI là tùy chọn khi có khóa Stripe và thao tác thanh toán test; các test mặc định không chứng minh giao dịch Stripe thực đã thành công.

Frontend có `npm run lint`, `npm run test:api`, `npm run build`, `npm run test:e2e`; xem README của movie-fe. Nên chạy kiểm thử trình duyệt với bản production đã build, và tránh build khi dev/start server đang dùng cùng thư mục .next.

## Dữ liệu đã bị sai encoding do lần nạp cũ

Sao lưu DB trước. Xem trước bằng `npm run repair:encoding`, kiểm tra các bảng/ID/cột được liệt kê rồi mới dùng `npm run repair:encoding -- --apply`. Công cụ không in giá trị ô, chạy trong transaction và hợp nhất quan hệ thể loại bị trùng do lỗi encoding. Văn bản Việt đúng, ASCII và chuỗi không thể chuyển đổi an toàn được giữ nguyên. Không dùng thay cho việc xem xét dữ liệu có chủ ý chứa chuỗi giống lỗi encoding. Chạy lại dry-run sau sửa phải không còn thay đổi.
