# Một Ngày Bị Lừa

Game 3D góc nhìn thứ ba chạy trên trình duyệt (three.js). Thư mục này gồm game (`index.html`, `js/`, `sfx/`) và một server nhỏ (`server.js`) vừa phục vụ file tĩnh vừa chuyển tiếp WebSocket cho chế độ chơi nhiều người.

## Yêu cầu

- **Node.js 18 trở lên** (đã chạy thử với Node 24). Không cần `npm install`: server chỉ dùng module có sẵn của Node.
- **Kết nối Internet** khi mở game: three.js được tải từ `cdnjs.cloudflare.com`.
- Trình duyệt mới (Chrome, Edge, Firefox, Safari) có hỗ trợ WebGL.

Kiểm tra Node:

```sh
node -v
```

## Chạy game

Mở terminal trong thư mục dự án rồi chạy:

```sh
node server.js
```

Khi thấy dòng

```
Một Ngày Bị Lừa — http://localhost:8765  (WebSocket: /ws)
```

thì mở trình duyệt vào **http://localhost:8765**.

Dừng server: bấm `Ctrl + C` trong terminal.

### Đổi cổng

Mặc định là cổng `8765`. Muốn dùng cổng khác, đặt biến môi trường `PORT`:

| Shell | Lệnh |
| --- | --- |
| PowerShell | `$env:PORT = 9000; node server.js` |
| CMD | `set PORT=9000 && node server.js` |
| Git Bash / macOS / Linux | `PORT=9000 node server.js` |

### Kiểm tra server

- `http://localhost:8765/healthz` trả về `ok`.
- `http://localhost:8765/api/rooms` trả về danh sách phòng (P1–P6) dạng JSON.

## Chơi nhiều người

Chế độ đội cần 2–6 người mỗi phòng, không cần đăng ký. Nếu chỉ có một mình, chọn **“Chơi ngay với bot”** ở sảnh, hoặc chủ phòng bấm **“+ Thêm bot”** trong phòng chờ.

### Bản đồ

Chủ phòng chọn bản đồ trong phòng chờ, cả phòng thấy lựa chọn ngay. Có đủ 4 bản đồ Campuchia như khi chơi một mình, cùng chuyến bay về Việt Nam, và bản đồ thứ 5 chỉ có khi chơi nhiều người: **Myanmar**, map khó nhất (xem bên dưới). Nhiệm vụ giống đêm trốn thoát của chương đó, nhưng những phần khó phải 2 người cùng làm:

| Bản đồ | Bắt đầu | Việc cần 2 người | Bị bắt thì trói ở | Thắng khi |
| --- | --- | --- | --- | --- |
| **Đặc khu S-7** (Sihanoukville) | ký túc | giữ chân thang · rung cổng sắt dụ gác · 2 người nâng cửa cuốn nhà kho · giữ cầu dao để cắt lưới B40 | cột giữa sân | cả đội ra tới đường lớn |
| **Trại rừng** | cả đội chung một lồng sắt | giữ cửa lồng để cạy khóa · rung bụi tre dụ gác hiên nhà trùm · xoay chảo ăng-ten để gửi tin cầu cứu. Sau đó chia nhau mở 4 lồng còn lại | gốc cây gần đống lửa | cả đội qua đầm lầy ra bờ suối |
| **Lò gạch** | cả đội bị xích chung một cột trong nhà giam | giữ xích để lấy chìa khóa của tên gác ngủ · 2 người kéo cần gạt máy phát · giữ chồng gạch để kê cao sát rào tây. Trước đó chia nhau mở 4 phòng giam | cột giữa bãi phơi gạch | vượt rào, qua Bến sông, bay về Việt Nam gặp bố mẹ |
| **Bến sông** (chơi thẳng đoạn trốn thoát) | chân rào phía tây lò gạch | đỡ người bị gục dậy (giữ E) · tàu chỉ rời bến khi đủ người | không trói: gục tại chỗ | cả đội lên tàu rồi bay về Việt Nam gặp bố mẹ |
| **Myanmar** (map khó nhất, 39 nhiệm vụ) | chạy ra tàu ông Tư như Bến sông | gần như mọi việc: giữ chỗ, cùng giữ, giữ 2 điểm xa nhau cùng lúc, vác đồ, dìu người | cột trong khu giam, cột giữa sân, gốc cây ven đường mòn | qua sông Moei sang Thái Lan rồi bay về Việt Nam |

