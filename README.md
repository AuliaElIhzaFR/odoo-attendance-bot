# 🤖 Attendance Odoo Bot

Bot Telegram untuk otomatis absen (check-in/check-out) di Odoo tanpa perlu buka website.

## ✨ Fitur

- ✅ Check-in otomatis via Telegram
- ✅ Check-out otomatis via Telegram
- ✅ Session management otomatis
- ✅ Authorization (hanya user tertentu yang bisa akses)
- ✅ Menggunakan API langsung (bukan Puppeteer) - lebih cepat & efisien

## 🚀 Quick Start

Ada 2 cara menjalankan bot ini:

---

### 🐳 Option 1: Pakai Docker (Recommended)

Paling mudah! Ga perlu install Node.js.

**Langkah-langkah:**

```bash
# 1. Clone repository
git clone <repo-url>
cd attendance-odoo-bot

# 2. Setup credentials
cd misc/docker
cp .env.example .env
nano .env  # atau vim/code - edit dengan data kamu

# 3. Jalankan bot
docker-compose up -d

# 4. Lihat logs
docker-compose logs -f
```

✅ Bot sudah jalan! Test dengan kirim `/start` ke bot di Telegram.

**Commands:**
```bash
# Stop bot
docker-compose down

# Restart after code changes
docker-compose down && docker-compose up -d --build

# View logs
docker-compose logs -f
```

---

### 💻 Option 2: Pakai Node.js (Development)

Untuk development atau kalau mau edit code.

### 1. Clone & Install Dependencies

```bash
npm install
```

### 2. Setup Environment Variables

Copy file `.env.example` menjadi `.env`:

```bash
cp .env.example .env
```

Edit file `.env` dan isi dengan data kamu:

```env
# Telegram Bot Token - dapatkan dari @BotFather
TELEGRAM_BOT_TOKEN=your_bot_token_here

# Odoo Configuration
ODOO_URL=https://apps.yasaweb.com
ODOO_DB=stk
ODOO_USERNAME=your_email@gmail.com
ODOO_PASSWORD=your_password

# Telegram User IDs yang diizinkan (pisahkan dengan koma)
# Dapatkan ID kamu dari @userinfobot di Telegram
ALLOWED_USER_IDS=123456789
```

### 3. Cara Mendapatkan Bot Token

1. Buka Telegram dan cari `@BotFather`
2. Kirim command `/newbot`
3. Ikuti instruksi untuk memberi nama bot
4. Copy token yang diberikan ke `.env`

### 4. Cara Mendapatkan User ID

1. Buka Telegram dan cari `@userinfobot`
2. Klik Start
3. Bot akan memberikan User ID kamu
4. Masukkan ID tersebut ke `ALLOWED_USER_IDS` di `.env`

### 5. Jalankan Bot

**Development mode (dengan auto-reload):**
```bash
npm run dev
```

**Production mode:**
```bash
npm run build
npm start
```

## 📱 Cara Menggunakan

Setelah bot running, buka Telegram dan cari bot kamu:

### Commands:

- `/start` - Mulai bot dan lihat menu
- `/checkin` - Check-in attendance
- `/checkout` - Check-out attendance
- `/status` - Cek status attendance (coming soon)
- `/help` - Bantuan

### Contoh Penggunaan:

1. **Check-in saat mulai kerja:**
   ```
   /checkin
   ```
   Bot akan response: ✅ Check-in Berhasil! ⏰ Waktu: 09:00 WIB

2. **Check-out saat selesai kerja:**
   ```
   /checkout
   ```
   Bot akan response: ✅ Check-out Berhasil! ⏰ Waktu: 17:00 WIB

## 🏗️ Arsitektur

### Kenapa Pakai API, Bukan Puppeteer?

✅ **Keuntungan menggunakan API:**
- Lebih cepat (tidak perlu load browser)
- Resource lebih ringan (RAM & CPU)
- Lebih reliable (tidak bergantung pada UI)
- Lebih mudah di-maintain

### Flow Kerja:

```
User → Telegram Bot → OdooService → Odoo API
                         ↓
                   Login (get session)
                         ↓
                Check-in/out dengan session
```

### Struktur Kode:

```
src/
├── index.ts              # Entry point
├── bot/
│   └── telegram.bot.ts   # Telegram bot handler
└── services/
    └── odoo.service.ts   # Odoo API integration
```

## 🔧 Troubleshooting

### Bot tidak merespon
- Pastikan bot sudah running (`npm run dev`)
- Check apakah `TELEGRAM_BOT_TOKEN` benar
- Pastikan User ID kamu ada di `ALLOWED_USER_IDS`

### Login gagal ke Odoo
- Pastikan `ODOO_USERNAME` dan `ODOO_PASSWORD` benar
- Check apakah `ODOO_URL` bisa diakses
- Check apakah `ODOO_DB` benar

### Session expired
- Bot akan otomatis login ulang jika session expired
- Jika masih gagal, restart bot

## 📝 Notes

- Bot ini menggunakan session-based authentication
- Session akan di-maintain selama bot running
- Jika bot di-restart, akan login ulang otomatis
- Hanya user yang ada di `ALLOWED_USER_IDS` yang bisa akses

## 🔐 Security

- Jangan commit file `.env` ke git
- Simpan credentials dengan aman
- Gunakan `ALLOWED_USER_IDS` untuk restrict akses

## 📄 License

MIT

---

Made with ❤️ for easier attendance management
