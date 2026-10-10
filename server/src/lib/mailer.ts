import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '../config/env';

let transporter: Transporter | null = null;

function getTransporter() {
  if (transporter) return transporter;
  if (!env.SMTP_USER || !env.SMTP_PASS) {
    return null;
  }
  transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    },
  });
  return transporter;
}

export async function sendWelcomeEmail(opts: {
  to: string;
  name: string;
  role: string;
  password: string;
}) {
  const mail = getTransporter();
  const clientOrigin = Array.isArray(env.CLIENT_ORIGIN) ? env.CLIENT_ORIGIN[0] : (env.CLIENT_ORIGIN || 'http://localhost:5173');

  if (!mail) {
    console.log('====================================================');
    console.log(`[MAILER] SMTP credentials not set in .env. Logging email for ${opts.to}:`);
    console.log(`To: ${opts.to}`);
    console.log(`Name: ${opts.name}`);
    console.log(`Role: ${opts.role}`);
    console.log(`Temporary Password: ${opts.password}`);
    console.log(`Login URL: ${clientOrigin}/login`);
    console.log('====================================================');
    return;
  }

  try {
    await mail.sendMail({
      from: env.SMTP_FROM,
      to: opts.to,
      subject: 'Your MillTrace Login Credentials',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #E8E4DF; border-radius: 12px; background-color: #FAFAF8;">
          <div style="background-color: #EA580C; color: white; padding: 12px 20px; border-radius: 8px; font-weight: bold; font-size: 18px; margin-bottom: 20px;">
            MillTrace Textile System
          </div>
          <h2 style="color: #1A1714; margin-top: 0;">Welcome, ${opts.name}!</h2>
          <p style="color: #44403C; font-size: 15px; line-height: 1.5;">
            An account has been created for you on the MillTrace staff portal with the role of <strong>${opts.role}</strong>.
          </p>
          <div style="background-color: #FFFFFF; border: 1px solid #E8E4DF; border-radius: 8px; padding: 16px; margin: 20px 0;">
            <p style="margin: 6px 0; color: #1A1714;"><strong>Portal URL:</strong> <a href="${clientOrigin}/login" style="color: #EA580C;">${clientOrigin}/login</a></p>
            <p style="margin: 6px 0; color: #1A1714;"><strong>Email:</strong> ${opts.to}</p>
            <p style="margin: 6px 0; color: #1A1714;"><strong>Temporary Password:</strong> <code style="background-color: #FFF7ED; color: #EA580C; padding: 2px 6px; border-radius: 4px; font-size: 15px;">${opts.password}</code></p>
          </div>
          <p style="color: #78716C; font-size: 13px;">
            Please log in and use these credentials to access your workspace. Keep your login details confidential.
          </p>
        </div>
      `,
    });
    console.log(`[MAILER] Welcome email sent successfully to ${opts.to}`);
  } catch (err) {
    console.error(`[MAILER] Failed to send email to ${opts.to}:`, err);
  }
}
