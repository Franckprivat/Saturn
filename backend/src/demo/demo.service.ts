import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { auth } from '../auth/better-auth.instance';
import { getDemoConfig } from './demo.config';

// Personnages fictifs qui peuplent le compte démo. Ils n'ont pas de mot de
// passe (aucune ligne « account ») : impossible de se connecter avec.
const CAST = [
  {
    id: 'demo-lea',
    firstName: 'Léa',
    lastName: 'Martin',
    color: 'from-[#C96442] to-[#DA8A6A]',
  },
  {
    id: 'demo-karim',
    firstName: 'Karim',
    lastName: 'Benali',
    color: 'from-[#2563EB] to-[#60A5FA]',
  },
  {
    id: 'demo-sofia',
    firstName: 'Sofia',
    lastName: 'Rossi',
    color: 'from-[#7C3AED] to-[#A78BFA]',
  },
  {
    id: 'demo-thomas',
    firstName: 'Thomas',
    lastName: 'Durand',
    color: 'from-[#10B981] to-[#34D399]',
  },
] as const;

type CastId = (typeof CAST)[number]['id'];
// 'me' = le compte démo lui-même
type Line = [from: CastId | 'me', minutesAgo: number, text: string];

const DM_LEA: Line[] = [
  ['demo-lea', 180, 'Salut ! Tu as vu la nouvelle version de Saturn ? 🪐'],
  ['me', 176, 'Oui, les communautés façon Discord sont top'],
  ['demo-lea', 175, 'Et les appels vidéo marchent direct dans le navigateur'],
  ['me', 170, 'WebRTC + Socket.IO pour la signalisation 👌'],
  ['demo-lea', 42, 'On se fait un appel cet aprem pour la démo ?'],
];

const DM_KARIM: Line[] = [
  ['demo-karim', 1440, 'Hello, tu as pu regarder ma PR ?'],
  ['me', 1430, 'Oui, deux petits commentaires mais ça me va'],
  ['demo-karim', 1425, 'Parfait, je corrige et je merge 🚀'],
  [
    'demo-karim',
    95,
    "Au fait, les accusés de lecture s'affichent en temps réel maintenant",
  ],
];

const GROUP: Line[] = [
  ['demo-sofia', 300, 'Bienvenue dans le groupe ! 👋'],
  ['demo-karim', 290, 'Qui est dispo vendredi pour la rétro ?'],
  ['demo-lea', 285, 'Moi ✋'],
  ['me', 280, 'Moi aussi'],
  [
    'demo-sofia',
    20,
    "Je réserve une salle. Pensez à épingler l'ordre du jour 📌",
  ],
];

const COMMUNITY_GENERAL: Line[] = [
  ['demo-sofia', 600, 'Bienvenue sur Dev & Café ☕ Présentez-vous ici !'],
  ['demo-karim', 590, 'Salut tout le monde, dev backend NestJS'],
  ['demo-lea', 585, 'Hello ! Plutôt front, React et Next.js'],
  ['demo-thomas', 60, "Quelqu'un a déjà testé Prisma 7 ?"],
];

const COMMUNITY_HELP: Line[] = [
  [
    'demo-karim',
    240,
    "Astuce : un lien d'invitation peut expirer ou avoir un nombre d'utilisations max",
  ],
  ['demo-lea', 230, 'Pratique pour les communautés privées 👍'],
];

/**
 * Crée (ou remet en état) le compte démo et ses données d'exemple au démarrage.
 * Tout utilise des identifiants fixes : relancer le serveur restaure la vitrine
 * sans dupliquer quoi que ce soit.
 */
