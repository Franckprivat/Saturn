import 'dotenv/config';
import { betterAuth } from 'better-auth';
import { Pool } from 'pg';
import * as nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export const auth = betterAuth({
  database: new Pool({ connectionString: process.env.BETTER_AUTH_DATABASE_URL }),
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins: process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
    : ['http://localhost:3000'],
  session: {
    modelName: 'session',
    expiresIn: 60 * 60 * 24 * 7,           // 7 jours
    updateAge: 60 * 60 * 24,               // renouvelle si > 1 jour restant
    cookieCache: { enabled: true, maxAge: 60 * 5 },
  },
  emailAndPassword: {
    enabled: true,
    sendResetPassword: async ({ user, url }) => {
      if (!process.env.SMTP_USER) return; // email non configuré, on skip silencieusement
      await transporter.sendMail({
        from: `"Saturn" <${process.env.SMTP_USER}>`,
        to: user.email,
        subject: 'Réinitialisation de ton mot de passe — Saturn',
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;background:#080810;color:#fff;border-radius:16px;">
            <h2 style="color:#A016D9;margin-bottom:8px;">🪐 Saturn</h2>
            <h3 style="margin-bottom:16px;">Réinitialise ton mot de passe</h3>
            <p style="color:#aaa;margin-bottom:24px;">Clique sur le bouton ci-dessous pour créer un nouveau mot de passe. Ce lien expire dans 1 heure.</p>
            <a href="${url}" style="display:inline-block;background:linear-gradient(135deg,#A016D9,#CF11BC);color:#fff;text-decoration:none;padding:14px 28px;border-radius:12px;font-weight:700;">
              Réinitialiser mon mot de passe
            </a>
            <p style="color:#555;margin-top:24px;font-size:12px;">Si tu n'as pas demandé cette réinitialisation, ignore cet email.</p>
          </div>
        `,
      });
    },
  },
  baseURL: process.env.BETTER_AUTH_URL || 'http://localhost:3001',
  user: {
    modelName: 'user',
    additionalFields: {
      firstName: { type: 'string', required: false, input: true },
      lastName: { type: 'string', required: false, input: true },
      nickname: { type: 'string', required: false, input: true },
    },
  },
  account: { modelName: 'account' },
  verification: { modelName: 'verification' },
});
