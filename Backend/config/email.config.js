// Mailgun REST API Email Client (Native implementation using built-in fetch)
const mailgunApiKey = process.env.MAIL_GUN_API_KEY;
const mailgunDomain = process.env.MAIL_GUN_DOMAIN;

const isMailgunConfigured = !!(mailgunApiKey && mailgunDomain);
const isMockTransporter = !isMailgunConfigured;

const fromEmail = process.env.SMTP_FROM || `no-reply@${mailgunDomain || 'scholarlog.local'}`;

if (isMailgunConfigured) {
    console.log(`[EMAIL_SERVICE] Initializing Mailgun API transport for domain ${mailgunDomain}...`);
} else {
    console.warn('[EMAIL_SERVICE] WARNING: Mailgun credentials are not fully configured.');
    console.warn('[EMAIL_SERVICE] Fallback initialized: Using mock/console email logger.');
    console.warn('[EMAIL_SERVICE] To enable real emails, configure: MAIL_GUN_API_KEY and MAIL_GUN_DOMAIN in your .env file.');
}

// Compatibility transporter interface for health checking
const transporter = {
    verify: async () => {
        if (isMockTransporter) {
            return true; // Mock transport is always verified
        }
        
        try {
            const auth = Buffer.from(`api:${mailgunApiKey}`).toString('base64');
            const response = await fetch(`https://api.mailgun.net/v3/domains/${mailgunDomain}`, {
                headers: {
                    'Authorization': `Basic ${auth}`
                }
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: response.statusText }));
                throw new Error(`Mailgun API returned ${response.status}: ${errorData.message}`);
            }
            
            return true;
        } catch (err) {
            console.error(`[EMAIL_SERVICE] Mailgun connectivity check failed: ${err.message}`);
            throw err;
        }
    }
};

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

    const maxRetries = 3;
    const initialDelay = 1000; // 1 second base delay

    const executeSend = (attempt = 1) => {
        if (isMockTransporter) {
            console.log('\n=========================================');
            console.log('[EMAIL_SERVICE] [MOCK SENDMAIL]');
            console.log(`FROM:    Scholar Log <${fromEmail}>`);
            console.log(`TO:      ${to}`);
            console.log(`SUBJECT: ${subject}`);
            console.log(`TEXT:    ${text}`);
            console.log('------------------ HTML -----------------');
            if (otpMatch) {
                console.log(`[OTP FOUND] Verification Code: ${otp}`);
            } else {
                console.log('(No HTML content/No OTP)');
            }
            console.log('=========================================\n');
            
            console.log(`[EMAIL_SERVICE] [MOCK] Email logged successfully (ID: mock-${Date.now()})`);
            return;
        }

        // Real Mailgun REST API Send
        const url = `https://api.mailgun.net/v3/${mailgunDomain}/messages`;
        const auth = Buffer.from(`api:${mailgunApiKey}`).toString('base64');
        const body = new URLSearchParams();
        body.append('from', `Scholar Log <${fromEmail}>`);
        body.append('to', to);
        body.append('subject', subject);
        body.append('text', text);
        body.append('html', html);

        fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: body.toString()
        })
        .then(async (response) => {
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: response.statusText }));
                throw new Error(`Mailgun API ${response.status}: ${errorData.message}`);
            }
            return response.json();
        })
        .then((data) => {
            console.log(`[EMAIL_SERVICE] Email successfully dispatched to ${to} (Attempt ${attempt}/${maxRetries}, MsgID: ${data.id})`);
        })
        .catch((err) => {
            console.error(`[EMAIL_SERVICE] Attempt ${attempt} to send email to ${to} failed: ${err.message}`);
            
            if (attempt < maxRetries) {
                const delay = initialDelay * Math.pow(2, attempt - 1) + Math.random() * 500;
                console.log(`[EMAIL_SERVICE] Retrying dispatch in ${Math.round(delay)}ms...`);
                setTimeout(() => executeSend(attempt + 1), delay);
            } else {
                console.error(`[EMAIL_SERVICE] CRITICAL: All ${maxRetries} attempts to send email to ${to} have FAILED.`);
                console.error('[EMAIL_SERVICE] Diagnostic Error Trace:', err);
            }
        });
    };

    // Execute sending process asynchronously (fire-and-forget)
    executeSend();
};

module.exports = { transporter, sendEmailAsync };
