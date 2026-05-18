import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { loadEnv } from '../../config/env';

type Locale = 'ar' | 'en';

@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private readonly env = loadEnv();
  private transporter: Transporter | null = null;

  private getTransporter(): Transporter | null {
    if (this.transporter) return this.transporter;
    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SECURE } = this.env;
    if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) return null;
    this.transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      // Implicit TLS on 465; STARTTLS on 587. Override with SMTP_SECURE explicitly.
      secure: SMTP_SECURE ?? SMTP_PORT === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
    return this.transporter;
  }

  /**
   * Common headers we add to every message we send.
   *
   * Why each one matters for inbox placement:
   *  - From must match the authenticated SMTP user so SPF/DKIM align in Gmail.
   *  - Reply-To gives the recipient a real human/address to respond to.
   *  - List-Unsubscribe + One-Click lets Gmail/Apple Mail show an "unsubscribe"
   *    chip and counts as a positive engagement signal. Even for transactional
   *    mail this rarely hurts and helps reputation.
   *  - Auto-Submitted/X-Auto-Response-Suppress mark the message as automated
   *    so mailbox auto-responders don't bounce back.
   */


  async sendResetCode(to: string, code: string, locale: Locale = 'ar'): Promise<void> {
    const transporter = this.getTransporter();
    const subject = locale === 'ar'
      ? `رمز الدخول إلى ${this.env.APP_PUBLIC_NAME}: ${code}`
      : `${this.env.APP_PUBLIC_NAME} verification code: ${code}`;
    const html = renderResetEmail({
      code,
      locale,
      appName: this.env.APP_PUBLIC_NAME,
      appUrl: this.env.APP_PUBLIC_URL,
    });
    const text = locale === 'ar'
      ? `رمز التحقق الخاص بك في ${this.env.APP_PUBLIC_NAME}: ${code}\n\nالرمز صالح لمدة 15 دقيقة. لا تشاركه مع أي شخص.\nإذا لم تطلب هذا الرمز يمكنك تجاهل الرسالة.\n\n${this.env.APP_PUBLIC_URL}`
      : `Your ${this.env.APP_PUBLIC_NAME} verification code: ${code}\n\nValid for 15 minutes. Do not share it.\nIf you did not request this code, you can ignore this email.\n\n${this.env.APP_PUBLIC_URL}`;

    if (!transporter) {
      this.logger.warn(`[mailer] SMTP not configured — code for ${to}: ${code}`);
      return;
    }

    try {
      await transporter.sendMail({
        from: this.env.SMTP_FROM,
        to,
        replyTo: this.env.SMTP_REPLY_TO ?? this.env.SMTP_USER,
        subject,
        text,
        html,
      });
      this.logger.log(`[mailer] reset code sent to ${to}`);
    } catch (err) {
      this.logger.error(`[mailer] failed to send reset email to ${to}`, err as Error);
      throw err;
    }
  }

  /**
   * Welcome message after a successful registration. Fire-and-forget — never
   * block the registration response on this, and never throw.
   */
  async sendWelcomeEmail(to: string, displayName: string, locale: Locale = 'ar'): Promise<void> {
    const transporter = this.getTransporter();
    const subject = locale === 'ar'
      ? `أهلاً بك في ${this.env.APP_PUBLIC_NAME} 🚖`
      : `Welcome to ${this.env.APP_PUBLIC_NAME}`;
    const html = renderWelcomeEmail({
      displayName,
      locale,
      appName: this.env.APP_PUBLIC_NAME,
      appUrl: this.env.APP_PUBLIC_URL,
    });
    const text = locale === 'ar'
      ? `أهلاً ${displayName}،\n\nتم إنشاء حسابك في ${this.env.APP_PUBLIC_NAME} بنجاح. ابدأ الآن بتسجيل أول رحلة لتعرف ربحك الحقيقي.\n\n${this.env.APP_PUBLIC_URL}\n\nالحساب: ${to}`
      : `Hi ${displayName},\n\nYour ${this.env.APP_PUBLIC_NAME} account is ready. Log your first trip to see your real profit per hour and per km.\n\n${this.env.APP_PUBLIC_URL}\n\nAccount: ${to}`;

    if (!transporter) {
      this.logger.warn(`[mailer] SMTP not configured — would have welcomed ${to}`);
      return;
    }

    try {
      await transporter.sendMail({
        from: this.env.SMTP_FROM,
        to,
        replyTo: this.env.SMTP_REPLY_TO ?? this.env.SMTP_USER,
        subject,
        text,
        html,
      });
      this.logger.log(`[mailer] welcome sent to ${to}`);
    } catch (err) {
      // Never fail registration because of a missed welcome email.
      this.logger.warn(`[mailer] welcome email failed for ${to}: ${(err as Error).message}`);
    }
  }
}

