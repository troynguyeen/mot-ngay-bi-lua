# Một Ngày Bị Lừa: kịch bản và tài liệu bàn giao

> Dành cho AI hoặc lập trình viên phát triển tiếp game mà chưa có bối cảnh nào. Nội dung được đối chiếu với source ngày **22/11/2026**.

## 0. Đọc phần này trước

**Trước khi sửa bất cứ thứ gì:**

1. Đọc hết file này, rồi đọc [README.md](README.md) để biết cách chạy và điều khiển.
2. Đọc code của phần sắp sửa (bảng ở [mục 10](#10-bản-đồ-source)).
3. Tóm tắt lại cho chủ dự án: đã hiểu cốt truyện thế nào, định làm gì, đụng file nào.
4. Chờ chủ dự án duyệt rồi mới thêm hoặc đổi cốt truyện.

> **Có việc đang làm dở lúc viết file này (22/11/2026, 10:02):** bản đồng đội của Chương 4 và chuyến bay về nước. Xem [việc đang làm dở](#việc-đang-làm-dở) trước khi đụng vào `js/escape.js` hoặc phần nhiều người.

**Nhãn dùng trong file:**

| Nhãn | Ý nghĩa | Được tự ý đổi? |
| --- | --- | --- |
| **[CANON]** | Cốt truyện đang có trong game | Không |
| **[CHỐT]** | Chủ dự án đã yêu cầu hoặc quyết định | Không |
| **[CHƯA DUYỆT]** | Cách hiểu của AI trước, đã làm nhưng chưa được xác nhận | Hỏi trước |
| **[GỢI Ý]** | Ý tưởng, **chưa có trong game và không phải cốt truyện** | Hỏi trước |

Mục 2 đến 8 là [CANON], trừ chỗ có nhãn khác. Câu trong ngoặc kép “…” ở các mục này trích nguyên văn từ game. Thoại đầy đủ nằm trong `js/story.js`, `js/story2.js`, `js/escape.js`, `js/dark.js`. Khi file này và code lệch nhau thì code là hiện trạng: hãy báo chủ dự án và cập nhật file.

**Mục lục**

1. [Game là gì](#1-game-là-gì)
2. [Cốt truyện tóm tắt](#2-cốt-truyện-tóm-tắt)
3. [Nhân vật](#3-nhân-vật)
4. [Kịch bản chi tiết](#4-kịch-bản-chi-tiết)
5. [Hai hướng kết thúc](#5-hai-hướng-kết-thúc)
6. [Sáu kịch bản lừa đảo](#6-sáu-kịch-bản-lừa-đảo)
7. [Luật chơi](#7-luật-chơi)
8. [Chơi nhiều người](#8-chơi-nhiều-người)
9. [Quyết định và giới hạn nội dung](#9-quyết-định-và-giới-hạn-nội-dung)
10. [Bản đồ source](#10-bản-đồ-source)
11. [Cách viết thêm nội dung](#11-cách-viết-thêm-nội-dung)
12. [Chạy và kiểm thử](#12-chạy-và-kiểm-thử)
13. [Việc còn lại](#13-việc-còn-lại)
14. [Quy trình cập nhật](#14-quy-trình-cập-nhật)

---

## 1. Game là gì

- **Thể loại:** 3D góc nhìn thứ ba, lén lút và sinh tồn, kể chuyện tuyến tính có rẽ nhánh cuối. Có thêm chế độ đồng đội 2–6 người.
- **Nền tảng:** trình duyệt trên máy tính và điện thoại. Ngôn ngữ trong game là tiếng Việt.
- **Chủ đề:** lừa việc nhẹ lương cao, mua bán người sang khu lừa đảo ở Campuchia, cưỡng bức lừa đảo qua mạng. Hư cấu, lấy cảm hứng từ các vụ việc có thật.
- **Thông điệp:** giúp người chơi nhận ra lời mời việc làm lừa đảo và các chiêu lừa qua mạng, và thấy ranh giới giữa nạn nhân với đồng phạm.
- **Giọng kể:** căng, u ám, gần đời thường, câu ngắn. Không giảng đạo trong lúc chơi: bài học nằm ở hậu quả và màn kết.
- **Mô-típ xuyên suốt:**
  - Một tin nhắn cầu cứu tới được người nhà hoặc cơ quan chức năng là thứ cứu người.
  - Người có vẻ giúp mình có thể là người của đường dây (lễ tân, tài xế tuk-tuk).
  - Người giúp thật thường cũng là nạn nhân hoặc dân thường (Chú Bảy, Dì Sophea, ông Tư).
  - Nam không bỏ người khác lại.
  - Lúc nào cũng có lựa chọn cảnh báo nạn nhân, và lựa chọn đó có giá.

## 2. Cốt truyện tóm tắt

Nguyễn Văn Nam mất việc ba tháng, nợ hai tháng tiền nhà và nợ anh Hải cho vay nặng lãi 50 triệu, nay thành 80 triệu. Chủ nợ dọa tìm tới bố mẹ Nam.

Nam nộp CV cho tin tuyển chăm sóc khách hàng lương 3.000–5.000 đô, lên xe 16 chỗ đi phỏng vấn, uống ly nước có thuốc và tỉnh dậy ở Sihanoukville. Nam bị coi là món hàng nợ 15.000 đô và bị ép lừa đồng bào qua mạng.

Nhờ Chú Bảy, Nam nhắn được vị trí về cho mẹ rồi cắt lưới trốn ra, nhưng bị tài xế tuk-tuk bán lại và bị chuyển vào trại rừng. Ở đó Nam lấy điện thoại vệ tinh gửi tọa độ, mở lồng cho bốn người, rồi lại bị bắt và chuyển tới lò gạch ven sông.

Dì Sophea đưa Nam chiếc điện thoại nối với lực lượng đặc nhiệm Việt Nam. Nam tắt máy phát, mở phòng giam, đưa mọi người vượt rào chạy ra bến trong lúc bị ném đá. Ông Tư chở họ tới tàu cảnh sát hai nước.

Người chơi chọn **về nhà** (kết chính) hoặc **Đường tối**, nhánh “nếu như” Nam ở lại làm cho đường dây.

```text
Mở đầu: phòng trọ → xe 16 chỗ → văn phòng → phòng giam giữ
  └─ Chương 1: Đặc khu S-7        ── bị tài xế tuk-tuk phản bội
      └─ Chương 2: Trại rừng      ── bị chuyển đi trong đêm
          └─ Chương 3: Lò gạch    ── vượt rào phía tây
              └─ Chương 4: Bến sông ── được cảnh sát hai nước cứu
                  └─ CHỌN
                      ├─ Trở về nhà: sân bay → hạ cánh → gia đình → “Nam đã về nhà”
                      └─ Đường tối: ca 1 → ca 2 → ca 3
                          ├─ doanh số < 25.000$ → “Doanh số thấp”
                          └─ lính canh → cô gái trốn → mời mua chức
                              ├─ không mua → “Từ nạn nhân thành đồng phạm”
                              └─ mua hoặc vay → “Quản lý lừa đảo”
```

Vai trò của từng chương:

| Chương | Nam học được gì | Manh mối để lại cho cuộc giải cứu |
| --- | --- | --- |
| Mở đầu | Túng quẫn làm người ta bỏ qua dấu hiệu bất thường | Không có |
| 1 | Trốn một mình không đủ, đừng tin người lạ đón sẵn | Vị trí gửi cho mẹ, gia đình trình báo |
| 2 | Kêu cứu đúng nơi, không bỏ người ở lại | Tọa độ vệ tinh gửi đường dây bảo hộ công dân |
| 3 | Phối hợp với lực lượng cứu hộ | Cắt điện, đưa con tin ra để đặc nhiệm ập vào |
| 4 | Sống sót tới tay người cứu | Cả đường dây bị đột kích |

## 3. Nhân vật

Không tự thêm tuổi, quê quán hay quan hệ mà bảng này không ghi.

### Gia đình và đời sống của Nam

| Nhân vật | Vai trò | Tính cách, giọng nói | Số phận hiện tại |
| --- | --- | --- | --- |
| **Nguyễn Văn Nam** | Nhân vật chính, thất nghiệp | Xưng em hoặc con, hiền, hay tự trấn an, dần quyết đoán | Tùy kết cục |
| **Mẹ** | Nhận tin nhắn, đi báo công an | Thương con, từng vay cô Tư đóng tiền nhà cho Nam | Đón Nam ở kết chính |
| **Bố** | Áp lực gia đình | Gắt vì lo, cuối truyện bao dung | Đón Nam ở kết chính |
| **Anh Hải** | Cho vay nặng lãi | Xưng anh, dọa nhẹ giọng | Khoản vay được trình báo, bản thân chưa rõ |
| **Cô Ba** | Chủ trọ | Đòi tiền nhà | Chưa nhắc lại |
| Cô Tư, chú Hai | Chỉ được mẹ nhắc tên | Không xuất hiện | Cô Tư **không liên quan** ông Tư lái tàu |

### Đường dây

| Nhân vật | Nơi xuất hiện | Vai trò | Số phận hiện tại |
| --- | --- | --- | --- |
| **Chị Hương** | Mở đầu, qua chat | Tuyển dụng giả, ngọt, dặn giữ bí mật | Chưa rõ |
| **Lễ tân**, **Người đàn ông mặc vest** | Văn phòng | Cho uống thuốc mê | Chưa rõ |
| **Gã xăm trổ** | Phòng giam giữ, cảnh phản bội | Cai, áp giải | Chưa rõ |
| **Quản lý** | Xưởng S-7, Đường tối | Ép chỉ tiêu | Chưa rõ |
| **Lính gác** áo cam | S-7 | Canh, áp giải | Chưa rõ |
| **Tài xế tuk-tuk** | Cuối chương 1 | Giả giúp, gọi đồng bọn | Chưa rõ |
| **Trùm** | S-7, Đường tối | Đầu trọc, đeo kính, bán Nam vào rừng | Chưa nêu đích danh khi đường dây bị triệt phá |
| **Trùm Sẹo** | Trại rừng | Thô bạo, có súng, mua Nam 18.000 đô | Chưa nêu đích danh |
| **Tay chân đường dây** | Bến sông | Đuổi, ném đá | Đang bị truy bắt |

### Người bị hại và người giúp

| Nhân vật | Nơi xuất hiện | Vai trò | Số phận hiện tại |
| --- | --- | --- | --- |
| **Năm người lạ** | Phòng giam giữ | Cùng bị bán, một thanh niên bị chích điện vì đòi báo công an | Chưa rõ |
| **Chú Bảy** | S-7 | Bị giữ tám tháng, chỉ đường trốn, tự nhận quá già để chạy | **Chưa rõ, còn ở lại S-7** |
| **Hùng** | Phòng tối S-7 | Trốn hụt, bị xích, cứu là nhiệm vụ tùy chọn | **Chưa rõ** |
| **Bốn người trong lồng** | Trại rừng | Nam mở lồng | Bị dồn lên xe cùng Nam |
| **Bốn người trong phòng giam** | Lò gạch | Nam mở cửa, cùng chạy ra tàu | Được cứu, về nước |
| **Dì Sophea** | Lò gạch | Bị giữ nấu cơm ba năm, tiếng Việt lơ lớ, giấu điện thoại dưới bát | **Chưa rõ** |
| **Ông Tư** | Bến sông | Người Việt sống trên sông ba mươi năm, được công an nhờ đón | Hoàn thành việc chở |
| **Cô gái** | Đường tối | Mới bị bán ba ngày, đang cắt lưới | Tùy lựa chọn của Nam |

Game chưa khẳng định bốn người ở lò gạch có phải bốn người ở trại rừng hay không.

### Lực lượng giải cứu

| Nhân vật | Vai trò | Giọng nói |
| --- | --- | --- |
| **Đại úy Minh** | Đặc nhiệm Việt Nam, bay về cùng Nam | Xưng anh, ấm, gọn |
| **Trung tá Sokha** | Cảnh sát Campuchia | Trang trọng, luôn nói qua phiên dịch |

## 4. Kịch bản chi tiết

Tên hàm ghi cạnh mỗi cảnh là điểm vào trong code (`ST` = `G.story`). Thời hạn tính bằng giây thật.

### Mở đầu (`js/story.js`, bản đồ `prologue`)

**Cảnh 0.1: Phòng trọ, 23:41** (`ST.start`)

1. Thẻ chữ kể Nam bị cắt giảm ba tháng trước, nợ tiền nhà và nợ lãi.
2. Màn hình khóa hiện email sa thải, tin chủ trọ, tin dọa của anh Hải, ảnh cổng nhà bố mẹ, tin nhắn của mẹ.
3. Anh Hải gọi: “Chủ nhật không có tiền thì anh em xuống tận nhà bố mẹ mày nói chuyện.”
4. Bố trách, mẹ can.
5. Nam thấy tin tuyển dụng nằm giữa tin phụ bếp 7 triệu và tin shipper: lương 3.000–5.000$, bao ăn ở, xe đón tận nhà, không cần bằng cấp. Dưới bài là bình luận mồi.
6. Nam nộp CV. Chị Hương hẹn 8h, bảo mang hộ chiếu và dặn “Đừng kể nhiều với ai, nhiều người tranh suất lắm”.

**Cảnh 0.2: Xe 16 chỗ, sáng hôm sau** (`ST.van`)

- Góc nhìn thứ nhất. Người chơi soi các chi tiết lạ trong xe (`L.vanHot`).
- Sau khi thấy 2 chi tiết hoặc sau 40 giây, anh Hải gọi lại. Nam linh cảm bất ổn nhưng nghĩ “Thôi kệ. Cứ lên phỏng vấn xem sao.”

**Cảnh 0.3: Văn phòng đại diện, 10:00** (`ST.office`, `ST.officeSit`)

- Lễ tân mời nước. Người chơi có thể từ chối nhưng sẽ bị ép, Nam vẫn uống. Đây là chủ ý kịch bản.
- Màn hình nhòe. Người mặc vest nói: “Ngủ đi em. Tỉnh dậy là tới công ty rồi.”

**Cảnh 0.4: Phòng giam giữ ở Sihanoukville, đêm mưa** (`ST.holding`)

- Nam và năm người lạ bị trói, mất hộ chiếu, điện thoại, ví.
- Gã xăm trổ: “Mỗi đứa nợ công ty 15.000 đô tiền mua. Làm trả đủ thì về.”
- Một thanh niên đòi báo công an, bị chích điện gục xuống. Nam ngất.

### Chương 1: Sihanoukville, Đặc khu S-7 (`js/story.js`, bản đồ `sihanouk`)

**Bối cảnh:** tường cao sáu mét, thép gai, camera, đèn pha, chó, tòa nhà xây dở có giàn giáo, neon casino và đường lớn phía đông.

**Cảnh 1.1: Ca sáng** (`ST.startCh1`)

| # | Nhiệm vụ | Thời hạn |
| --- | --- | --- |
| 1 | Đi theo lính gác vào xưởng | 90 |
| 2 | Ngồi vào bàn số 17 | 30 |

- Làm ba ca lừa: `police`, `relative`, `invest` (xem mục 6).
- Cảnh báo được từ 2 người trở lên thì bị chích điện, nhịn đói, cộng 3.000 đô nợ.
- Làm theo kịch bản thì vẫn bị chê thiếu chỉ tiêu. Cả hai hướng đều dẫn tới lời dọa phòng tối, nên Nam phải trốn trong đêm.

**Cảnh 1.2: Giờ ăn trưa, 12:10** (`ST.ch1Noon`, `ST.ch1Bay`)

- Tìm Chú Bảy ở nhà ăn (60 giây). Chú dặn cả kế hoạch: điện thoại dưới đệm, lên giàn giáo lấy sóng, lấy thẻ từ, lấy kìm, cắt lưới, tìm tuk-tuk.
- Nam rủ đi cùng. Chú đáp: “Chú già rồi, chạy không nổi. Con ra được thì báo người vào cứu tụi chú.”
- Lời khuyên về tuk-tuk là chân thành. Chú không biết đó là bẫy.

**Cảnh 1.3: Đêm mưa, 21:00 đến hạn 05:30** (`ST.ch1Setup`)

| # | Nhiệm vụ | Thời hạn | Độ khó |
| --- | --- | --- | --- |
| 1 | Lấy điện thoại dưới đệm giường số 3 | 45 | Dễ |
| 2 | Leo giàn giáo nhắn tin cho gia đình | 75 | Vừa |
| 3 | Lấy thẻ từ khi gác phòng bảo vệ ra hút thuốc | 130 | Khó |
| 4 | Mở nhà kho lấy kìm cắt | 100 | Khó |
| 5 | Cắt lưới B40 phía đông | 120 | Rất khó |
| 6 | Ra xe tuk-tuk dưới cột đèn | 30 | Vừa |
| + | Tùy chọn: cởi trói cho Hùng ở phòng tối | Không có | Không có |

Tin nhắn cho mẹ kèm vị trí: “Mẹ ơi, con bị lừa sang Campuchia, đang bị nhốt ở một khu nhà cao tầng ở Sihanoukville. Mẹ báo công an giúp con.” Gửi xong thì điện thoại hết pin.

**Cảnh 1.4: Phản bội** (`ST.ch1Betrayal`, `ST.ch1Cage`)

- Tài xế nhận chở rồi lén gọi điện. Xe SUV ập tới: “Chạy đâu? Tài xế tuk-tuk quanh đây đều là người của tao.”
- Nam tỉnh trong lồng chó. Trùm biết về tin nhắn và bán Nam: “Hàng lỗi thì bán đi. Bên rừng đang cần người.”
- Những chiếc lồng bị chất lên xe tải.

### Chương 2: Trại rừng (`js/story2.js`, bản đồ `jungle`)

**Bối cảnh:** hai ngày trên thùng xe. Lồng sắt, lán làm việc, nhà trùm, chòi tre, đống lửa, cột ăng-ten, đầm lầy dẫn ra suối.

**Cảnh 2.1: Hàng mới** (`ST.startCh2`)

- Trùm Sẹo: “Tao trả 18.000 đô cho mày.”
- Thẻ chữ tóm tắt nhiều ngày đòn roi, bỏ đói, một người lồng bên bị lôi đi không trở lại.
- Làm ba ca lừa: `romance`, `shipper`, `utility`. Cảnh báo từ 2 người trở lên thì bị nện báng súng, cắt cơm.
- Nam để ý cột ăng-ten và điện thoại vệ tinh của trùm.

**Cảnh 2.2: Đêm, 22:00 đến hạn 05:30** (`ST.ch2Night`)

| # | Nhiệm vụ | Thời hạn | Độ khó |
| --- | --- | --- | --- |
| 1 | Tìm sợi thép ở góc lồng | 30 | Dễ |
| 2 | Cạy khóa lồng, có tiếng động | 30 | Vừa |
| 3 | Lấy điện thoại vệ tinh khi gác hiên rời chỗ | 125 | Khó |
| 4 | Gửi tin cầu cứu cạnh cột ăng-ten | 50 | Vừa |
| 5 | Mở lồng cho 4 người | 115 | Khó |
| 6 | Băng đầm lầy ra bờ suối | 90 | Khó |

- Tin gửi đường dây bảo hộ công dân nêu tên Nam, hành trình và “ít nhất 5 người Việt bị nhốt lồng”.
- Hồi âm: “Gia đình anh đã trình báo từ tin nhắn trước. Lực lượng chức năng hai nước đang phối hợp.”
- Ra suối khi chưa gửi tin hoặc chưa mở đủ lồng thì bị nhắc: “Còn người trong lồng. Nam không bỏ họ lại.”

**Cảnh 2.3: Chuyển trại** (`ST.ch2Relocate`)

- Trùm Sẹo phát hiện tín hiệu: “Không giết ở đây được, cảnh sát đang tới. Dồn hết lên xe, chuyển đi ngay trong đêm!”
- Thẻ chữ kết chương: “Nhưng lần này, ở đâu đó, có người đã nghe thấy họ.”

### Chương 3: Lò gạch bỏ hoang (`js/story2.js`, bản đồ `kiln`)

**Bối cảnh:** lò gạch ven sông trong sương, bãi phơi gạch, nhà giam, máy phát nuôi toàn bộ đèn. Đường dây định chờ thuyền chở người đi xa hơn.

**Cảnh 3.1: Bát cơm** (`ST.startCh3`)

- Nam bị xích cạnh tên gác ngủ gật. Dì Sophea thì thầm: “Dưới đáy bát có cái điện thoại.”
- Đặc nhiệm Việt Nam nhắn: hai manh mối trước đã dẫn họ tới đây. Nam cần tắt máy phát, mở phòng giam, đưa mọi người vượt rào phía tây ra bến. Người ra khỏi lò là lực lượng ập vào.

**Cảnh 3.2: Đêm, 23:00 đến hạn 05:30** (`ST.ch3Night`)

| # | Nhiệm vụ | Thời hạn | Độ khó |
| --- | --- | --- | --- |
| 1 | Cúi người lấy chìa khóa của tên gác ngủ | 30 | Vừa |
| 2 | Mở 4 phòng giam | 60 | Vừa |
| 3 | Mở cửa nhà giam, tắt máy phát phía đông | 85 | Khó |
| 4 | Đưa mọi người vượt rào phía tây | 75 | Rất khó |

Vượt rào xong vào thẳng Chương 4 (`ST.ch3Fence`). Cuộc đột kích lò gạch diễn ra ngoài khung hình, được Đại úy Minh kể lại ở Chương 4.

### Chương 4: Bến sông (`js/escape.js`, bản đồ `river`)

**Bối cảnh:** rạng sáng, đường mòn khoảng 200 m ven sông: bụi cây, cây đổ, cầu ván qua suối, nhà sàn, bùn, xuồng, cầu tàu.

**Cảnh 4.1: Rượt đuổi** (`ST.startCh4`)

- Nam leo rào. Bọn chúng hô: “Tụi nó trốn qua rào! Đuổi theo, đừng để đứa nào xuống được sông!”
- Một nhiệm vụ, không đồng hồ: chạy ra bến lên tàu.
- 10 kẻ đuổi chia ba nhóm: 6 tên sau cổng, 2 tên ở nhà sàn (kích hoạt khi qua z = 72), 2 tên gần bến (z = 138).
- 6 điểm sức lực, trúng đá có 1,5 giây miễn sát thương. Đá ném đón đầu người chạy thẳng, nên phải đổi hướng để né.
- Hết sức hoặc bị áp sát thì thua và chơi lại chương 4.

**Cảnh 4.2: Lên tàu**

- Ông Tư cho tàu rời bến trong lúc bị ném đá theo: “Chú tên Tư, người Việt, sống trên khúc sông này ba mươi năm rồi. Mấy anh công an bên mình nhờ chú ra đón các cháu.”

**Cảnh 4.3: Hạ lưu, mười lăm phút sau**

- Tàu cảnh sát hai nước đón. Sokha và Minh cho biết lò gạch, S-7 và trại rừng đều bị đột kích, và công của hai lần cầu cứu.
- Nam: “Về nhà... con được về nhà rồi...”
- Hiện màn “Chọn hướng đi tiếp” (`ST.finalChoice`).

## 5. Hai hướng kết thúc

### A. Được thả tự do, trở về nhà (kết chính)

**Cảnh A.1: Sân bay Campuchia, sáng hôm sau** (`ST.flightHome`). Cảnh sát hai nước tiễn. Người chơi đi tới cầu thang và bấm E. Minh: “Đi thôi Nam. Bố mẹ em đang chờ ở Tân Sơn Nhất.” Sokha: “Những kẻ đã lừa các bạn sẽ phải ra tòa.”

**Cảnh A.2: Bay và hạ cánh.** Máy bay lăn, cất cánh, hạ xuống Tân Sơn Nhất. “Bánh xe chạm đường băng. Trong khoang có người vỗ tay, có người bật khóc.”

**Cảnh A.3: Về nhà** (`ST.epilogue`, `ST.goodEnding`). Nam về cùng 41 người khác, ôm mẹ. Bố: “Về là được rồi. Nợ nần gì thì cả nhà cùng tính. Không ai bắt con phải đi đâu xa nữa.”

Màn kết “Nam đã về nhà” có bảng tổng kết và danh sách dấu hiệu lừa đảo. Câu cuối đổi theo việc Nam có cảnh báo được ít nhất 4 trên 6 nạn nhân hay không.

### B. Đường tối (nhánh “nếu như”, `js/dark.js`)

Tiền đề: “Nếu ngày ấy, trong phòng tối ở Sihanoukville, Nam gật đầu ở lại làm cho bọn chúng...”. Đây **không phải** phần nối tiếp sau khi được cứu. Vào nhánh thì doanh số, ví và số người lừa hoặc cảnh báo được đặt lại.

| Ca | Bản đồ | Giờ | Hai ca lừa | Nhiệm vụ |
| --- | --- | --- | --- | --- |
| 1/3 | `sihanouk` | 14:00 | `police`, `invest` | Vào chỗ làm (45), báo cáo (40) |
| 2/3 | `jungle` | 10:00 | `romance`, `relative` | Như trên |
| 3/3 | `sihanouk` | 22:00 | `shipper`, `utility` | Như trên |

**Sau ba ca** (`ST.darkVerdict`):

1. Doanh số dưới 25.000$ thì tới kết “Doanh số thấp”.
2. Đủ doanh số thì Nam mặc áo cam, điểm danh 4 chốt (150 giây), kiểm tra tường đông (60 giây).
3. Cô gái cắt lưới van xin: “Anh ơi... anh là người Việt phải không?” Người chơi chọn:
   - **Bấm bộ đàm:** thưởng 5.000$, cô bị bắt lại.
   - **Quay đi:** cô thoát. Nam nghĩ “Chạy đi. Đừng tin tài xế tuk-tuk nào cả.”
4. Trùm mời nạp 15.000$ **tiền trong game** mua chức quản lý. Người chơi trả từ ví, vay Trùm (nợ 30.000$), hoặc từ chối.

| Kết | Điều kiện | Nam ra sao |
| --- | --- | --- |
| “Doanh số thấp” | Dưới 25.000$ | Bị hành hạ, ba tháng sau được cứu **như một nạn nhân** |
| “Từ nạn nhân thành đồng phạm” | Làm lính canh, không mua chức | Bị bắt. Nếu đã tha cô gái thì cô làm chứng giảm nhẹ, nếu không thì cô làm chứng chống lại |
| “Quản lý lừa đảo” | Mua hoặc vay mua chức | Bị bắt với vai trò tổ chức, mức xử lý nặng nhất |

Thiết kế kinh tế cần giữ ý nghĩa khi chỉnh số:

- Hoa hồng 30%. Lừa trót lọt cả 6 người được 43.100$ doanh số, ví 12.930$, **không đủ** mua chức.
- Muốn trả bằng ví thì phải bán đứng cô gái để có thêm 5.000$. Không làm vậy thì chỉ còn cách vay.
- Bỏ ca `invest` (20.000$) thì tối đa 23.100$, không thể lên lính canh.

## 6. Sáu kịch bản lừa đảo

Dữ liệu ở `G.SCAM_CASES` trong `js/story.js`, giao diện ở `ui.scam` trong `js/game.js`.

| id | Chiêu | Nạn nhân | Cách lừa | Doanh số | Thiệt hại |
| --- | --- | --- | --- | --- | --- |
| `police` | Giả danh công an | Bác Hòa, 67, Thái Bình | Gọi video, dọa rửa tiền, “tài khoản tạm giữ” | 12.000$ | 300 triệu |
| `relative` | Giả danh người thân | Cô Thu, 52, Nghệ An | Chiếm tài khoản con trai, báo tai nạn | 2.000$ | 50 triệu |
| `invest` | Đầu tư chứng khoán, bất động sản | Anh Khoa, 35, kỹ sư | Nhóm ảo khoe lãi, rồi đòi thuế khi rút | 20.000$ | 500 triệu |
| `romance` | Lừa tình, lừa tiền | Chị Mai, 41, Hải Phòng | Người yêu ảo, phí thông quan quà | 4.400$ | 110 triệu |
| `shipper` | Giả danh shipper | Linh, 24, TP.HCM | Link giả, xin OTP | 1.100$ | 27 triệu |
| `utility` | Tiền điện, tiền nước | Ông Phúc, 63, Đà Nẵng | Dọa cắt điện, app chiếm quyền | 3.600$ | 90 triệu |

- Mỗi ca 3 lượt, mỗi lượt chọn **làm theo kịch bản** hoặc **cảnh báo**. Cảnh báo từ 2 lượt thì nạn nhân thoát.
- Câu nạn nhân ở lượt sau đổi theo lựa chọn lượt trước.
- Ca mới phải giữ khuôn này: `steps` vạch rõ thủ đoạn, câu cảnh báo `b` là lời khuyên đúng và dùng được ngoài đời. Không đưa số tài khoản, link hay tổ chức thật vào làm mồi.

## 7. Luật chơi

**Điều khiển:** WASD đi, chuột xoay, Shift chạy, C hoặc Ctrl trái cúi, E / Space / Enter tương tác, F hoặc Q ném đá, J danh sách nhiệm vụ, M bản đồ, Esc / P tạm dừng. Điện thoại có nút cảm ứng tự sắp xếp được.

| Cơ chế | Luật hiện tại |
| --- | --- |
| Tốc độ | Cúi 1,8 m/s, đi 3,4 m/s, chạy 6,2 m/s |
| Lính gác | Nhìn hình nón, 13 m ban đêm và 18 m ban ngày, nghe tiếng động, bị dụ bằng đá |
| Chó | Đánh hơi mọi hướng trong 6,5 m khi người chơi đứng, 2,2 m khi cúi. Tầm nhìn bằng 80% của lính. Đeo đèn chiếu theo hướng nhìn |
| Đèn pha | Chỉ bắt khi đứng trong nửa bán kính giữa vệt sáng liên tục 1,5 giây. Trên giàn giáo là 85% bán kính. Không xuyên mái |
| Đồng hồ đêm | 1 giây thật = 1 phút trong game. Tới 05:30 thì thua chương |
| Bị bắt | Về điểm xuất phát, +3.000$ nợ, mất 30 phút trong game, đồng hồ nhiệm vụ được nạp lại ít nhất 50%. Lần thứ 3 thì thua chương |
| Hết giờ nhiệm vụ | **Nam chết, chơi lại từ nhiệm vụ 1 Chương 1** (không phát lại mở đầu). Trong Đường tối thì về ca 1/3 |
| Thua ở bến sông | Chơi lại Chương 4 |
| Tạm dừng đồng hồ | Khi có hội thoại, điện thoại, cảnh cắt hoặc tạm dừng (chơi một mình) |

Tổng thời hạn các nhiệm vụ ban đêm phải nhỏ hơn thời lượng đêm:

| Chương | Tổng thời hạn | Thời lượng đêm |
| --- | --- | --- |
| 1 | 500 | 510 |
| 2 | 440 | 450 |
| 3 | 250 | 390 |

Comment trong `ST.ch3Night` ghi 235 là số cũ.

## 8. Chơi nhiều người

Đây là các màn đồng đội **tách khỏi bản chơi một mình**: dùng lại bối cảnh nhưng không có ca lừa, không phản bội, không rẽ nhánh.

- 2–6 người, không tài khoản. 6 phòng công khai P1–P6 và phòng riêng theo mã. Không vào giữa ván.
- Chủ phòng chọn bản đồ và tùy chọn, có thể thêm bot. Người thật vào phòng đầy thì thay chỗ bot.
- Bị bắt thì bị trói, đồng đội cởi trói (+15 giây). Thắng khi cả đội ra ngoài. Thua khi hết giờ hoặc tất cả bị trói.
- Một người tạm dừng là cả phòng dừng, ai cũng có thể cho chạy tiếp.
- Trình duyệt chủ phòng tính lính gác, bot và đồng hồ. Server chỉ chuyển tiếp.

| Bản đồ | Chuỗi việc | Việc cần hai người | Đích | Số đối thủ ít / thường / đông |
| --- | --- | --- | --- | --- |
| `sihanouk` | điện thoại → nhắn tin → thẻ từ → kho → lưới | giữ thang, rung cổng dụ gác, nâng cửa cuốn, giữ cầu dao | đường lớn | 5 / 10 / 14 |
| `jungle` | sợi thép → khóa lồng → vệ tinh → gửi tin → 4 lồng | giữ cửa lồng, rung tre dụ gác, xoay chảo ăng-ten | bờ suối | 4 / 7 / 10 |
| `kiln` | chìa khóa → 4 phòng giam → máy phát → kê gạch, leo rào tây → bến sông → sân bay | giữ xích, kéo cần gạt, giữ chồng gạch | về Việt Nam gặp bố mẹ | 4 / 7 / 10 |
| `river` (mới, chưa kiểm thử) | chạy ra bến → lên tàu → sân bay | đỡ người gục dậy | về Việt Nam gặp bố mẹ | 6 / 10 / 13 |

| Tùy chọn | Giá trị (mặc định in đậm) |
| --- | --- |
| `tod` | `day`, `dusk`, **`night`** |
| `wx` | `dry`, **`rain`**, `storm` (mưa che bớt tầm nhìn của lính, chỉ ở chế độ đội) |
| `time` | `easy` ×1,5, **`normal`**, `hard` ×0,75 |
| `guards` | `few`, **`normal`**, `many` |

Nút “Chọn sẵn cho người mới” đặt `easy` và `few`.

Phần bến sông và sân bay của `kiln`, `river` vừa được nối, xem [việc đang làm dở](#việc-đang-làm-dở).

## 9. Quyết định và giới hạn nội dung

### [CHỐT] Không đổi nếu chủ dự án không yêu cầu

**Nội dung**

- Nạp tiền, mua chức **chỉ dùng tiền trong game**. Không thanh toán thật.
- Ai tự nguyện theo Đường tối tới lính canh hoặc quản lý thì bị bắt. Không có kết nào làm ác mà thắng.
- Tra tấn và cái chết **kể bằng lời, chớp màn hình và âm thanh**, không diễn chi tiết.
- Không dùng tên, nhân vật, trang phục, poster của phim hay game có bản quyền. Trình tạo nhân vật chỉ có mẫu tự thiết kế, không có phù hiệu số.
- Hết giờ nhiệm vụ là chết và chơi lại từ đầu Chương 1.

**Cảm giác chơi**

- Giữ tốc độ 3,4 m/s (chạy chậm), không hạ xuống tốc độ đi bộ và không đổi thời hạn vì lý do này.
- Đèn pha chỉ bắt ở vùng sáng giữa và phải đủ 1,5 giây.
- Chuyển động phải hợp logic cơ thể người (khớp liền, chân không trượt) nhưng giữ vẻ ngoài ngộ nghĩnh của nhân vật.
- Có lựa chọn cho người mới ở chế độ nhiều người.

**Kỹ thuật**

- Nhạc nền **tắt**, giữ âm thanh môi trường và hiệu ứng. Thanh chỉnh nhạc được ẩn có chủ ý.
- Đồ họa sắc nét từ HD tới 4K, có mức cho máy yếu. Mục tiêu điện thoại là iPhone 13 chạy 60 FPS ở Full HD.
- Không tự bật server chạy nền hoặc ngrok khi chưa hỏi chủ dự án.

### [CHƯA DUYỆT]

- “Tàu” trong yêu cầu thoát hiểm được hiểu là **tàu, thuyền trên sông**, không phải tàu hỏa.
- Đám đuổi theo được gọi là **“tay chân đường dây”**, không gắn quốc tịch.

### Khuyến nghị khi viết nội dung mới

- Không quy tội ác cho một dân tộc hay quốc tịch. Trong truyện, người Campuchia vừa có nạn nhân (Dì Sophea) vừa có người cứu (Sokha).
- Không dùng tên người, công ty, hãng bay có thật trong vai xấu.
- Không biến kịch bản lừa thành hướng dẫn thực hành. Luôn kèm cách nhận ra và cách phòng.
- Số điện thoại khẩn cấp phải kiểm tra ở nguồn chính thức trước khi đưa vào game.

## 10. Bản đồ source

**Công nghệ:** JavaScript thuần, three.js **r128** qua CDN, Node.js 18+ cho server. Không npm, không build, không file model hay texture: hình 3D và vật liệu sinh bằng code. Mọi module là IIFE gắn vào `window.G`, thứ tự thẻ script trong `index.html` là thứ tự phụ thuộc.

| File | Nhiệm vụ |
| --- | --- |
| `index.html` | CSS, HUD, menu, hộp thoại, thứ tự script. Không có head vì server tự bọc |
| `server.js` | File tĩnh, WebSocket `/ws`, `/api/rooms`, `/healthz` |
| `js/core.js` | Renderer, va chạm, input, giờ và trời, âm thanh, `G.loadLevel` |
| `js/game.js` | UI, tương tác, nhiệm vụ, đồng hồ, minimap, checkpoint, phòng chờ, vòng lặp |
| `js/story.js` | Sáu ca lừa, mở đầu, Chương 1, bắt, chết, thua |
| `js/story2.js` | Chương 2 và 3, chọn kết, đoàn tụ, toàn bộ chế độ đội, khởi động |
| `js/escape.js` | Chương 4, tàu cảnh sát, chuyến bay. Cuối file xuất engine `G.esc` cho bản đồng đội |
| `js/dark.js` | Đường tối và ba kết |
| `js/levels/prologue.js` | Phòng trọ, xe, văn phòng, phòng giam giữ |
| `js/levels/sihanouk.js`, `js/levels/sihanouk_props.js` | S-7 và nội thất |
| `js/levels/jungle.js` | Trại rừng |
| `js/levels/kiln.js` | Lò gạch |
| `js/levels/river.js` | Đường mòn và bến sông |
| `js/levels/airport.js` | Một sân bay thay trang trí cho hai nước |
| `js/actors.js` | Người chơi, camera, AI lính và chó, đèn pha, NPC |
| `js/motion.js` | Dáng người, IK chân, tư thế |
| `js/humans.js`, `js/wardrobe.js`, `js/creator.js` | Cơ thể, trang phục, tạo nhân vật |
| `js/team_escape.js` | Bến sông và chuyến bay cho chế độ đội (**mới, chưa kiểm thử**) |
| `js/net.js`, `js/bots.js` | Client nhiều người, bot |
| `js/controls.js` | Nút cảm ứng |
| `js/gfx.js`, `js/texgen.js`, `js/lights.js` | Đồ họa, vật liệu, ánh sáng |
| `js/atmos.js`, `js/vegetation.js`, `js/fx.js`, `js/vehicles.js` | Mưa, cây, lửa khói, xe |
| `sfx/` | Giọng van xin và tiếng chích điện |

### Trạng thái chính

| Biến | Ý nghĩa |
| --- | --- |
| `G.state` (`S`) | `phase`, `chapter`, `busy`, `ended`, `stealthPhase`, `debt`, `caught`, `mp`, `teamPlay`, `dark` |
| `S.items` | Vật phẩm của chương |
| `S.f` | Cờ của chương, xóa khi `ST.reset()` |
| `S.stats` | Xuyên chương: `warned`, `scammed`, `sales`, `wallet`, `freed`, `caughtTotal` |
| `G.OBJ` | Danh sách nhiệm vụ, mục đầu tiên chưa xong và không `opt` là nhiệm vụ hiện tại |
| `G.INTER` | Các điểm tương tác |
| `G.LOC` | Tọa độ mốc của bản đồ đang nạp |
| `G.npcs`, `G.guards`, `G.doors` | NPC kịch bản, lính, cửa |

### Số chương và checkpoint

| `S.chapter` | Nội dung | Lưu checkpoint |
| --- | --- | --- |
| 0 | Mở đầu | Không |
| 1 | S-7 | 1 (không hiện nút Chơi tiếp) |
| 2, 3, 4 | Trại rừng, lò gạch, bến sông | 2, 3, 4 |
| 5 | Chuyến bay | 5 |
| 6 | Đoàn tụ | Đặt về 1 |
| 11, 12, 13 | Đường tối, ca 1–3 | 11, 12, 13 |
| 14 | Lính canh | **Không**, checkpoint vẫn là 13 |

Dữ liệu người chơi nằm trong localStorage với tiền tố `mnbl-`, checkpoint là `mnbl-ckpt`.

## 11. Cách viết thêm nội dung

### Mẫu một cảnh

Đây là code minh họa, `tenBanDo` và `diemDen` là tên giả định.

```js
(function (G) {
'use strict';
const ST = G.story, S = G.state, P = G.player, ui = G.ui;
const { run, say, card, fx } = ST;

ST.startMoi = function () {
  ST.reset(); S.chapter = 20; S.phase = 'moi'; G.saveCheckpoint(20); ui.black(false);
  G.loadLevel('tenBanDo'); G.setTime(8); ui.hud(false);
  G.placePlayer(0, 0, Math.PI); P.frozen = true;
  ST.respawn = () => ({ x: 0, z: 0, yaw: Math.PI });
  ST.tick = () => {};
  run([
    card([{ t: 'Tên cảnh', c: 'place' }, { t: 'Lời dẫn.' }]),
    say([['Tên người nói', 'Lời thoại.'], ['', 'Lời kể không có người nói.']]),
    fx(() => { P.frozen = false; ui.hud(true); }),
  ], () => {
    G.OBJ = [{ t: 'Tới điểm hẹn', at: () => G.LOC.diemDen, done: () => S.f.toi, time: 60, lv: 1 }];
    G.INTER = [{ at: () => G.LOC.diemDen, r: 1.8, when: () => !S.f.toi,
      label: 'Kiểm tra', hold: 1, run: () => { S.f.toi = true; } }];
  });
};
})(window.G);
```

### API kịch bản

| API | Công dụng |
| --- | --- |
| `ST.run(steps, done)` | Chạy các bước tuần tự, mỗi bước nhận `next` |
| `ST.say`, `ST.card`, `ST.wait`, `ST.fx` | Tạo bước thoại, thẻ chữ, chờ, hành động |
| `ST.chapterCard(n, name, sub)` | Thẻ mở chương |
| `ST.workShift(ids, boss, done)` | Chạy nhiều ca lừa |
| `ui.choose(who, text, options)` | Lựa chọn `{ label, sub, fn }` |
| `ui.phoneChat(head, msgs, done, opt)` | Chat điện thoại, người gửi là `me`, `them` hoặc `sys` |
| `ui.toast`, `ui.fade`, `ui.flash`, `ui.hud` | Thông báo và màn hình |
| `G.cine`, `G.cineOff` | Camera cảnh cắt |
| `G.addNpc`, `G.npcGo` | Tạo và di chuyển NPC |
| `G.makeNoise`, `G.openDoor`, `G.sfx` | Tiếng động cho AI, cửa, âm thanh |

### Thêm bản đồ

1. Tạo file trong `js/levels/`, gán `G.LEVELS.ten = { build() { … } }`.
2. Trong `build`, điền `G.LOC`, thêm vật thể bằng `G.add` hoặc `G.box`, va chạm bằng `G.addCollider`.
3. Trả về `bounds`, `compound`, `guards`, `lights`, `overcast`, `rain`, `lightning`, `fogMul`. Xem `js/levels/kiln.js` làm mẫu.
4. Thêm thẻ script **trước** `js/game.js`.

### Thêm chương: những chỗ phải sửa

- [ ] Dùng số chương chưa có người dùng, ví dụ từ 20. **Số 5, 6 và 11–14 đã dùng.**
- [ ] Thêm vào bảng trong `ST.retry` (`js/story.js`).
- [ ] Sửa khối nút Chơi tiếp cuối `js/story2.js`: điều kiện `ck.ch <= 13`, bảng tên và bảng hàm.
- [ ] Có đồng hồ thì thêm lời chết vào `DEATH` (`js/story.js`) và xem lại nơi chơi lại khi hết giờ.
- [ ] Xem `updateHud` (`js/game.js`): hiện chỉ `ch4` và `airport` ẩn nợ và số lần bị bắt.
- [ ] Nối từ cảnh trước, xem lại chữ “Hoàn thành 4 bản đồ ở Campuchia” và màn tiêu đề.
- [ ] Cập nhật file này và README.

### Thêm bản đồ nhiều người

- [ ] Thêm mục `MAPS` trong `js/story2.js` với đủ khóa như `MAPS.kiln`, gồm cả khối `bot`.
- [ ] Thêm id vào `MAPS` và mọi sự kiện mới vào `WORLD_KEYS` (thêm cả `HOST_KEYS` nếu chỉ chủ phòng được phát) trong `server.js`. Thiếu thì server **âm thầm bỏ qua**.
- [ ] Giới hạn giao thức: tối đa 16 lính mỗi bản đồ, mã giữ phối hợp và tên tư thế tối đa 8 ký tự, mã `say` tối đa 12 ký tự.
- [ ] Khởi động lại server, thử bằng hai client thật và một ván với bot.

### Bẫy thường gặp

- **Đóng hội thoại tự mở khóa người chơi** và xóa tư thế. Trong cảnh cắt phải khóa lại, xem `sayHold` trong `js/escape.js`.
- **`ST.reset()` không xóa `S.stats` và `S.debt`.**
- **`ST.wait`, `setTimeout`, `setInterval` không dừng khi tạm dừng** và không tự hủy khi đổi chương. Callback dài phải tự kiểm tra `S.phase`.
- **Bản đồ phải giống nhau trên mọi máy:** dựng bằng `G.rand` hoặc `G.rr`, không dùng `Math.random`.
- **Lính được đồng bộ theo thứ tự trong mảng**, nên mọi client phải tạo cùng danh sách.
- **`G.loadLevel` và `G.applyWorld` được nhiều module bọc lại.** Đừng gán đè mà không gọi bản trước.
- **Không nâng three.js tùy tiện:** code dùng API của r128 như `outputEncoding`.
- **Chữ do người chơi nhập** chỉ hiển thị bằng `textContent`, không bằng `innerHTML`.
- **Mức đồ họa Điện thoại bỏ hậu kỳ**, hiệu ứng mới phải thử riêng ở mức này.

## 12. Chạy và kiểm thử

```sh
git clone https://github.com/troynguyeen/mot-ngay-bi-lua.git
cd mot-ngay-bi-lua
node server.js
```

Mở `http://localhost:8765`. Cần Internet để tải three.js và font. Không mở trực tiếp `index.html`.

Kiểm tra cú pháp:

```powershell
# PowerShell
Get-ChildItem server.js, js\*.js, js\levels\*.js | ForEach-Object { node --check $_.FullName }
```

```sh
# bash
for f in server.js js/*.js js/levels/*.js; do node --check "$f"; done
```

Nhảy cảnh trong Console của trình duyệt (ghi đè checkpoint của trình duyệt đó):

```js
document.getElementById('title').hidden = true;
G.story.startCh1();      // hoặc: startCh2, startCh3, startCh4
// G.story.flightHome(); // kết chính
// G.story.startDark();  // Đường tối
```

Checklist trước khi báo xong:

- [ ] Không lỗi cú pháp, không lỗi Console.
- [ ] Chơi phần vừa sửa và chương liền trước, liền sau.
- [ ] Thử thua: bị bắt 3 lần, hết giờ, Chơi lại chương, tải lại trang rồi Chơi tiếp.
- [ ] Sửa phần dùng chung thì thử cả hai nhánh kết và một ván đội có bot.
- [ ] Thử màn dọc của điện thoại và mức đồ họa Điện thoại.
- [ ] Ghi rõ cái gì chưa thử.

## 13. Việc còn lại

### Đã có

- [x] Mở đầu, 4 chương, kết về nhà, Đường tối với 3 kết.
- [x] 6 ca lừa đảo.
- [x] 3 bản đồ đồng đội, bot, tùy chọn ván. Bản đồ thứ tư đang hoàn thiện.
- [x] Tạo nhân vật, chuyển động IK, đồ họa nhiều mức, điều khiển cảm ứng.

Ngày 22/11/2026, cả kết về nhà và kết “Quản lý lừa đảo” đã được chạy tự động tới màn cuối, không lỗi Console. Lượt chạy này **dịch chuyển nhân vật và tắt việc bị bắt**, nên chỉ chứng minh mạch truyện nối được, không chứng minh độ khó.

### Việc đang làm dở

**Bản đồng đội của Chương 4 và chuyến bay về nước.** Hiện trạng lúc 10:02 ngày 22/11/2026.

Thiết kế, theo phần đầu `js/team_escape.js`:

- Một ván có ba chặng (`S.teamLeg`): 0 là bản đồ đang chơi, 1 là bến sông, 2 là sân bay. Trạng thái mỗi người gửi kèm chặng trong trường `e`.
- Vào bến sông từ rào tây của lò gạch, hoặc chọn thẳng bản đồ `river`.
- Chủ phòng tính kẻ đuổi và bot, gửi gói `esc` và `rock`. Mỗi người tự tính đá trúng mình.
- Gục thì đồng đội đỡ dậy, hoặc tự dậy sau 10 giây. Cả đội cùng gục là thua.
- Cảnh cắt chạy theo dòng thời gian, không bấm để qua, và đứng lại khi cả phòng tạm dừng.

| Phần | Hiện trạng lúc 10:02 |
| --- | --- |
| Engine `G.esc` trong `js/escape.js` | Xong |
| Logic ba chặng trong `js/team_escape.js` | Đã viết, còn đang được chỉnh |
| Thẻ script và phụ đề `#subline` trong `index.html` | Đã nối |
| Map, sự kiện, gói `esc` / `rock` trong `server.js` và `js/net.js` | Đã nối |
| Lò gạch đổi lối ra từ cổng sau sang rào tây, bot theo chặng | Đã nối |
| Cú pháp, bản chơi một mình | Đã kiểm tra, không lỗi |
| **Nhiều client, bot, đổi chủ phòng, tạm dừng giữa cảnh cắt, điện thoại** | **Chưa được xác nhận** |
| README | Chưa cập nhật |

Khi nhận việc: đọc code mới nhất và chơi thử trước, vì phần này có thể đã đổi sau khi file được viết. Viết tiếp trên `G.esc`, không sao chép `js/escape.js`. Kiểm thử xong thì bỏ các nhãn chưa kiểm thử và xóa mục này.

### A. Lỗi và điểm lệch đã biết

| # | Vấn đề | Nơi sửa | Cần chủ dự án quyết? |
| --- | --- | --- | --- |
| A1 | `server.js` kiểm tra đầu vào HTTP và WebSocket chưa chặt. Cần bắt lỗi theo từng request và chỉ phục vụ `index.html`, `js/`, `sfx/`. **Làm trước khi mở server ra Internet** | `server.js` | Không |
| A2 | Chơi lại chương không khôi phục `S.stats` và `S.debt` theo checkpoint, nên doanh số và số người cảnh báo cộng dồn, có thể vượt 6/6 | `ST.retry` | Không |
| A3 | Cảnh lính canh không có checkpoint, chơi lại thì về ca 3 và cộng thêm doanh số | `ST.darkVerdict`, `ST.retry` | Không |
| A4 | Tạm dừng không dừng các bước hẹn giờ của cảnh cắt | `ST.wait` và các `setInterval` | Không |
| A5 | Bay lúc khoảng 08:12, thẻ chữ ghi “Một giờ sau” nhưng hạ cánh 16:24 | `flightBoard`, `flightLand` | Chọn giờ |
| A6 | Chương 3 xong lúc nào thì Chương 4 cũng mở lúc 05:58, sau hạn 05:30, dù lời dẫn nói đèn vừa tắt | `ST.startCh4` | Chọn giờ |
| A7 | Cứu Hùng không được tính vào số người Nam cứu và không ảnh hưởng kết | `js/story.js` | Có |
| A8 | Màn kết khuyên gọi 113, số này dành cho trong nước. Cần thêm kênh dùng được ở nước ngoài, lấy từ nguồn chính thức | `#end-signs` trong `index.html` | Không |
| A9 | README thiếu Chương 4, sân bay, `js/escape.js`. Màn tiêu đề mới nêu 3 địa điểm | `README.md`, `index.html` | Không |
| A10 | Chưa xác nhận quyền phân phối âm thanh trong `sfx/`: tiếng điện cắt từ bản ghi của bên thứ ba, giọng nói tạo bằng TTS của Windows. Repo cũng chưa có giấy phép | `sfx/`, gốc repo | Có |

### B. Chưa kiểm chứng

- Cân bằng độ khó bằng người chơi thật, nhất là Chương 4.
- Điện thoại thật, gồm mục tiêu iPhone 13 60 FPS (mới giả lập và ước tính).
- Máy yếu và card đồ họa tích hợp.
- Nhiều người thật ở các mạng khác nhau.
- Việc chặn Ctrl+W bằng bàn phím thật khi toàn màn hình.
- Nghe duyệt hiệu ứng âm thanh.

### C. Giới hạn kỹ thuật hiện có

- Không có vật lý vải và tóc, ngón tay tĩnh, chân chưa bám theo độ dốc.
- Trời là nền chuyển màu, chưa có mây.
- Không có test tự động trong repo.
- Chế độ nhiều người cần `server.js`, host tĩnh không chạy được.

### D. Tuyến truyện còn bỏ ngỏ

Đây là các khoảng trống có thật trong kịch bản, chưa có đáp án:

1. Chú Bảy có được cứu khi S-7 bị đột kích không? Lời hứa “báo người vào cứu tụi chú” chưa được khép lại.
2. Hùng sống hay chết, và việc cứu Hùng có ý nghĩa gì?
3. Dì Sophea có thoát không? Ai chuyển chiếc điện thoại cho dì?
4. Bốn người ở trại rừng và năm người ở phòng giam giữ đi đâu?
5. Chị Hương, lễ tân và văn phòng tuyển người ở Việt Nam có bị triệt phá không?
6. Trùm, Trùm Sẹo, tài xế tuk-tuk bị xử lý ra sao?
7. Trùm nói “Ở đây mạng nào tao cũng nghe được”: nghe lén hay có nội gián?
8. Khoản nợ anh Hải và việc tái hòa nhập của Nam diễn ra thế nào?
9. Những người đã mất tiền qua tay Nam có lấy lại được không?

### E. [GỢI Ý] Hướng phát triển, phải được duyệt trước khi làm

| Gợi ý | Khép tuyến | Cỡ việc |
| --- | --- | --- |
| Thẻ chữ hậu truyện: số phận Chú Bảy, Hùng, Dì Sophea | D1–D3 | Nhỏ |
| Câu kết và bảng tổng kết phản ánh việc cứu Hùng | D2, A7 | Nhỏ |
| Chương hậu truyện: Nam lấy lời khai, nhận diện kẻ tuyển dụng, giúp triệt phá văn phòng | D5, D6 | Lớn |
| Cảnh Nam gặp lại một nạn nhân, đổi theo lựa chọn cảnh báo | D9 | Vừa |
| Cảnh gia đình xử lý chủ nợ qua công an | D8 | Vừa |
| Thêm ca lừa theo khuôn mục 6 | Không | Vừa |

Thứ tự đề nghị: A1 → việc đang làm dở → A2, A3 → các lỗi A còn lại → kiểm chứng B → chọn tuyến D cùng chủ dự án → làm nội dung mới.

## 14. Quy trình cập nhật

1. `git pull` trước khi làm, tạo nhánh riêng cho mỗi việc.
2. Sửa gọn, theo phong cách code sẵn có, không thêm bước build nếu chưa được duyệt.
3. Chạy checklist ở mục 12.
4. Cập nhật file này trong cùng commit: cốt truyện vào mục 2–8, quyết định mới vào mục 9, việc xong hoặc lỗi mới vào mục 13, rồi thêm một dòng vào nhật ký.
5. Repo công khai: **không commit** token, email cá nhân, IP, link ngrok, đường dẫn máy cá nhân hay file `.env`. Không commit thư mục `.claude/`.

### Nhật ký

| Ngày | Thay đổi |
| --- | --- |
| 09–10/11/2026 | Bản đầu: mở đầu, 3 chương, Đường tối, nhiều người. Sau đó thêm đồng hồ nhiệm vụ và chế độ đội |
| 11/11/2026 | Tạm dừng cả đội, camera và minimap, âm thanh bị bắt, chỉnh đèn pha |
| 18/11/2026 | Đại tu đồ họa HD–4K, toàn màn hình, README |
| 19/11/2026 | Trình tạo nhân vật |
| 20–21/11/2026 | Chuyển động theo logic người thật, đủ 3 bản đồ đội, tắt nhạc nền, đồ họa điện thoại |
| 22/11/2026 | Tùy chọn ván đội, Chương 4, chuyến bay về nước, tài liệu bàn giao này. Bắt đầu bản đồng đội của Chương 4 |
