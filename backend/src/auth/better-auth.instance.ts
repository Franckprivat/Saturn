import 'dotenv/config';
import { betterAuth } from 'better-auth';
import { Pool } from 'pg';
import * as nodemailer from 'nodemailer';
import {
  APIError,
  createAuthMiddleware,
  getSessionFromCtx,
} from 'better-auth/api';
import { DEMO_LOCKED_AUTH_PATHS, isDemoEmail } from '../demo/demo.config';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

/** E-mails transactionnels possibles seulement si SMTP est configuré. */
export const emailEnabled = Boolean(process.env.SMTP_USER);

/**
 * Vérification d'e-mail obligatoire à la connexion : opt-in (REQUIRE_EMAIL_VERIFICATION=true)
 * et seulement si SMTP est configuré, sinon plus personne ne pourrait se connecter.
 */
export const requireEmailVerification =
  emailEnabled && process.env.REQUIRE_EMAIL_VERIFICATION === 'true';

function emailLayout(title: string, text: string, url: string, cta: string) {
  return `
    <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;background:#080810;color:#fff;border-radius:16px;">
      <h2 style="color:#A016D9;margin-bottom:8px;">🪐 Saturn</h2>
      <h3 style="margin-bottom:16px;">${title}</h3>
      <p style="color:#aaa;margin-bottom:24px;">${text}</p>
      <a href="${url}" style="display:inline-block;background:linear-gradient(135deg,#A016D9,#CF11BC);color:#fff;text-decoration:none;padding:14px 28px;border-radius:12px;font-weight:700;">
        ${cta}
      </a>
      <p style="color:#555;margin-top:24px;font-size:12px;">Si tu n'es pas à l'origine de cette demande, ignore cet email.</p>
    </div>
  `;
}

export const auth = betterAuth({
  database: new Pool({
    connectionString: process.env.BETTER_AUTH_DATABASE_URL,
  }),
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins: process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
    : ['http://localhost:3000'],
  session: {
    modelName: 'session',
    expiresIn: 60 * 60 * 24 * 7, // 7 jours
    updateAge: 60 * 60 * 24, // renouvelle si > 1 jour restant
    cookieCache: { enabled: true, maxAge: 60 * 5 },
  },
  emailAndPassword: {
    enabled: true,
    sendResetPassword: async ({ user, url }) => {
      if (!process.env.SMTP_USER) {
        // Sans SMTP, aucun e-mail ne part : le signaler dans les logs
        console.warn(
          `[auth] Reset de mot de passe demandé pour ${user.id} mais SMTP_USER n'est pas configuré`,
        );
        return;
      }
      await transporter.sendMail({
        from: `"Saturn" <${process.env.SMTP_USER}>`,
        to: user.email,
        subject: 'Réinitialisation de ton mot de passe — Saturn',
        html: emailLayout(
          'Réinitialise ton mot de passe',
          'Clique sur le bouton ci-dessous pour créer un nouveau mot de passe. Ce lien expire dans 1 heure.',
          url,
          'Réinitialiser mon mot de passe',
        ),
      });
    },
    requireEmailVerification,
  },
  emailVerification: {
    // Sans SMTP, pas d'e-mail de vérification (rien ne partirait)
    sendOnSignUp: emailEnabled,
    sendOnSignIn: emailEnabled,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      if (!emailEnabled) return;
      await transporter.sendMail({
        from: `"Saturn" <${process.env.SMTP_USER}>`,
        to: user.email,
        subject: 'Confirme ton adresse e-mail — Saturn',
        html: emailLayout(
          'Confirme ton adresse e-mail',
          'Clique sur le bouton ci-dessous pour confirmer ton adresse et activer ton compte.',
          url,
          'Confirmer mon adresse',
        ),
      });
    },
  },
  baseURL: process.env.BETTER_AUTH_URL || 'http://localhost:3001',
  // Les routes better-auth sont montées avant NestJS et échappent au ThrottlerGuard :
  // rate limit natif toujours actif (par défaut seulement si NODE_ENV=production).
  // Les routes sensibles (/sign-in, /sign-up, /forget-password…) ont des règles
  // plus strictes intégrées à better-auth.
  rateLimit: {
    enabled: true,
    window: 60,
    max: 100,
    customRules: {
      // Lecture de session appelée à chaque page par le frontend : la limiter
      // renvoyait des 429 à un utilisateur qui navigue (ou à un bureau derrière
      // une seule IP). Elle ne permet ni de deviner un mot de passe ni d'envoyer d'e-mail.
      '/get-session': false,
    },
  },
  advanced: {
    // X-Real-IP est posé par Nginx (non falsifiable par le client derrière le proxy)
    ipAddress: { ipAddressHeaders: ['x-real-ip', 'x-forwarded-for'] },
  },
  user: {
    modelName: 'user',
    additionalFields: {
      firstName: { type: 'string', required: false, input: true },
      lastName: { type: 'string', required: false, input: true },
      nickname: { type: 'string', required: false, input: true },
    },
  },
  account: { modelName: 'account' },
  databaseHooks: {
    user: {
      create: {
        // Le pseudo sert de nom affiché partout (l'e-mail n'est plus exposé
        // aux autres utilisateurs) : on garantit qu'il est toujours rempli.
        before: (user) => {
          const nickname = (user as { nickname?: string | null }).nickname;
          return Promise.resolve({
            data: {
              ...user,
              nickname:
                nickname?.trim() ||
                user.name?.trim() ||
                user.email.split('@')[0],
            },
          });
        },
      },
    },
  },
  verification: { modelName: 'verification' },
  hooks: {
    // Compte démo partagé : personne ne doit pouvoir en changer l'accès.
    before: createAuthMiddleware(async (ctx) => {
      let email: unknown;
      if (ctx.path === '/request-password-reset') {
        email = (ctx.body as { email?: unknown } | undefined)?.email;
      } else if (DEMO_LOCKED_AUTH_PATHS.includes(ctx.path)) {
        email = (await getSessionFromCtx(ctx))?.user.email;
      }
      if (isDemoEmail(email)) {
        // APIError hérite bien d'Error, mais son typage (better-call) est opaque pour le linter
        // eslint-disable-next-line @typescript-eslint/only-throw-error
        throw new APIError('FORBIDDEN', {
          message: 'Action désactivée pour le compte démo',
        });
      }
    }),
  },
});