Bot làm được phần hỗ trợ ở cả 5 bản đồ. Bot giữ chỗ, dụ gác, cùng giữ E, chia nhau mở lồng hoặc phòng giam, và cởi trói cho đồng đội. Server phải chạy đúng bản `server.js` đi kèm. Sau khi cập nhật code thì khởi động lại server.

### Myanmar · Khu Sương Đen (map khó nhất)

Ghi chú ở sảnh tạo phòng, trong thẻ bản đồ và danh sách phòng nói rõ: **39 nhiệm vụ, 7 chặng, thường mất 45–90 phút**, để cả đội cân nhắc trước khi chọn.

- **Cốt truyện:** cả đội chạy ra tàu như map Bến sông. Trên tàu, ông Tư khui sẵn nước giải khát cho từng người. Uống xong cả đội lịm đi. Ông Tư hóa ra là người của băng lừa đảo Campuchia và bán cả đội sang “Khu Sương Đen”, một sào huyệt bên Myanmar liên kết với băng đó. Tên khu, tên người đều là hư cấu.
- **7 chặng:** Bến sông → Phòng giam (5 nhiệm vụ) → Tòa nhà lừa đảo (7) → Điện và ăng-ten (8) → Cứu người, lấy bằng chứng (10) → Rừng biên giới và sông Moei (7) → Về nhà qua Bangkok.
- **Kiểu nhiệm vụ:** giữ chỗ cho đồng đội, 2 người cùng giữ, giữ 2 điểm xa nhau cùng lúc, tìm mã rải rác, bấm mã, nhớ tín hiệu, dò tần số, chọn đúng kẻ chỉ điểm theo lời khai, trả lời câu hỏi chống lừa đảo, vác đồ (đi chậm, không chạy được), dìu người bị thương, vặn 3 van trong 28 giây, cả đội cùng chèo bè.
- **Mã và thứ tự đổi mỗi ván**, mỗi lần làm lại cũng đổi. Trả lời sai là báo động: lính gần đó kéo tới, đồng hồ mất 15 giây.
- **Câu đố không phải chỗ trốn:** đứng giải câu đố vẫn bị lính nhìn thấy. Có người thấy thì khung câu đố báo đỏ. Đóng lại (nút Đóng, Esc, W hoặc S) rồi chạy.
- **Kiên trì:** hết giờ hoặc cả đội bị trói thì cả đội làm lại chặng đang chơi, không phải từ đầu. Màn kết có số lần làm lại.
- **Lưu tiến độ:** mỗi trình duyệt nhớ chặng xa nhất đã tới. Lần sau chủ phòng chọn “Bắt đầu từ: Chơi tiếp” trong phòng chờ.
- **Bot** làm được phần hỗ trợ, tự tránh khi bị lính nhìn. Câu đố, lần dải vải và hỏi nhân chứng thì người thật phải làm.
- Map này cần bản `server.js` mới. Máy chủ còn chạy bản cũ thì thẻ Myanmar bị khóa và ghi “cần khởi động lại”, 4 map kia vẫn chơi bình thường.
- Code: `js/myanmar.js` (cách chạy), `js/myanmar_missions.js` (nhiệm vụ), `js/levels/myanmar.js` (khu và rừng biên giới), `js/panel.js` (các câu đố).

### Chặng trốn thoát của cả đội

- **Vượt rào:** ở Lò gạch, kê gạch xong thì ai cũng tự giữ E để leo. Đã qua rào vẫn leo lại vào được để cởi trói cho đồng đội.
- **Bị đuổi:** mỗi người có 6 điểm sức lực. Hết điểm hoặc bị tóm thì gục. Đồng đội giữ E 1,5 giây để đỡ dậy, hoặc tự dậy sau 10 giây. Đang đỡ người khác thì không bị tóm. Cả đội gục cùng lúc là thua.
- **Số kẻ đuổi:** Ít 6, Bình thường 10, Đông 13. Mưa làm chúng ném kém chính xác.
- **Phim cắt cảnh** tự chạy, không cần bấm, cả đội xem cùng lúc. Tạm dừng thì phim cũng dừng.
- **Rời phòng:** chủ phòng thoát giữa chừng thì người kế tiếp điều khiển tiếp. Tàu đã rời bến thì người còn lại vẫn xem được tới màn về nhà.

