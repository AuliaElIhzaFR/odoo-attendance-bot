import TelegramBot from 'node-telegram-bot-api';
import { OdooService } from '../services/odoo.service';

export class AttendanceBot {
  private bot: TelegramBot;
  private odooService: OdooService;
  private allowedUserIds: Set<number>;

  constructor(
    botToken: string,
    odooService: OdooService,
    allowedUserIds: number[]
  ) {
    this.bot = new TelegramBot(botToken, { polling: true });
    this.odooService = odooService;
    this.allowedUserIds = new Set(allowedUserIds);
    
    this.setupCommands();
    this.setupErrorHandler();
  }

  private setupCommands(): void {
    // Command: /start
    this.bot.onText(/\/start/, async (msg) => {
      const chatId = msg.chat.id;
      const userId = msg.from?.id;

      if (!this.isAuthorized(userId)) {
        await this.bot.sendMessage(chatId, '❌ Anda tidak memiliki akses ke bot ini.');
        return;
      }

      const welcomeMessage = `
🤖 *Attendance Odoo Bot*

Selamat datang! Bot ini akan membantu kamu untuk absen di Odoo.

*Available Commands:*
/checkin - Check in attendance
/checkout - Check out attendance
/help - Tampilkan pesan bantuan

Gunakan command di atas untuk mulai absen! 🚀
      `.trim();

      await this.bot.sendMessage(chatId, welcomeMessage, { parse_mode: 'Markdown' });
    });

    // Command: /checkin
    this.bot.onText(/\/checkin/, async (msg) => {
      const chatId = msg.chat.id;
      const userId = msg.from?.id;

      if (!this.isAuthorized(userId)) {
        await this.bot.sendMessage(chatId, '❌ Anda tidak memiliki akses ke bot ini.');
        return;
      }

      try {
        // Send loading message
        const loadingMsg = await this.bot.sendMessage(chatId, '⏳ Sedang melakukan check-in...');

        // Perform check-in
        const result = await this.odooService.checkIn();

        // Delete loading message
        await this.bot.deleteMessage(chatId, loadingMsg.message_id);

        // Send result
        if (result.success) {
          const now = new Date();
          const timeString = now.toLocaleTimeString('id-ID', { 
            timeZone: 'Asia/Jakarta',
            hour: '2-digit',
            minute: '2-digit'
          });
          
          await this.bot.sendMessage(
            chatId,
            `✅ *Check-in Berhasil!*\n\n⏰ Waktu: ${timeString} WIB`,
            { parse_mode: 'Markdown' }
          );
        } else {
          await this.bot.sendMessage(chatId, result.message);
        }
      } catch (error: any) {
        console.error('Error handling /checkin:', error);
        await this.bot.sendMessage(
          chatId,
          `❌ Terjadi kesalahan: ${error.message}`
        );
      }
    });

    // Command: /checkout
    this.bot.onText(/\/checkout/, async (msg) => {
      const chatId = msg.chat.id;
      const userId = msg.from?.id;

      if (!this.isAuthorized(userId)) {
        await this.bot.sendMessage(chatId, '❌ Anda tidak memiliki akses ke bot ini.');
        return;
      }

      try {
        // Send loading message
        const loadingMsg = await this.bot.sendMessage(chatId, '⏳ Sedang melakukan check-out...');

        // Perform check-out
        const result = await this.odooService.checkOut();

        // Delete loading message
        await this.bot.deleteMessage(chatId, loadingMsg.message_id);

        // Send result
        if (result.success) {
          const now = new Date();
          const timeString = now.toLocaleTimeString('id-ID', { 
            timeZone: 'Asia/Jakarta',
            hour: '2-digit',
            minute: '2-digit'
          });
          
          await this.bot.sendMessage(
            chatId,
            `✅ *Check-out Berhasil!*\n\n⏰ Waktu: ${timeString} WIB`,
            { parse_mode: 'Markdown' }
          );
        } else {
          await this.bot.sendMessage(chatId, result.message);
        }
      } catch (error: any) {
        console.error('Error handling /checkout:', error);
        await this.bot.sendMessage(
          chatId,
          `❌ Terjadi kesalahan: ${error.message}`
        );
      }
    });

    // Command: /status
    this.bot.onText(/\/status/, async (msg) => {
      const chatId = msg.chat.id;
      const userId = msg.from?.id;

      if (!this.isAuthorized(userId)) {
        await this.bot.sendMessage(chatId, '❌ Anda tidak memiliki akses ke bot ini.');
        return;
      }

      try {
        const status = await this.odooService.getAttendanceStatus();
        const statusText = status.isCheckedIn ? '✅ Sudah Check-in' : '❌ Belum Check-in';
        
        await this.bot.sendMessage(
          chatId,
          `📊 *Status Attendance*\n\n${statusText}`,
          { parse_mode: 'Markdown' }
        );
      } catch (error: any) {
        console.error('Error handling /status:', error);
        await this.bot.sendMessage(
          chatId,
          `❌ Terjadi kesalahan: ${error.message}`
        );
      }
    });

    // Command: /help
    this.bot.onText(/\/help/, async (msg) => {
      const chatId = msg.chat.id;
      const userId = msg.from?.id;

      if (!this.isAuthorized(userId)) {
        await this.bot.sendMessage(chatId, '❌ Anda tidak memiliki akses ke bot ini.');
        return;
      }

      const helpMessage = `
📖 *Bantuan - Attendance Odoo Bot*

*Perintah yang tersedia:*

/checkin - Untuk check-in attendance
/checkout - Untuk check-out attendance  
/help - Tampilkan pesan bantuan ini

*Cara Penggunaan:*
1. Gunakan /checkin saat mulai kerja
2. Gunakan /checkout saat selesai kerja
3. Bot akan otomatis login dan absen ke Odoo

*Catatan:*
- Bot ini hanya bisa digunakan oleh user yang sudah diizinkan
- Pastikan kredensial Odoo sudah benar di file .env

Jika ada masalah, hubungi admin! 👨‍💻
      `.trim();

      await this.bot.sendMessage(chatId, helpMessage, { parse_mode: 'Markdown' });
    });
  }

  private setupErrorHandler(): void {
    this.bot.on('polling_error', (error) => {
      console.error('Polling error:', error);
    });

    this.bot.on('error', (error) => {
      console.error('Bot error:', error);
    });
  }

  private isAuthorized(userId: number | undefined): boolean {
    if (!userId) return false;
    return this.allowedUserIds.has(userId);
  }

  public start(): void {
    console.log('🤖 Bot started successfully!');
    console.log('📝 Waiting for commands...');
  }

  public stop(): void {
    this.bot.stopPolling();
    console.log('🛑 Bot stopped');
  }
}
