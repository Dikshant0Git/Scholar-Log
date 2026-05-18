const nodemailer = require('nodemailer');

// 1. Validate Credentials and Settings
const smtpHost = process.env.SMTP_HOST;
const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;

const isSmtpConfigured = !!(smtpHost && smtpUser && smtpPass);

let transporter;
let isMockTransporter = false;

// Sender normalization: Gmail/Standard format checks
const rawFromEmail = process.env.SMTP_FROM || smtpUser || 'no-reply@scholarlog.local';
const fromEmail = (rawFromEmail && !rawFromEmail.includes('@') && smtpHost === 'smtp.gmail.com')
    ? `${rawFromEmail}@gmail.com`
    : rawFromEmail;

if (isSmtpConfigured) {
    console.log(`[EMAIL_SERVICE] Initializing SMTP connection pool for ${smtpHost}:${smtpPort} (User: ${fromEmail})...`);
    
    // Normalize Gmail username if it's lacking domain part
    const authUser = (smtpUser && !smtpUser.includes('@') && smtpHost === 'smtp.gmail.com')
        ? `${smtpUser}@gmail.com`
        : smtpUser;

    transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465, // True only for SMTPS port 465
        pool: true,               // Reuse SMTP connections for throughput & efficiency
        maxConnections: 5,        // Avoid triggering abuse/rate limit bans
        maxMessages: 100,         // Refresh connection after 100 messages
        rateDelta: 1000,
        rateLimit: 5,
        connectionTimeout: 10000, // 10s: network handshake timeout
        greetingTimeout: 10000,   // 10s: greeting from server timeout
        socketTimeout: 15000,     // 15s: inactivity timeout on socket
        dnsTimeout: 10000,        // 10s: DNS resolution timeout
        auth: {
            user: authUser,
            pass: smtpPass,
        },
        tls: {
            // Reject unauthorized certificates in production, allow development fallbacks
            rejectUnauthorized: process.env.NODE_ENV === 'production',
            ciphers: 'SSLv3'
        }
    });

    // Verify SMTP connection on startup asynchronously
    transporter.verify()
        .then(() => {
            console.log('[EMAIL_SERVICE] SMTP connection pool successfully verified and ready.');
        })
        .catch((err) => {
            console.error('[EMAIL_SERVICE] SMTP connection verification failed!');
            console.error(`[EMAIL_SERVICE] Error details: ${err.message}`);
            console.error('[EMAIL_SERVICE] Diagnostic Check: Please verify SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASS on Render.');
            console.error('[EMAIL_SERVICE] Fallback active: Node will attempt reconnects dynamically upon sending.');
        });
} else {
    isMockTransporter = true;
    console.warn('[EMAIL_SERVICE] WARNING: SMTP credentials are not fully configured.');
    console.warn('[EMAIL_SERVICE] Fallback initialized: Using mock/console email logger.');
    console.warn('[EMAIL_SERVICE] To enable real emails, configure: SMTP_HOST, SMTP_USER, SMTP_PASS, and optionally SMTP_PORT / SMTP_FROM.');
    
    transporter = {
        sendMail: async (options) => {
            console.log('\n=========================================');
            console.log('[EMAIL_SERVICE] [MOCK SENDMAIL]');
            console.log(`FROM:    ${options.from}`);
            console.log(`TO:      ${options.to}`);
            console.log(`SUBJECT: ${options.subject}`);
            console.log(`TEXT:    ${options.text}`);
            console.log('------------------ HTML -----------------');
            const otpMatch = options.text.match(/\b\d{6}\b/);
            if (otpMatch) {
                console.log(`[OTP FOUND] Verification Code: ${otpMatch[0]}`);
            } else {
                console.log(options.html ? 'HTML content present (see full log in debug)' : '(No HTML content)');
            }
            console.log('=========================================\n');
            
            return {
                messageId: `mock-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
                response: '250 OK: Mock email successfully logged'
            };
        },
        verify: async () => true
    };
}

// Truly fire-and-forget — never blocks, never throws unhandled rejections
const sendEmailAsync = (to, subject, text) => {
    // Generate beautiful responsive brutalist HTML based on action and OTP
    const otpMatch = text.match(/\b\d{6}\b/);
    const otp = otpMatch ? otpMatch[0] : '******';
    
    let actionTitle = 'IDENTITY VERIFICATION';
    let actionDesc = 'Enter this 6-digit One-Time Password (OTP) to verify your academic email and initialize your secure Scholar Log workspace.';
    
    if (subject.includes('Reset') || subject.includes('reset')) {
        actionTitle = 'PASSWORD RESET';
        actionDesc = 'A password reset request has been received for your secure academic workspace. Enter this 6-digit verification code to proceed.';
    } else if (subject.includes('Change') || subject.includes('change')) {
        actionTitle = 'CREDENTIAL CHANGE';
        actionDesc = 'A security credential change was initiated from within your account settings. Enter this 6-digit authorization code to complete the process.';
    }
    
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${subject}</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #0d0e10; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #e2e8f0; -webkit-font-smoothing: antialiased;">
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #0d0e10; table-layout: fixed;">
        <tr>
          <td align="center" style="padding: 40px 10px;">
            <!-- Outer Card -->
            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 480px; background-color: #15171a; border: 1px solid #2d3139; border-top: 4px solid #f59e0b; border-radius: 4px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
              
              <!-- Header / Logo -->
              <tr>
                <td style="padding: 30px 30px 20px 30px; text-align: left; border-bottom: 1px solid #2d3139;">
                  <span style="font-family: 'SF Mono', SFMono-Regular, ui-monospace, 'DejaVu Sans Mono', Menlo, Consolas, monospace; font-size: 10px; font-weight: bold; color: #f59e0b; letter-spacing: 0.15em; text-transform: uppercase;">SCHOLAR LOG // SECURE GATEWAY</span>
                  <h1 style="margin: 8px 0 0 0; font-size: 22px; font-weight: 700; color: #ffffff; letter-spacing: -0.02em; text-transform: uppercase;">${actionTitle}</h1>
                </td>
              </tr>
              
              <!-- Body Content -->
              <tr>
                <td style="padding: 30px 30px;">
                  <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 1.6; color: #94a3b8;">
                    ${actionDesc}
                  </p>
                  
                  <!-- OTP Container -->
                  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 25px 0;">
                    <tr>
                      <td align="center" style="background-color: #0a0b0d; border: 1px dashed #f59e0b; border-radius: 3px; padding: 22px 15px;">
                        <span style="font-family: 'SF Mono', SFMono-Regular, ui-monospace, 'DejaVu Sans Mono', Menlo, Consolas, monospace; font-size: 9px; color: #475569; letter-spacing: 0.25em; display: block; margin-bottom: 12px; text-transform: uppercase; font-weight: bold;">ONE-TIME SECURITY KEY</span>
                        <span style="font-family: 'SF Mono', SFMono-Regular, ui-monospace, 'DejaVu Sans Mono', Menlo, Consolas, monospace; font-size: 36px; font-weight: 900; color: #f59e0b; letter-spacing: 8px; display: inline-block; padding-left: 8px;">${otp}</span>
                      </td>
                    </tr>
                  </table>
                  
                  <p style="margin: 20px 0 0 0; font-size: 12px; line-height: 1.5; color: #64748b; font-style: italic;">
                    🕒 Security Warning: This authorization token is valid for <strong>10 minutes</strong>. If you did not trigger this transaction, you can safely ignore this communication.
                  </p>
                </td>
              </tr>
              
              <!-- Footer / Technical Specs -->
              <tr>
                <td style="padding: 24px 30px; background-color: #0d0e10; border-top: 1px solid #2d3139; text-align: left;">
                  <table border="0" cellpadding="0" cellspacing="0" width="100%">
                    <tr>
                      <td>
                        <span style="font-family: 'SF Mono', SFMono-Regular, ui-monospace, 'DejaVu Sans Mono', Menlo, Consolas, monospace; font-size: 8px; color: #475569; display: block; letter-spacing: 0.1em; line-height: 1.6; text-transform: uppercase;">SYSTEM DIAGNOSTIC // CORE-X9 // VOLTAGE: NOMINAL</span>
                        <span style="font-family: 'SF Mono', SFMono-Regular, ui-monospace, 'DejaVu Sans Mono', Menlo, Consolas, monospace; font-size: 8px; color: #475569; display: block; letter-spacing: 0.1em; line-height: 1.6; text-transform: uppercase;">CONNECTION PROTOCOL: TLS 1.3 // SECURITY LAYER ACTIVE</span>
                        <span style="font-family: 'SF Mono', SFMono-Regular, ui-monospace, 'DejaVu Sans Mono', Menlo, Consolas, monospace; font-size: 8px; color: #334155; display: block; letter-spacing: 0.08em; line-height: 1.6; text-transform: uppercase; margin-top: 8px;">© ${new Date().getFullYear()} SCHOLAR LOG. SHIELD ACTIVE.</span>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
    `;

    const mailOptions = {
        from: `"Scholar Log" <${fromEmail}>`,
        to,
        subject,
        text,
        html,
    };

    const maxRetries = 3;
    const initialDelay = 1000; // 1 second base delay

    const executeSend = (attempt = 1) => {
        transporter.sendMail(mailOptions)
            .then((info) => {
                if (isMockTransporter) {
                    console.log(`[EMAIL_SERVICE] [MOCK] Email logged successfully (ID: ${info.messageId})`);
                } else {
                    console.log(`[EMAIL_SERVICE] Email successfully dispatched to ${to} (Attempt ${attempt}/${maxRetries}, MsgID: ${info.messageId})`);
                }
            })
            .catch((err) => {
                console.error(`[EMAIL_SERVICE] Attempt ${attempt} to send email to ${to} failed: ${err.message}`);
                
                if (attempt < maxRetries) {
                    // Exponential delay calculation: delay = base * 2^(attempt-1) + jitter
                    const delay = initialDelay * Math.pow(2, attempt - 1) + Math.random() * 500;
                    console.log(`[EMAIL_SERVICE] Retrying dispatch in ${Math.round(delay)}ms...`);
                    setTimeout(() => executeSend(attempt + 1), delay);
                } else {
                    console.error(`[EMAIL_SERVICE] CRITICAL: All ${maxRetries} attempts to send email to ${to} have FAILED.`);
                    console.error('[EMAIL_SERVICE] Diagnostic Error Trace:', err);
                }
            });
    };

    // Execute fire-and-forget sending process
    executeSend();
};

module.exports = { transporter, sendEmailAsync };
