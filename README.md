# Ứng Dụng Tích Tiểu Thành Đại (Theo Dõi Mục Tiêu & Tích Luỹ Tiền Mỗi Ngày)

Ứng dụng web hiện đại giúp bạn đặt mục tiêu tài chính, tạo nhiều quỹ khác nhau, đánh dấu số tiền kiếm được mỗi ngày, và tự động tính toán chính xác phần trăm (`%`) đã đạt được cùng dự báo ngày hoàn thành.

---

## 🌟 Tính Năng Nổi Bật

1. **Quản lý đa quỹ mục tiêu**:
   - Tạo không giới hạn các quỹ mục tiêu tài chính (ví dụ: *Quỹ đổi iPhone 16 Pro, Mua xe mới, Du lịch, Quỹ khẩn cấp, Tự do tài chính 100 triệu*...).
   - Đặt số tiền mục tiêu (VNĐ), biểu tượng Emoji sinh động, hạn chót (deadline) và lời nhắn nhủ tạo động lực.
   - Dễ dàng chuyển đổi giữa các quỹ chỉ với một cú nhấp chuột.

2. **Đánh dấu số tiền kiếm được mỗi ngày**:
   - Ghi nhận số tiền kiếm được trong ngày nhanh chóng.
   - Các nút cộng nhanh tiện lợi: `+20K`, `+50K`, `+100K`, `+200K`, `+500K`, `+1TR`.
   - Ghi chú nguồn tiền (ví dụ: *Tiền làm thêm, tiền lương, tiền tip, nhịn cafe...*) và chọn ngày nạp.
   - Hỗ trợ rút bớt nếu có chi tiêu phát sinh đột xuất.

3. **Tính toán % và tiến độ thông minh**:
   - Vòng tròn tiến độ phát sáng (Radial Progress Ring) hiển thị số `%` trực quan theo thời gian thực.
   - Thanh tiến độ tuyến tính với các cột mốc: `25%` (Khởi động), `50%` (Nửa chặng), `75%` (Tăng tốc), `100%` (Về đích).
   - Thống kê 3 chỉ số tài chính cốt lõi: **Số Tiền Đã Tích Luỹ**, **Mục Tiêu Đặt Ra**, và **Còn Thiếu Cần Kiếm**.

4. **Phân tích & Ước tính thực tế**:
   - **Trung bình mỗi lần nạp**: Tính toán số tiền bình quân trên các lần nạp vào quỹ (không áp đặt tính theo ngày, tránh hiểu lầm).
   - **Ước tính cần thêm**: Dự tính số lần nạp tiếp theo cần đạt được để hoàn tất mục tiêu.
   - **Khoản nạp lớn nhất**: Ghi nhận kỷ lục khoản nạp cao nhất trong 1 lần.
   - **Hạn chót mục tiêu**: Theo dõi sát sao ngày hoàn thành do người dùng tự đặt ra (hoặc linh hoạt tự do).

5. **Đồng bộ đa thiết bị (PC & Điện thoại)**:
   - **Đồng bộ Cloud tự động thời gian thực (Firebase Realtime DB)**: Cập nhật 2 chiều tức thì (dưới 0.2s) giữa máy tính và điện thoại.
   - **Mã QR & Link 1-Click**: Mở camera điện thoại quét mã QR trên màn hình PC là tự động kết nối và đồng bộ ngay lập tức, không cần nhập lại bất cứ thông tin nào!
   - **Mã Đồng Bộ (PIN 6 số)**: Bảo mật và độc lập cho từng phòng dữ liệu cá nhân.

6. **Hiệu ứng & Trải nghiệm đỉnh cao**:
   - Pháo hoa giấy (Confetti) chúc mừng khi nạp tiền và đạt mốc 100%.
   - Âm thanh tích tắc xu vui nhộn (tổng hợp trực tiếp qua Web Audio API, không cần tải file ngoài).
   - Giao diện Dark Mode huyền bí và Light Mode trang nhã.
   - Tự động lưu toàn bộ dữ liệu vào `localStorage` của trình duyệt.
   - Có tính năng **Sao lưu JSON** và **Khôi phục** bất kỳ lúc nào.

---

## 🚀 Hướng Dẫn Sử Dụng & Đồng Bộ

### Cách 1: Mở trực tiếp trên PC
Chỉ cần nhấp đúp vào file [index.html](file:///c:/Users/Admin/Downloads/Discord%20Tool/tichtien/index.html) bằng bất kỳ trình duyệt nào (Chrome, Edge, Cốc Cốc, Brave, Safari).

### Cách 2: Đồng bộ lên Điện thoại qua Cloud (Khuyên dùng)
1. Bấm nút **"Đồng Bộ Cloud"** ở góc trên thanh công cụ.
2. Nhập Mã PIN (ví dụ: `829104`) và đường dẫn Firebase Database miễn phí (có hướng dẫn 3 bước ngay trong cửa sổ).
3. Bấm **Kết Nối**. Màn hình sẽ hiện mã **QR Code**.
4. Lấy điện thoại mở Camera quét mã QR để mở trang web -> Dữ liệu trên PC và điện thoại sẽ tự động đồng bộ thời gian thực mỗi khi bạn nạp tiền!

### Cách 3: Chạy máy chủ mạng Wi-Fi nội bộ
Nếu muốn điện thoại truy cập trực tiếp qua cùng mạng Wi-Fi trong nhà:
Mở PowerShell trong thư mục dự án và chạy:
```powershell
python server.py
```
Màn hình sẽ hiển thị địa chỉ IP (ví dụ `http://192.168.1.15:5544`), chỉ cần nhập địa chỉ đó vào trình duyệt điện thoại là xong!

---

## 📁 Cấu Trúc Dự Án
```
tichtien/
├── index.html        # Giao diện chính chuẩn HTML5 ngữ nghĩa & SEO
├── css/
│   └── style.css     # Thiết kế giao diện Glassmorphism, animations & dark/light theme
├── js/
│   └── app.js        # Logic quản lý quỹ, tính toán %, streak, âm thanh & lưu trữ
└── README.md         # Hướng dẫn chi tiết
```