@Injectable()
export class DemoService implements OnApplicationBootstrap {
  private readonly logger = new Logger(DemoService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onApplicationBootstrap() {
    if (!getDemoConfig().enabled) return;
    try {
      await this.seed();
      this.logger.log(`Compte démo prêt : ${getDemoConfig().email}`);
    } catch (err) {
      // Ne jamais empêcher l'API de démarrer à cause de la démo
      this.logger.error('Échec de la préparation du compte démo', err);
    }
  }

  async seed() {
    const demoId = await this.ensureDemoUser();
    await this.ensureCast();

    for (const friend of ['demo-lea', 'demo-karim', 'demo-sofia'] as const) {
      await this.ensureFriendship(friend, demoId, 'ACCEPTED');
    }
    // Une demande en attente : montre le badge et le flux d'acceptation
    await this.ensureFriendship('demo-thomas', demoId, 'PENDING');

    await this.ensureConversation('demo-dm-lea', { type: 'DM' }, [
      [demoId, 'MEMBER'],
      ['demo-lea', 'MEMBER'],
    ]);
    await this.ensureMessages('demo-dm-lea', DM_LEA, demoId, [
      demoId,
      'demo-lea',
    ]);

    await this.ensureConversation('demo-dm-karim', { type: 'DM' }, [
      [demoId, 'MEMBER'],
      ['demo-karim', 'MEMBER'],
    ]);
    await this.ensureMessages('demo-dm-karim', DM_KARIM, demoId, [
      demoId,
      'demo-karim',
    ]);

    await this.ensureConversation(
      'demo-group',
      {
        type: 'GROUP',
        name: 'Projet Saturn 🪐',
        description: 'Le groupe de l’équipe',
        creatorId: 'demo-sofia',
      },
      [
        ['demo-sofia', 'ADMIN'],
        [demoId, 'ADMIN'],
        ['demo-lea', 'MEMBER'],
        ['demo-karim', 'MEMBER'],
      ],
    );
    await this.ensureMessages('demo-group', GROUP, demoId, [
      demoId,
      'demo-sofia',
      'demo-lea',
      'demo-karim',
    ]);

    await this.ensureCommunity(demoId);
  }

  private async ensureDemoUser(): Promise<string> {
    const { email, password } = getDemoConfig();
    const existing = await this.prisma.user.findUnique({ where: { email } });

    if (!existing) {
      // Passe par better-auth pour obtenir un compte et un hash identiques à
      // une vraie inscription.
      const res = await auth.api.signUpEmail({
        body: {
          email,
          password,
          name: 'Compte Démo',
          firstName: 'Compte',
          lastName: 'Démo',
          nickname: 'Visiteur',
        },
      });
      await this.prisma.user.update({
        where: { id: res.user.id },
        data: {
          emailVerified: true,
          bio: 'Compte de démonstration partagé : explore librement !',
          avatarColor: 'from-[#C17629] to-[#D48E45]',
        },
      });
      return res.user.id;
    }

    // Le mot de passe configuré fait foi (au cas où il aurait changé).
    const ctx = await auth.$context;
    const hash = await ctx.password.hash(password);
    await this.prisma.account.updateMany({
      where: { userId: existing.id, providerId: 'credential' },
      data: { password: hash },
    });
    return existing.id;
  }

  private async ensureCast() {
    for (const p of CAST) {
      const data = {
        name: `${p.firstName} ${p.lastName}`,
        // L'interface affiche le pseudo (sinon l'e-mail)
        nickname: `${p.firstName} ${p.lastName}`,
        firstName: p.firstName,
        lastName: p.lastName,
        avatarColor: p.color,
        emailVerified: true,
      };
      await this.prisma.user.upsert({
        where: { id: p.id },
        update: data,
        create: { id: p.id, email: `${p.id}@example.com`, ...data },
      });
    }
  }

  private async ensureFriendship(
    requesterId: string,
    addresseeId: string,
    status: 'ACCEPTED' | 'PENDING',
  ) {
    // Supprime un éventuel lien dans l'autre sens (blocage, demande inverse…)
    await this.prisma.friendship.deleteMany({
      where: { requesterId: addresseeId, addresseeId: requesterId },
    });
    await this.prisma.friendship.upsert({
      where: { requesterId_addresseeId: { requesterId, addresseeId } },
      update: { status },
      create: { requesterId, addresseeId, status },
    });
  }

  private async ensureConversation(
    id: string,
    data: {
      type: 'DM' | 'GROUP' | 'CHANNEL';
      name?: string;
      description?: string;
      creatorId?: string;
      communityId?: string;
    },
    members: [userId: string, role: 'ADMIN' | 'MEMBER'][],
  ) {
    await this.prisma.conversation.upsert({
      where: { id },
      update: data,
      create: { id, ...data },
    });
    for (const [userId, role] of members) {
      const existing = await this.prisma.conversationParticipant.findFirst({
        where: { conversationId: id, userId },
      });
      if (existing) {
        await this.prisma.conversationParticipant.update({
          where: { id: existing.id },
          data: { role },
        });
      } else {
        await this.prisma.conversationParticipant.create({
          data: { conversationId: id, userId, role },
        });
      }
    }
  }

  private async ensureMessages(
    conversationId: string,
    lines: Line[],
    demoId: string,
    readers: string[] = [],
  ) {
    const now = Date.now();
    for (const [i, [from, minutesAgo, content]] of lines.entries()) {
      const id = `${conversationId}-m${i}`;
      const senderId = from === 'me' ? demoId : from;
      const createdAt = new Date(now - minutesAgo * 60_000);
      await this.prisma.message.upsert({
        where: { id },
        // Restaure le message s'il a été modifié ou supprimé pendant une visite
        update: {
          content,
          senderId,
          createdAt,
          editedAt: null,
          deletedAt: null,
        },
        create: { id, conversationId, senderId, content, createdAt },
      });
      // Accusés de lecture : les coches « lu » s'affichent comme en vrai
      for (const userId of readers) {
        if (userId === senderId) continue;
        await this.prisma.readReceipt.upsert({
          where: { messageId_userId: { messageId: id, userId } },
          update: {},
          create: { messageId: id, userId, readAt: createdAt },
        });
      }
    }
  }

  private async ensureCommunity(demoId: string) {
    const communityId = 'demo-community';
    await this.prisma.community.upsert({
      where: { id: communityId },
      update: {},
      create: {
        id: communityId,
        name: 'Dev & Café ☕',
        description: 'La communauté des devs qui carburent au café',
        ownerId: 'demo-sofia',
      },
    });

    const roles: [string, 'OWNER' | 'ADMIN' | 'MEMBER'][] = [
      ['demo-sofia', 'OWNER'],
      ['demo-karim', 'ADMIN'],
      ['demo-lea', 'MEMBER'],
      ['demo-thomas', 'MEMBER'],
      [demoId, 'MEMBER'],
    ];
    for (const [userId, role] of roles) {
      await this.prisma.communityMember.upsert({
        where: { communityId_userId: { communityId, userId } },
        update: { role },
        create: { communityId, userId, role },
      });
    }
    await this.prisma.communityBan.deleteMany({
      where: { communityId, userId: demoId },
    });

    const categories = [
      { id: 'demo-cat-text', name: 'Salons textuels', position: 0 },
      { id: 'demo-cat-voice', name: 'Salons vocaux', position: 1 },
    ];
    for (const c of categories) {
      await this.prisma.channelCategory.upsert({
        where: { id: c.id },
        update: {},
        create: { ...c, communityId },
      });
    }

    const textChannels = [
      { id: 'demo-ch-general', name: 'général', lines: COMMUNITY_GENERAL },
      { id: 'demo-ch-entraide', name: 'entraide', lines: COMMUNITY_HELP },
    ];
    for (const [position, ch] of textChannels.entries()) {
      const conversationId = `${ch.id}-conv`;
      await this.ensureConversation(
        conversationId,
        { type: 'CHANNEL', name: ch.name, communityId },
        [],
      );
      await this.prisma.channel.upsert({
        where: { id: ch.id },
        update: {},
        create: {
          id: ch.id,
          communityId,
          categoryId: 'demo-cat-text',
          name: ch.name,
          type: 'TEXT',
          position,
          conversationId,
        },
      });
      await this.ensureMessages(conversationId, ch.lines, demoId);
    }

    await this.prisma.channel.upsert({
      where: { id: 'demo-ch-voice' },
      update: {},
      create: {
        id: 'demo-ch-voice',
        communityId,
        categoryId: 'demo-cat-voice',
        name: 'Général',
        type: 'VOICE',
        position: 0,
      },
    });
  }
}
