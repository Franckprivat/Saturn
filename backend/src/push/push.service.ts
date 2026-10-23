import { Injectable, Logger } from '@nestjs/common';
import * as webpush from 'web-push';
import { PrismaService } from '../prisma/prisma.service';

export interface PushPayload {
  title: string;
  body: string;
  /** Page ouverte au clic sur la notification */
  href?: string;
  image?: string | null;
  /** Une notification remplace la précédente de même tag (ex. une conversation) */
  tag?: string;
}

interface VapidConfig {
  publicKey: string;
  privateKey: string;
  subject: string;
}

export function getVapidConfig(
  env: NodeJS.ProcessEnv = process.env,
): VapidConfig | null {
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY } = env;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return null;
  return {
    publicKey: VAPID_PUBLIC_KEY,
    privateKey: VAPID_PRIVATE_KEY,
    subject: env.VAPID_SUBJECT || 'mailto:admin@saturn.local',
  };
}

/**
 * Notifications Web Push : elles arrivent même quand Saturn n'est ouvert dans
 * aucun onglet (le navigateur les affiche via le service worker).
 * Désactivées tant que VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY ne sont pas définis.
 */
@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private readonly config = getVapidConfig();

  constructor(private readonly prisma: PrismaService) {
    if (!this.config) {
      this.logger.warn(
        'VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY absents : notifications push désactivées',
      );
    }
  }

  get publicKey(): string | null {
    return this.config?.publicKey ?? null;
  }

  async subscribe(
    userId: string,
    sub: { endpoint: string; keys: { p256dh: string; auth: string } },
  ) {
    // Un navigateur = un endpoint : s'il change de compte, il change de propriétaire
    await this.prisma.pushSubscription.upsert({
      where: { endpoint: sub.endpoint },
      create: {
        userId,
        endpoint: sub.endpoint,
        p256dh: sub.keys.p256dh,
        auth: sub.keys.auth,
      },
      update: { userId, p256dh: sub.keys.p256dh, auth: sub.keys.auth },
    });
    return { ok: true };
  }

  async unsubscribe(userId: string, endpoint: string) {
    await this.prisma.pushSubscription.deleteMany({
      where: { userId, endpoint },
    });
    return { ok: true };
  }

  /** Envoie à tous les navigateurs abonnés de ces utilisateurs (sans attendre). */
  async sendToUsers(userIds: string[], payload: PushPayload): Promise<void> {
    if (!this.config || !userIds.length) return;
    const subs = await this.prisma.pushSubscription.findMany({
      where: { userId: { in: userIds } },
    });
    const body = JSON.stringify(payload);
    await Promise.all(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            body,
            {
              vapidDetails: this.config!,
              TTL: 60 * 60 * 24,
              urgency: 'high',
            },
          );
        } catch (err) {
          const status = (err as { statusCode?: number }).statusCode;
          // 404 / 410 : abonnement expiré ou révoqué par l'utilisateur
          if (status === 404 || status === 410) {
            await this.prisma.pushSubscription
              .delete({ where: { id: s.id } })
              .catch(() => {});
          } else {
            this.logger.warn(
              `Envoi push échoué (${status ?? 'réseau'}) : ${(err as Error).message}`,
            );
          }
        }
      }),
    );
  }
}
