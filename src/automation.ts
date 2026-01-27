import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { OdooService } from './services/odoo.service';

// Load environment variables
const rootEnv = path.join(process.cwd(), '.env');
const dockerEnv = path.join(process.cwd(), 'misc/docker/.env');

if (fs.existsSync(rootEnv)) {
  dotenv.config({ path: rootEnv });
} else if (fs.existsSync(dockerEnv)) {
  dotenv.config({ path: dockerEnv });
} else {
  dotenv.config(); // fallback to default
}

// Validate required environment variables
const requiredEnvVars = [
  'ODOO_URL',
  'ODOO_DB',
  'ODOO_USERNAME',
  'ODOO_PASSWORD',
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`❌ Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

const odooService = new OdooService({
  url: process.env.ODOO_URL!,
  database: process.env.ODOO_DB!,
  username: process.env.ODOO_USERNAME!,
  password: process.env.ODOO_PASSWORD!,
});

async function run() {
  const command = process.argv[2];

  if (command === 'checkin') {
    try {
      console.log('🚀 Automated Check-in triggered by VS Code opening...');

      // Check status first to avoid redundant check-in
      const status = await odooService.getAttendanceStatus();
      if (status.isCheckedIn) {
        console.log(`✅ Already checked in as ${status.employeeName}. Skipping.`);
        return;
      }

      const result = await odooService.checkIn();
      console.log(result.message);
    } catch (error: any) {
      console.error('❌ Check-in Command Error:', error.message);
    }
  } else if (command === 'checkout') {
    try {
      const now = new Date();
      const hour = now.getHours();

      // Rule: Check-out only if it's 17:00 (5 PM) or later
      if (hour >= 17) {
        console.log('🚀 Automated Check-out triggered by VS Code closing (Post 5 PM)...');

        // Check status first
        const status = await odooService.getAttendanceStatus();
        if (!status.isCheckedIn) {
          console.log('❌ Not checked in. Skipping check-out.');
          return;
        }

        const result = await odooService.checkOut();
        console.log(result.message);
      } else {
        console.log(`ℹ️ Automated Check-out skipped. Current time is ${hour}:${now.getMinutes().toString().padStart(2, '0')} (Before 5 PM).`);
      }
    } catch (error: any) {
      console.error('❌ Check-out Command Error:', error.message);
    }
  } else {
    console.error('❌ Unknown command. Use "checkin" or "checkout".');
    process.exit(1);
  }
}

run().catch(err => {
  console.error('❌ fatal Error:', err);
  process.exit(1);
});
