import nodemailer from "nodemailer";

const SMTP_HOST = process.env.SMTP_HOST || "ssl0.ovh.net";
const SMTP_PORT = parseInt(process.env.SMTP_PORT || "465", 10);
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASSWORD = process.env.SMTP_PASSWORD;
const SMTP_FROM = process.env.SMTP_FROM || '"Azalée" <azalee@rosegriffon.fr>';

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

// Create a reusable transporter object using the default SMTP transport
const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_PORT === 465, // true for 465, false for other ports (like 587)
  auth: {
    type: "login",
    user: SMTP_USER,
    pass: SMTP_PASSWORD,
  },
  tls: {
    // Do not fail on invalid certs
    rejectUnauthorized: false,
  },
} as any);

/**
 * Sends an email using the configured SMTP transporter.
 */
export async function sendEmail({ to, subject, html, text }: SendEmailOptions) {
  if (!SMTP_USER || !SMTP_PASSWORD) {
    console.warn("⚠️  SMTP credentials not configured. Email not sent.");
    return;
  }

  try {
    const info = await transporter.sendMail({
      from: SMTP_FROM,
      to,
      subject,
      text: text || html.replaceAll(/<[^>]*>/g, ""), // Fallback text generation
      html,
    });

    console.log(`📧 Email sent: ${info.messageId} to ${to}`);
    return info;
  } catch (error) {
    console.error("❌ Error sending email:", error);
    throw error;
  }
}
