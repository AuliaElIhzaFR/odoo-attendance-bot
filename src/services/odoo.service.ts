import * as fs from 'fs';
import * as https from 'https';
import axios, { AxiosInstance } from 'axios';

export interface OdooConfig {
  url: string;
  database: string;
  username: string;
  password: string;
}

export class OdooService {
  private axiosInstance: AxiosInstance;
  private config: OdooConfig;
  private sessionId: string | null = null;
  private csrfToken: string | null = null;
  private isRetrying: boolean = false;

  constructor(config: OdooConfig) {
    this.config = config;
    
    // Create axios instance dengan cookie jar
    this.axiosInstance = axios.create({
      baseURL: config.url,
      timeout: 30000,
      maxRedirects: 5, // Set default redirects at instance level
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      // Disable SSL verification jika perlu (untuk development)
      httpsAgent: new https.Agent({
        rejectUnauthorized: false
      }),
      withCredentials: true,
    });
  }

  /**
   * Login ke Odoo dan dapatkan session
   */
  async login(): Promise<boolean> {
    try {
      console.log('🔐 Logging in to Odoo...');
      
      // Step 0: Request homepage first to get Cloudflare cookies
      console.log('📡 Getting Cloudflare cookies from homepage...');
      const homepageResponse = await axios.get(
        `${this.config.url}/`,
        {
          headers: {
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          },
          httpsAgent: new https.Agent({
            rejectUnauthorized: false
          }),
        }
      );
      
      // Extract Cloudflare cookies
      const cfCookies = homepageResponse.headers['set-cookie'];
      let cookieString = '';
      if (cfCookies) {
        cookieString = cfCookies.map((c: string) => c.split(';')[0]).join('; ');
        console.log('🍪 Got Cloudflare cookies:', cookieString.substring(0, 100) + '...');
      }
      
      // Step 1: Get login page dengan Cloudflare cookies
      console.log('📡 Requesting login page with cookies...');
      
      let loginPageResponse = await axios.get(
        `${this.config.url}/web/login?db=${this.config.database}`,
        {
          headers: {
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            'Cookie': cookieString,
            'Referer': `${this.config.url}/`,
          },
          httpsAgent: new https.Agent({
            rejectUnauthorized: false
          }),
          maxRedirects: 0, // Don't follow redirects
          validateStatus: (status) => status < 500,
        }
      ).catch(err => {
        if (err.response) {
          console.log('📊 Got redirect/error:', err.response.status);
          return err.response;
        }
        throw err;
      });
      
      console.log('📊 Login page status:', loginPageResponse.status);
      
      // If we got a redirect, follow it manually
      if (loginPageResponse.status === 302 || loginPageResponse.status === 303) {
        const location = loginPageResponse.headers['location'];
        console.log('📍 Server redirected to:', location);
        
        // Update cookies if server sent new ones
        const newCookies = loginPageResponse.headers['set-cookie'];
        if (newCookies) {
          cookieString = newCookies.map((c: string) => c.split(';')[0]).join('; ');
          console.log('🍪 Updated cookies');
        }
        
        // Follow the redirect
        loginPageResponse = await axios.get(
          location.startsWith('http') ? location : `${this.config.url}${location}`,
          {
            headers: {
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
              'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
              'Cookie': cookieString,
              'Referer': `${this.config.url}/web/login?db=${this.config.database}`,
            },
            httpsAgent: new https.Agent({
              rejectUnauthorized: false
            }),
          }
        );
        console.log('📊 After redirect, status:', loginPageResponse.status);
      }
      
      console.log('📊 Data preview:', loginPageResponse.data?.substring(0, 200));
      
      // Extract CSRF token dari response HTML
      const htmlContent = loginPageResponse.data;
      
      // Try multiple patterns untuk find CSRF token
      let csrfToken = null;
      
      // Pattern 1: input field (most common)
      const inputMatch = htmlContent.match(/<input[^>]*name=["']csrf_token["'][^>]*value=["']([^"']+)["']/i);
      if (inputMatch) {
        csrfToken = inputMatch[1];
      }
      
      // Pattern 2: reverse order
      if (!csrfToken) {
        const inputMatch2 = htmlContent.match(/<input[^>]*value=["']([^"']+)["'][^>]*name=["']csrf_token["']/i);
        if (inputMatch2) {
          csrfToken = inputMatch2[1];
        }
      }
      
      // Pattern 3: JavaScript variable
      if (!csrfToken) {
        const jsMatch = htmlContent.match(/csrf_token["']?\s*[:=]\s*["']([a-zA-Z0-9]+)["']/i);
        if (jsMatch) {
          csrfToken = jsMatch[1];
        }
      }
      
      // Pattern 4: odoo session info
      if (!csrfToken) {
        const odooMatch = htmlContent.match(/"csrf_token"\s*:\s*"([^"]+)"/i);
        if (odooMatch) {
          csrfToken = odooMatch[1];
        }
      }
      
      // Pattern 5: Look for any token-like string in the HTML
      if (!csrfToken) {
        const tokenMatch = htmlContent.match(/([a-f0-9]{40,}o\d+)/i);
        if (tokenMatch) {
          csrfToken = tokenMatch[1];
          console.log('   Found token-like pattern:', csrfToken.substring(0, 20) + '...');
        }
      }
      
      this.csrfToken = csrfToken;
      
      // Extract session_id dari cookies  
      // Update cookieString with session from login page
      const pageCookies = loginPageResponse.headers['set-cookie'];
      if (pageCookies) {
        const sessionCookie = pageCookies.find((c: string) => c.startsWith('session_id='));
        if (sessionCookie) {
          this.sessionId = sessionCookie.split(';')[0].split('=')[1];
          // Update cookieString to use for POST
          const otherCookies = cookieString.split('; ').filter(c => !c.startsWith('session_id='));
          cookieString = [...otherCookies, `session_id=${this.sessionId}`].join('; ');
        }
      }

      console.log('📝 CSRF Token:', this.csrfToken ? `✓ ${this.csrfToken.substring(0, 30)}...` : '✗ Not found');
      console.log('🍪 Session ID for POST:', this.sessionId?.substring(0, 20) + '...');

      if (!this.csrfToken) {
        console.error('❌ CSRF token is REQUIRED but not found!');
        console.log('   Saving HTML to debug...');
        // Log a sample of HTML to debug
        console.log('   HTML sample:', htmlContent.substring(0, 500));
        fs.writeFileSync('odoo_login_page.html', htmlContent);
        return false;
      }

      // Step 2: Submit login form (include all required fields from original cURL)
      const loginData = new URLSearchParams({
        csrf_token: this.csrfToken,
        db: this.config.database,
        login: this.config.username,
        password: this.config.password,
        type: 'password',
        redirect: `/odoo?db=${this.config.database}`
      });

      const loginResponse = await this.axiosInstance.post('/web/login', loginData.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Cookie': cookieString, // Use updated cookieString with all cookies
          'Origin': this.config.url,
          'Referer': `${this.config.url}/web/login?db=${this.config.database}`,
          'Cache-Control': 'max-age=0',
          'Upgrade-Insecure-Requests': '1',
        },
        maxRedirects: 0, // Don't follow redirects, we'll handle manually
        validateStatus: (status) => status < 500, // Accept all non-error status including redirects
      });

      // Extract new session_id setelah login
      const loginCookies = loginResponse.headers['set-cookie'];
      if (loginCookies) {
        const sessionCookie = loginCookies.find((c: string) => c.startsWith('session_id='));
        if (sessionCookie) {
          const newSessionId = sessionCookie.split(';')[0].split('=')[1];
          // Update session ID
          this.sessionId = newSessionId;
          console.log('🍪 New Session ID:', this.sessionId?.substring(0, 20) + '...');
        }
      }

      // Check response status and location header
      const location = loginResponse.headers['location'];
      console.log('📍 Status:', loginResponse.status);
      console.log('📍 Redirect location:', location);

      // If status is 303 or 302, it's a redirect
      if (loginResponse.status === 303 || loginResponse.status === 302) {
        // Check redirect location
        if (!location) {
          console.error('❌ Login failed: No redirect location');
          return false;
        }

        // If redirected to database selector = login failed
        if (location.includes('/web/database/selector')) {
          console.error('❌ Login failed: Wrong credentials or database name');
          return false;
        }

        // If redirected back to login = login failed
        if (location.includes('/web/login')) {
          console.error('❌ Login failed: Redirected back to login page');
          return false;
        }

        // If redirected to /web or /odoo = success!
        if (location.includes('/web') || location.includes('/odoo')) {
          console.log('✅ Login successful! Redirected to:', location);
          return true;
        }
      }

      // For non-redirect responses, check the HTML content
      if (loginResponse.data && typeof loginResponse.data === 'string') {
        if (loginResponse.data.includes('Wrong login/password') || 
            loginResponse.data.includes('alert alert-danger')) {
          console.error('❌ Login failed: Wrong credentials');
          return false;
        }
      }

      console.log('✅ Login appears successful');
      return true;
    } catch (error: any) {
      console.error('❌ Login error:', error.message);
      if (error.response) {
        console.error('   Status:', error.response.status);
        console.error('   URL:', error.response.config?.url);
      }
      return false;
    }
  }

  /**
   * Check in ke Odoo attendance
   */
  async checkIn(): Promise<{ success: boolean; message: string }> {
    try {
      // Prevent infinite loop
      if (this.isRetrying) {
        console.error('❌ Already retrying, stopping to prevent infinite loop');
        return { success: false, message: '❌ Login gagal setelah retry' };
      }

      if (!this.sessionId) {
        const loginSuccess = await this.login();
        if (!loginSuccess) {
          return { success: false, message: '❌ Login gagal' };
        }
      }

      console.log('⏰ Checking in...');

      const response = await this.axiosInstance.post(
        '/hr_attendance/systray_check_in_out',
        {
          id: Math.floor(Math.random() * 1000),
          jsonrpc: '2.0',
          method: 'call',
          params: {}
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Accept': '*/*',
            'Cookie': `session_id=${this.sessionId}; tz=Asia/Jakarta; cids=1`,
            'Origin': this.config.url,
            'Referer': `${this.config.url}/odoo/attendances`,
            'X-Requested-With': 'XMLHttpRequest',
          },
          timeout: 15000,
        }
      );

      console.log('📊 Check-in response status:', response.status);
      console.log('📊 Check-in response data:', JSON.stringify(response.data, null, 2));

      // Check for JSON-RPC error
      if (response.data && response.data.error) {
        const errorMsg = response.data.error.data?.message || response.data.error.message || 'Unknown error';
        console.error('❌ JSON-RPC Error:', errorMsg);
        
        // If session error, retry with login
        if (errorMsg.includes('session') || errorMsg.includes('login')) {
          console.log('🔄 Session expired, trying to re-login...');
          this.sessionId = null;
          this.isRetrying = true;
          const result = await this.checkIn();
          this.isRetrying = false;
          return result;
        }
        
        return { success: false, message: `❌ ${errorMsg}` };
      }

      // Success if we have result
      if (response.data && response.data.result !== undefined) {
        const result = response.data.result;
        console.log('✅ Attendance action result:', result);
        
        return { 
          success: true, 
          message: `✅ Attendance action berhasil!` 
        };
      }

      return { success: false, message: '❌ Unexpected response format' };
    } catch (error: any) {
      console.error('❌ Check-in error:', error.message);
      
      // Log more details
      if (error.response) {
        console.error('   Status:', error.response.status);
        console.error('   Data:', typeof error.response.data === 'string' 
          ? error.response.data.substring(0, 200) 
          : error.response.data);
      }
      
      // Retry dengan login ulang untuk error 404, 401, 403
      if (!this.isRetrying && 
          (error.response?.status === 404 || 
           error.response?.status === 401 || 
           error.response?.status === 403)) {
        console.log('🔄 Auth issue, trying to re-login once...');
        this.sessionId = null;
        this.isRetrying = true;
        const result = await this.checkIn();
        this.isRetrying = false;
        return result;
      }
      
      return { 
        success: false, 
        message: `❌ Error: ${error.response?.status || error.message}` 
      };
    }
  }

  /**
   * Check out dari Odoo attendance
   */
  async checkOut(): Promise<{ success: boolean; message: string }> {
    // Check out menggunakan endpoint yang sama dengan check in
    // Odoo akan otomatis detect apakah user sedang check in atau check out
    return this.checkIn();
  }

  /**
   * Get current attendance status
   */
  async getAttendanceStatus(): Promise<{ isCheckedIn: boolean; lastAction?: string }> {
    try {
      if (!this.sessionId) {
        await this.login();
      }

      console.log('📊 Getting attendance status...');

      // Call endpoint untuk get status
      const response = await this.axiosInstance.post(
        '/hr_attendance/systray_check_in_out',
        {
          id: Math.floor(Math.random() * 1000),
          jsonrpc: '2.0',
          method: 'call',
          params: {}
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Accept': '*/*',
            'Cookie': `session_id=${this.sessionId}; tz=Asia/Jakarta; cids=1`,
            'X-Requested-With': 'XMLHttpRequest',
          },
          timeout: 10000,
        }
      );

      console.log('📊 Status response:', response.data);

      // Response akan berisi info apakah user sudah check in atau belum
      if (response.data && response.data.result) {
        // Biasanya Odoo return object dengan info attendance
        return { 
          isCheckedIn: !!response.data.result.attendance,
          lastAction: response.data.result.attendance ? 'Checked In' : 'Checked Out'
        };
      }

      return { isCheckedIn: false };
    } catch (error: any) {
      console.error('❌ Error getting attendance status:', error.message);
      // Don't throw, just return default
      return { isCheckedIn: false };
    }
  }
}
