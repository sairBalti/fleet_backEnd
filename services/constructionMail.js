import nodemailer from "nodemailer";

export const hasAutomationMailConfig = () =>
  process.env.AUTOMATION_EMAIL_ENABLED === "1" &&
  process.env.SMTP_HOST &&
  process.env.SMTP_PORT &&
  process.env.SMTP_USER &&
  process.env.SMTP_PASS &&
  process.env.SMTP_FROM;

export async function sendAutomationEmail(to, subject, text) {
  if (!hasAutomationMailConfig() || !to || !String(to).includes("@")) {
    return false;
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject: `[Fleet Construction] ${subject}`,
    text,
  });
  return true;
}
