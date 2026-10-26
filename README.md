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

4. **Phân tích & Dự báo**:
   - **Tốc độ trung bình mỗi ngày**: Tính toán lượng tiền tích lũy bình quân.
   - **Số ngày cần tiếp tục**: Dự báo số ngày còn lại để cán đích.
   - **Ngày dự kiến hoàn thành**: Ước tính chính xác ngày về đích 100%.
   - **Chuỗi tích lũy liên tiếp (Streak 🔥)**: Giúp rèn luyện thói quen kỷ luật tài chính mỗi ngày.

5. **Hiệu ứng & Trải nghiệm đỉnh cao**:
   - Pháo hoa giấy (Confetti) chúc mừng khi nạp tiền và đạt mốc 100%.
   - Âm thanh tích tắc xu vui nhộn (tổng hợp trực tiếp qua Web Audio API, không cần tải file ngoài).
   - Giao diện Dark Mode huyền bí và Light Mode trang nhã.
   - Tự động lưu toàn bộ dữ liệu vào `localStorage` của trình duyệt.
   - Có tính năng **Sao lưu JSON** và **Khôi phục** bất kỳ lúc nào.

---

## 🚀 Hướng Dẫn Sử Dụng

### Cách 1: Mở trực tiếp bằng trình duyệt
Chỉ cần nhấp đúp vào file [index.html](file:///c:/Users/Admin/Downloads/Discord%20Tool/tichtien/index.html) bằng bất kỳ trình duyệt nào (Chrome, Edge, Cốc Cốc, Brave, Safari, Firefox).

### Cách 2: Khởi chạy Web Server cục bộ
Mở PowerShell trong thư mục dự án và chạy:
```powershell
python -m http.server 5533
```
Sau đó truy cập: `http://localhost:5533`

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