### Cùng mạng Wi-Fi / LAN

1. Chạy `node server.js` trên máy chủ.
2. Tìm IP nội bộ của máy đó (Windows: `ipconfig`, xem dòng `IPv4 Address`, ví dụ `192.168.1.20`).
3. Các máy khác mở `http://192.168.1.20:8765`.
4. Lần đầu chạy, Windows có thể hỏi cho phép Node.js qua tường lửa: chọn cho phép với mạng **Private**.

### Khác mạng (qua ngrok)

1. Cài [ngrok](https://ngrok.com/download) và đăng nhập (`ngrok config add-authtoken <token>`).
2. Chạy server như trên, rồi mở terminal thứ hai:

   ```sh
   ngrok http 8765
   ```

3. Gửi đường link `https://….ngrok-free.app` mà ngrok in ra cho bạn bè.

Lưu ý: gói miễn phí của ngrok cho link mới mỗi lần chạy lại, nên phải gửi lại link. Không dùng được tùy chọn `--url` với tên miền riêng trên tài khoản hiện tại (lỗi `ERR_NGROK_313`).

## Lính canh và chó

- Ban đêm lính cầm đèn pin, chó đeo đèn trên lưng. Cả hai chiếu theo hướng đang nhìn.
- Vòng nét đứt quanh chó là tầm đánh hơi, mọi hướng: 6,5 m khi đứng, 2,2 m khi cúi.
- Ban ngày không bật đèn.

Chơi một mình:

- Thanh “Nghi ngờ” đầy nhanh (khoảng 1 giây), lính và chó quay theo rồi đuổi.
- Ban đêm bản đồ nhỏ vẽ hình quạt: lính 13 m, chó 10,4 m. Ban ngày không vẽ.

Chơi nhiều người, cả ngày lẫn đêm:

- Lính và chó chỉ bắt sau khoảng **5 giây** người chơi ở trong tầm nhìn hoặc tầm đánh hơi. Mỗi người được tính riêng.
- Thấy quá 0,5 giây thì chúng đứng lại nhìn, không quay theo, không đuổi. Liếc qua ngắn hơn thì chúng đi tiếp. Ra khỏi vùng thì thanh cạn nhanh gấp 4 lần rồi chúng đi tiếp.
- Chó nhìn thấy người quá 1,5 giây mới sủa gọi lính khác tới.
- Bản đồ nhỏ vẽ đúng tầm nhìn cả ngày lẫn đêm. Chạy không làm vùng rộng thêm (chỉ gây tiếng động), cúi làm hẹp lại 40 %. Chỗ tối và mưa cũng làm hẹp lại.
- Đèn pha và camera giữ luật riêng: 1,5 giây ở giữa vệt sáng.
- Người còn bị khóa trong lồng ở Trại rừng thì không bị tính: không có đường chạy.
- Các mốc thời gian nằm trong `WATCH` ở `js/actors.js`.

## Điều khiển

| Phím | Tác dụng |
| --- | --- |
| `W` `A` `S` `D` | Di chuyển |
| Chuột | Xoay camera (nhấp vào màn hình để khóa chuột) |
| `Shift` | Chạy (gây tiếng động) |
| `C` | Cúi người, đi rón rén |
| `E` | Tương tác, giữ để làm việc lâu |
| `F` | Ném đá đánh lạc hướng lính gác |
| `J` | Mở / thu gọn danh sách nhiệm vụ |
| `M` | Mở bản đồ lớn |
| `Esc` hoặc `P` | Tạm dừng (đang toàn màn hình thì `Esc` thoát toàn màn hình và tạm dừng) |

### Toàn màn hình và Ctrl + W

`Ctrl` là phím cúi, `W` là phím đi, nên trước đây bấm cùng lúc sẽ thành `Ctrl + W` và đóng tab. Bây giờ trên máy tính, game tự vào **toàn màn hình** khi bấm “Chơi một mình”, “Chơi tiếp”, “Tiếp tục” hoặc nhấp vào màn hình game:

- Trên **Chrome / Edge**, ở chế độ toàn màn hình, các phím tắt của trình duyệt (`Ctrl + W`, `Ctrl + T`, `Ctrl + N`, `Ctrl + Tab`…) chỉ điều khiển game, không đóng tab.
- Nhấn **`Esc`** để thoát toàn màn hình, game tự tạm dừng. Bấm “Tiếp tục” hoặc nhấp vào màn hình để vào lại.
- Trên Firefox / Safari, hoặc khi không ở toàn màn hình, trình duyệt không cho chặn `Ctrl + W`. Khi đó, nếu lỡ bấm, trình duyệt sẽ hỏi lại trước khi đóng tab.
- Muốn tắt việc tự vào toàn màn hình: **Cài đặt** → bỏ chọn “Tự vào toàn màn hình khi chơi”. Trong menu tạm dừng cũng có nút “Toàn màn hình” để bật hoặc tắt bằng tay.

Trên điện thoại có nút cảm ứng; có thể sắp xếp lại trong menu tạm dừng, mục **“Nút điều khiển”**.

## Tạo nhân vật

Bấm **Nhân vật** ở màn hình chính (hoặc trong menu tạm dừng) để tự tạo hình nhân vật chính. Bên trái là ảnh xem trước 3D (kéo để xoay, lăn chuột hoặc chụm hai ngón để phóng to, nút Toàn thân / Khuôn mặt / Giày), bên phải là các mục chỉnh:

| Mục | Chỉnh được |
| --- | --- |
| Cơ thể | Giới tính, chiều cao, dáng người (gầy → đầy đặn), màu da |
| Khuôn mặt | Độ rộng mặt, quai hàm, cằm, gò má, tai |
| Mắt | Kích thước, khoảng cách, đuôi mắt, độ mở mí, màu mắt |
| Chân mày | Kiểu (vừa, mảnh, rậm, ngang, cong, xếch), độ dày, độ cong, độ nghiêng, độ cao, màu |
| Mũi | Độ rộng, độ dài, sống mũi, đầu mũi |
| Miệng | Độ rộng, độ dày môi, màu môi |
| Tóc & râu | 11 kiểu tóc (trọc, đầu đinh, ngắn, rẽ ngôi, undercut, lượn sóng, xoăn, bob, dài, đuôi ngựa, búi cao), màu tóc, nhuộm đuôi, 6 kiểu râu |
| Áo | Áo thun, thun dài tay, ba lỗ, polo, sơ mi, áo khoác thể thao, hoodie; màu chính, màu phối, áo bên trong; họa tiết trơn / sọc / caro |
| Quần | Quần tây, jean, jogger, túi hộp, short, váy; màu chính, màu sọc |
| Giày | Giày thể thao, giày lười vải, bốt, giày tây; màu giày, màu đế, màu dây |
| Phụ kiện | Kính tròn, kính vuông, kính râm |

Có sẵn 8 mẫu để bắt đầu, nút **Ngẫu nhiên**, **Đặt lại** và **Hủy**. Bấm **Lưu & dùng** thì nhân vật được nhớ trên trình duyệt này và dùng ngay trong game. Khi chơi nhiều người, đồng đội thấy đúng nhân vật bạn đã tạo. Các mẫu có sẵn đều là thiết kế riêng của game, không mô phỏng nhân vật của phim hay game nào.

## Chuyển động nhân vật

Mọi người trong game (nhân vật chính, lính gác, NPC, đồng đội, bot) cử động theo số đo của người thật (`js/motion.js`):

- **Khung xương theo tỉ lệ người thật** (số liệu nhân trắc ANSUR II): vai, cánh tay, chân nằm đúng chỗ, tay gắn liền vai. Có khớp cổ chân và khớp ngón chân: khi bước, gót nhấc lên, bàn chân lăn qua mũi và các ngón vẫn bám sàn.
- **Chân đặt bằng IK**: bàn chân đang chạm đất đứng yên, không trượt; hông lên xuống theo bước chân (khoảng 3–5 cm khi đi). Độ dài bước và nhịp bước theo tốc độ, ví dụ đi 1,3 m/s là khoảng 108 bước/phút.
- **Đi và chạy khác nhau như người thật**: người thật chuyển từ đi sang chạy ở khoảng 2 m/s, nên tốc độ "đi" 3,4 m/s của nhân vật chính là chạy chậm (có lúc cả hai chân rời đất). Phím chạy là chạy nhanh 6,2 m/s.
- **Ngồi, quỳ, nằm, ngồi bệt**: mông đặt đúng mặt ghế, giường hay thùng bên dưới (game dò tìm bề mặt thật), chân chạm sàn. Ghế cao quá thì nhích ra mép ghế; nếu vẫn không với tới sàn thì chân buông thõng.
- **Khớp không quá tầm vận động** (theo bảng tầm vận động khớp AAOS), cùng các cử động nhỏ cho tự nhiên: thở, dồn trọng tâm, liếc nhìn, chớp mắt khoảng 15 lần/phút, mấp máy môi khi nói.

## Đồ họa và cài đặt

Đồ họa 3D dựng hoàn toàn bằng code chạy trên GPU (không cần tải mô hình hay ảnh): ánh sáng HDR, bóng đổ mềm, phản chiếu bầu trời (IBL), che sáng môi trường (SSAO), bloom quanh đèn và biển neon, sương mù theo độ cao, mưa thật (vệt mưa, giọt bắn, mặt đất ướt, vũng nước gợn sóng), lửa và khói, đèn pha/đèn đường chiếu sáng thật và đổ bóng, vật liệu PBR (bê tông, nhựa đường, gạch, gỗ, tôn, sơn epoxy…), người và chó có hình dáng thật, cây rừng và dừa đung đưa theo gió, xe cộ có kính, đèn, mâm bánh.

Mở **Cài đặt → Đồ họa**:

| Mục | Ý nghĩa |
| --- | --- |
| Chất lượng đồ họa | **Tự động** (game tự chọn theo card đồ họa và tự hạ nếu máy chạy không kịp; trên điện thoại tự chọn **Điện thoại**), **Thấp**, **Trung bình**, **Cao**, **Rất cao**, **Điện thoại**. |
| Độ phân giải | **Theo màn hình**, hoặc cố định **HD 1280×720**, **HD+ 1600×900**, **Full HD 1920×1080**, **2K 2560×1440**, **4K 3840×2160**. |
| Độ phân giải động | Tự hạ nhẹ độ phân giải khi khung hình bị chậm, rồi nâng lại khi máy rảnh. |
| Giới hạn khung hình | Theo tần số màn hình, hoặc 60 / 30 FPS (đỡ nóng máy, đỡ tốn pin). |
| Hiện FPS | Hiện số khung hình/giây, độ phân giải đang vẽ và thời gian GPU ở góc màn hình. |
| Tùy chỉnh nâng cao | Chỉnh riêng bóng đổ, SSAO, khử răng cưa (FXAA / MSAA 2x–8x), độ chi tiết vật liệu (512–2048), bloom và độ sắc nét. |

Gợi ý:

- **Máy yếu** (laptop văn phòng, card đồ họa tích hợp Intel/AMD): chọn **Thấp** hoặc **Trung bình**, độ phân giải **HD 1280×720**, bật **Độ phân giải động**. Mức Thấp giảm số cây chi tiết, cỏ, số đèn được tính, tắt SSAO/bloom và dùng FXAA.
- **Máy mạnh** (card rời đời mới): **Rất cao** ở **2K** hoặc **4K**.
- **Điện thoại** (iPhone 13 trở lên, Android tầm trung trở lên): để **Tự động**. Game dùng mức **Điện thoại**, vẽ ở **Full HD** (1080 điểm ảnh theo cạnh ngắn) và nhắm 60 FPS: vẽ thẳng ra màn hình không qua hậu kỳ, bóng mặt trời vẽ lại 30 lần/giây, người ở xa dùng thân nhẹ hơn, đám đông trong xưởng dùng bản rút gọn, ít cỏ cây hơn, không có mặt đất ướt và phản chiếu bầu trời. Nếu máy vẫn chậm, **Độ phân giải động** tự hạ độ phân giải một chút. Trên iPhone, bật **Chế độ nguồn điện thấp** thì Safari chỉ cho chạy 30 FPS.
- Ở mọi mức, đám công nhân trong xưởng chỉ được vẽ khi nhìn thấy được (ở trong xưởng hoặc nhìn qua cửa), nên các cảnh ngoài sân nhẹ hơn nhiều.
- Cài đặt được nhớ trên trình duyệt. Lần đầu vào game, bề mặt vật liệu được tạo dần trong vài giây đầu (thấy hơi phẳng lúc mới vào là bình thường).
- Nên dùng Chrome hoặc Edge bản mới, bật “Sử dụng tăng tốc phần cứng” trong cài đặt trình duyệt.
## Sự cố thường gặp

| Hiện tượng | Cách xử lý |
| --- | --- |
| `EADDRINUSE` khi chạy server | Cổng 8765 đang bị chương trình khác dùng (thường là một server cũ chưa tắt). Tắt nó, hoặc chạy với cổng khác (xem **Đổi cổng**). |
| Màn hình trắng / đen, không có hình 3D | Kiểm tra Internet (cần tải three.js từ CDN) và xem trình duyệt có bật WebGL không. Mở DevTools (`F12`) → tab Console để xem lỗi. |
| Mở trực tiếp file `index.html` (đường dẫn `file://`) | Không nên: `index.html` không có phần `<head>` đầy đủ (server tự thêm vào), và chế độ nhiều người cần server. Luôn chạy qua `node server.js`. |
| Máy khác trong LAN không vào được | Kiểm tra đúng IP, hai máy cùng mạng, và tường lửa Windows đã cho phép Node.js. |
| Game giật, khung hình thấp | Cài đặt → Đồ họa: hạ chất lượng xuống **Thấp/Trung bình**, chọn độ phân giải **HD 1280×720**, bật **Độ phân giải động**. Kiểm tra trình duyệt đang dùng card đồ họa rời (Windows: Cài đặt → Hệ thống → Màn hình → Đồ họa → chọn Chrome/Edge → Hiệu năng cao). |
| Hình bị mờ | Tắt **Độ phân giải động** hoặc chọn độ phân giải cố định cao hơn. |
| Bạn bè mở link ngrok thấy trang cảnh báo | Đó là trang cảnh báo của ngrok gói miễn phí; bấm **Visit Site** để vào game. |

## Cấu trúc thư mục

```
index.html          giao diện, menu, HUD (server bọc thêm <head> khi trả về)
server.js           server file tĩnh + WebSocket cho phòng chơi
js/core.js          khởi tạo, âm thanh, tiện ích chung
js/gfx.js           đồ họa: chất lượng, độ phân giải, HDR, bóng, SSAO, bloom, sương, mặt ướt
js/texgen.js        tạo vật liệu PBR bằng GPU (bê tông, gạch, gỗ, nhựa đường…)
js/lights.js        đèn pha, đèn đường, đèn pin: nguồn sáng thật và tia sáng
js/atmos.js         mưa (vệt mưa, giọt bắn)
js/vegetation.js    cây rừng, cỏ, cây dừa
js/fx.js            lửa, tia lửa, khói, miệng lò gạch
js/vehicles.js      xe SUV, tuk-tuk, xe cảnh sát, trực thăng
js/humans.js        người và chó (thân hình, khuôn mặt chỉnh được, quần áo; đám đông ngồi làm việc)
js/wardrobe.js      tóc mọc theo từng lọn, giày, cổ áo, mũ trùm, váy, túi quần
js/creator.js       màn hình Tạo nhân vật (xem trước 3D, lưu, mã nhân vật cho chơi nhiều người)
js/actors.js        nhân vật, lính gác, camera, đèn pha
js/motion.js        chuyển động người: dáng đi/chạy, đặt chân bằng IK, ngồi/quỳ/nằm, chớp mắt, nói
js/game.js          vòng lặp game, nhiệm vụ, đồng hồ
js/story.js         cốt truyện chính
js/story2.js        chương 2, 3 và chế độ đội (ST.TEAMMAPS: nhiệm vụ, bot, cột trói của từng bản đồ)
js/dark.js          nhánh “Đường tối”
js/team_escape.js   chặng trốn thoát của chế độ đội (Bến sông, tàu, cảnh sát, chuyến bay, gặp bố mẹ)
js/myanmar.js       map Myanmar: trạng thái nhiệm vụ do chủ phòng giữ, làm lại chặng, cảnh trên tàu, bot
js/myanmar_missions.js  39 nhiệm vụ của map Myanmar
js/panel.js         các câu đố bấm tay (khóa số, nhớ tín hiệu, chọn, dò sóng, chèo bè)
js/net.js           kết nối nhiều người
js/bots.js          bot đồng đội
js/controls.js      nút cảm ứng trên điện thoại
js/levels/          các bản đồ (mở đầu, Sihanoukville, rừng, lò gạch, bến sông, sân bay, Myanmar)
sfx/                file âm thanh
```
