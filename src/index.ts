import dotenv from 'dotenv';
import { AttendanceBot } from './bot/telegram.bot';
import { OdooService } from './services/odoo.service';

// Load environment variables
dotenv.config();

// Validate environment variables
const requiredEnvVars = [
  'TELEGRAM_BOT_TOKEN',
  'ODOO_URL',
  'ODOO_DB',
  'ODOO_USERNAME',
  'ODOO_PASSWORD',
  'ALLOWED_USER_IDS'
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`❌ Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

// Parse allowed user IDs
const allowedUserIds = process.env.ALLOWED_USER_IDS!
  .split(',')
  .map(id => parseInt(id.trim()))
  .filter(id => !isNaN(id));

if (allowedUserIds.length === 0) {
  console.error('❌ No valid user IDs found in ALLOWED_USER_IDS');
  process.exit(1);
}

console.log('🚀 Starting Attendance Odoo Bot...');
console.log('📋 Configuration:');
console.log(`   Odoo URL: ${process.env.ODOO_URL}`);
console.log(`   Database: ${process.env.ODOO_DB}`);
console.log(`   Username: ${process.env.ODOO_USERNAME}`);
console.log(`   Allowed Users: ${allowedUserIds.join(', ')}`);

// Initialize services
const odooService = new OdooService({
  url: process.env.ODOO_URL!,
  database: process.env.ODOO_DB!,
  username: process.env.ODOO_USERNAME!,
  password: process.env.ODOO_PASSWORD!,
});

// Initialize bot
const bot = new AttendanceBot(
  process.env.TELEGRAM_BOT_TOKEN!,
  odooService,
  allowedUserIds
);

// Start bot
bot.start();

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down...');
  bot.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down...');
  bot.stop();
  process.exit(0);
});
