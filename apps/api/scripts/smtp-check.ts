/**
 * SMTP credentials check.
 *
 * Two phases:
 *   1. transporter.verify()  → confirms host/port/auth without sending.
 *   2. transporter.sendMail() → delivers a small test message to SMTP_USER.
 *
 * Run: npx ts-node scripts/smtp-check.ts
 *      or set RECIPIENT=other@example.com to override the destination.
 */
import 'reflect-metadata';
import * as path from 'path';
import * as dotenv from 'dotenv';
import * as nodemailer from 'nodemailer';

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

async function main() {
  const SMTP_HOST = process.env.SMTP_HOST;
  const SMTP_PORT = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined;
  const SMTP_USER = process.env.SMTP_USER;
  const SMTP_PASS = process.env.SMTP_PASS;
  const SMTP_SECURE =
    typeof process.env.SMTP_SECURE === 'string'
      ? process.env.SMTP_SECURE.toLowerCase() === 'true'
      : undefined;
  const SMTP_FROM = process.env.SMTP_FROM ?? SMTP_USER;
  const APP_PUBLIC_NAME = process.env.APP_PUBLIC_NAME ?? 'Ehsbha';

  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
    console.error('✗ SMTP env vars missing — set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS in backend/.env');
    process.exit(1);
  }

  const recipient = process.env.RECIPIENT || SMTP_USER;
  const secure = SMTP_SECURE ?? SMTP_PORT === 465;

  console.log('SMTP config:');
  console.log(`  host:   ${SMTP_HOST}`);
  console.log(`  port:   ${SMTP_PORT}  (secure=${secure})`);
  console.log(`  user:   ${SMTP_USER}`);
  console.log(`  from:   ${SMTP_FROM ?? SMTP_USER}`);
  console.log(`  → test recipient: ${recipient}\n`);

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });

  console.log('1) Verifying auth handshake (EHLO + AUTH)…');
  try {
    await transporter.verify();
    console.log('   ✓ verify() OK — host reachable, credentials accepted.\n');
  } catch (err) {
    const e = err as Error & { code?: string; responseCode?: number; response?: string };
    console.error('   ✗ verify() failed:');
    console.error(`     code:         ${e.code ?? '(none)'}`);
    console.error(`     responseCode: ${e.responseCode ?? '(none)'}`);
    console.error(`     response:     ${e.response ?? '(none)'}`);
    console.error(`     message:      ${e.message}`);
    if (e.responseCode === 535 || /username and password not accepted/i.test(e.response ?? '')) {
      console.error('\n   Gmail rejected the credentials. Most likely cause:');
      console.error('   • Use a Gmail App Password (16 chars, no spaces), not your normal password.');
      console.error('   • Account must have 2-Step Verification enabled to create App Passwords.');
      console.error('   • Generate one at: https://myaccount.google.com/apppasswords');
      console.error('   • Paste it into SMTP_PASS without the spaces (e.g. "ijvbqhjbynksxuud").');
    }
    process.exit(2);
  }

  console.log('2) Sending a small test email…');
  const subject = `[${APP_PUBLIC_NAME}] SMTP test — ${new Date().toISOString()}`;
  const text =
    `This is an automated SMTP test from the ${APP_PUBLIC_NAME} backend.\n\n` +
    `If you can read this, outbound mail is working from ${SMTP_HOST}:${SMTP_PORT}\n` +
    `as ${SMTP_USER}.\n`;
  const html =
    `<div style="font-family:system-ui,sans-serif;font-size:14px;line-height:1.6;color:#0B0F14;">` +
    `<h2 style="margin:0 0 8px;">${APP_PUBLIC_NAME} SMTP test</h2>` +
    `<p style="margin:0;color:#3a4256;">If you can read this, outbound mail is working from ` +
    `<code>${SMTP_HOST}:${SMTP_PORT}</code> as <code>${SMTP_USER}</code>.</p>` +
    `<p style="margin:12px 0 0;color:#5A6478;font-size:12px;">Sent at ${new Date().toISOString()}.</p>` +
    `</div>`;

  try {
    const info = await transporter.sendMail({
      from: SMTP_FROM ?? SMTP_USER,
      to: recipient,
      subject,
      text,
      html,
    });
    console.log(`   ✓ Sent. messageId=${info.messageId}`);
    if (info.accepted?.length) console.log(`     accepted: ${info.accepted.join(', ')}`);
    if (info.rejected?.length) console.log(`     rejected: ${info.rejected.join(', ')}`);
    if (info.response) console.log(`     response: ${info.response}`);
  } catch (err) {
    const e = err as Error & { code?: string; responseCode?: number; response?: string };
    console.error('   ✗ sendMail() failed:');
    console.error(`     code:         ${e.code ?? '(none)'}`);
    console.error(`     responseCode: ${e.responseCode ?? '(none)'}`);
    console.error(`     response:     ${e.response ?? '(none)'}`);
    console.error(`     message:      ${e.message}`);
    process.exit(3);
  }

  console.log('\nAll good. Check the inbox (and the spam folder, just in case).');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