function cryptoRandomId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/* ─── Shared layout ────────────────────────────────────────────────────── */

function shell({
  locale,
  preheader,
  body,
  appName,
  appUrl,
}: {
  locale: Locale;
  preheader: string;
  body: string;
  appName: string;
  appUrl: string;
}): string {
  const isAr = locale === 'ar';
  const dir = isAr ? 'rtl' : 'ltr';
  const lang = isAr ? 'ar' : 'en';
  const tagline = isAr ? 'رفيق السائق الذكي' : 'Your smart driver companion';
  const footerNote = isAr
    ? 'تم إرسال هذه الرسالة لأن لديك حساباً نشطاً.'
    : 'You are receiving this because you have an active account.';

  return `<!doctype html>
<html dir="${dir}" lang="${lang}">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <meta name="color-scheme" content="light dark">
    <meta name="supported-color-schemes" content="light dark">
    <title>${escapeHtml(appName)}</title>
  </head>
  <body style="margin:0;padding:0;background:#f5f7fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Cairo',Roboto,Helvetica,Arial,sans-serif;color:#0B0F14;">
    <!-- preheader (hidden) — first thing shown in the inbox preview -->
    <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;color:transparent;line-height:0;font-size:1px;">${escapeHtml(preheader)}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7fb;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;box-shadow:0 1px 3px rgba(15,23,42,0.06),0 8px 24px rgba(15,23,42,0.06);overflow:hidden;">
            <tr>
              <td style="background:linear-gradient(135deg,#1f3b8b 0%,#2563eb 100%);padding:24px 28px;color:#fff;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td>
                      <div style="display:inline-flex;align-items:center;gap:10px;">
                        <span style="display:inline-block;width:32px;height:32px;border-radius:9px;background:rgba(255,255,255,0.18);text-align:center;line-height:32px;font-weight:700;">${escapeHtml(appName.charAt(0))}</span>
                        <span style="font-size:18px;font-weight:700;letter-spacing:-0.01em;">${escapeHtml(appName)}</span>
                      </div>
                      <div style="margin-top:4px;font-size:12px;opacity:0.85;">${escapeHtml(tagline)}</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:32px 28px;">${body}</td>
            </tr>
            <tr>
              <td style="padding:20px 28px;background:#f8fafc;color:#5A6478;font-size:12px;line-height:1.6;border-top:1px solid #eef0f5;">
                <div>${escapeHtml(footerNote)}</div>
                <div style="margin-top:6px;"><a href="${escapeAttr(appUrl)}" style="color:#2563eb;text-decoration:none;">${escapeHtml(appUrl.replace(/^https?:\/\//, ''))}</a></div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function renderResetEmail({ code, locale, appName, appUrl }: { code: string; locale: Locale; appName: string; appUrl: string }): string {
  const isAr = locale === 'ar';
  const title = isAr ? 'رمز التحقق الخاص بك' : 'Your verification code';
  const intro = isAr
    ? `استخدم الرمز التالي لاستكمال تغيير كلمة المرور لحسابك في <strong>${escapeHtml(appName)}</strong>. الرمز صالح لمدة 15 دقيقة فقط.`
    : `Use the code below to finish resetting your <strong>${escapeHtml(appName)}</strong> password. It expires in 15 minutes.`;
  const warn = isAr
    ? 'إذا لم تطلب هذا الرمز، يمكنك تجاهل هذه الرسالة ولن يحدث أي تغيير في حسابك.'
    : 'If you did not request this code, you can safely ignore this email — nothing will change.';
  const body = `
    <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#0B0F14;">${escapeHtml(title)}</h1>
    <p style="margin:0 0 24px;font-size:15px;line-height:1.65;color:#3a4256;">${intro}</p>
    <div style="margin:24px 0;padding:24px;background:linear-gradient(135deg,#eff4ff 0%,#dbeafe 100%);border:1px solid #c7d7fb;border-radius:14px;text-align:center;">
      <div style="font-family:'SF Mono',ui-monospace,Menlo,Consolas,monospace;font-size:34px;letter-spacing:12px;font-weight:700;color:#1d3a8a;">${escapeHtml(code)}</div>
    </div>
    <p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#5A6478;">${escapeHtml(warn)}</p>
  `;
  const preheader = isAr
    ? `رمز التحقق: ${code} — صالح لمدة 15 دقيقة.`
    : `Your code: ${code} — valid for 15 minutes.`;
  return shell({ locale, preheader, body, appName, appUrl });
}

function renderWelcomeEmail({ displayName, locale, appName, appUrl }: { displayName: string; locale: Locale; appName: string; appUrl: string }): string {
  const isAr = locale === 'ar';
  const title = isAr ? `أهلاً ${displayName} 👋` : `Welcome, ${displayName}`;
  const intro = isAr
    ? `تم إنشاء حسابك بنجاح في <strong>${escapeHtml(appName)}</strong>. خلّيك على بعد رحلة واحدة من معرفة ربحك الحقيقي لكل ساعة ولكل كيلومتر.`
    : `Your <strong>${escapeHtml(appName)}</strong> account is ready. Log one trip and you'll start seeing your real profit per hour and per kilometre.`;
  const steps = isAr
    ? [
        ['أضف مركبتك', 'الإعدادات ← المركبات. النوع، الوقود، ومتوسط الكم/لتر.'],
        ['أضف تطبيقاتك', 'اختر من أوبر / إنْدرايف / طلبات أو ضيف تطبيقاً مخصصاً.'],
        ['سجّل أول رحلة', 'وقت البداية والنهاية، السعر، والكيلومترات — وشوف الصافي فوراً.'],
      ]
    : [
        ['Add your vehicle', 'Settings → Vehicles. Type, fuel, average km per litre.'],
        ['Add your apps', 'Pick Uber / Indrive / Talabat, or add a custom one.'],
        ['Log your first trip', 'Start & end times, fare, and kilometres — see your net immediately.'],
      ];
  const stepsHtml = steps
    .map(
      ([h, b], i) => `
      <tr>
        <td style="padding:14px 0;border-bottom:1px solid #eef0f5;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td valign="top" style="width:34px;">
                <span style="display:inline-block;width:26px;height:26px;border-radius:8px;background:#1d3a8a;color:#fff;text-align:center;line-height:26px;font-size:13px;font-weight:700;">${i + 1}</span>
              </td>
              <td>
                <div style="font-size:14px;font-weight:600;color:#0B0F14;">${escapeHtml(h)}</div>
                <div style="margin-top:2px;font-size:13px;color:#5A6478;line-height:1.55;">${escapeHtml(b)}</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>`,
    )
    .join('');

  const ctaLabel = isAr ? 'افتح التطبيق' : 'Open the app';

  const body = `
    <h1 style="margin:0 0 12px;font-size:24px;font-weight:700;color:#0B0F14;">${escapeHtml(title)}</h1>
    <p style="margin:0 0 18px;font-size:15px;line-height:1.65;color:#3a4256;">${intro}</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;">
      ${stepsHtml}
    </table>
    <div style="margin-top:28px;text-align:center;">
      <a href="${escapeAttr(appUrl)}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 28px;border-radius:10px;">${escapeHtml(ctaLabel)}</a>
    </div>
  `;
  const preheader = isAr
    ? `حسابك جاهز — سجّل أول رحلة وشوف الأرقام بتنطق.`
    : `Your account is ready — log one trip and see the numbers come alive.`;
  return shell({ locale, preheader, body, appName, appUrl });
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function escapeAttr(s: string): string {
  return escapeHtml(s);
}
