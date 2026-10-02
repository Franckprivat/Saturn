import { Body, Controller, Logger, Post, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import Anthropic from '@anthropic-ai/sdk';
import { getSessionUser } from '../auth/get-session-user';
import type { Request } from 'express';

@Controller('ai')
export class AiController {
  private readonly logger = new Logger(AiController.name);
  private client: Anthropic | null = null;

  constructor() {
    if (process.env.ANTHROPIC_API_KEY) {
      this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    } else {
      this.logger.warn(
        'ANTHROPIC_API_KEY non définie — suggestions IA désactivées',
      );
    }
  }

  @Post('suggest')
  // Chaque appel coûte des tokens : quota serré par utilisateur/IP
  @Throttle({ global: { ttl: 60_000, limit: 10 } })
  async suggest(
    @Req() req: Request,
    @Body('messages') messages: { role: string; content: string }[],
  ) {
    await getSessionUser(req);

    if (!this.client) return { suggestions: [] };

    try {
      // Entrée client : rôles et longueurs normalisés avant l'appel à l'API
      const last5 = (Array.isArray(messages) ? messages : [])
        .slice(-5)
        .filter((m) => typeof m?.content === 'string' && m.content.trim())
        .map((m) => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: m.content.slice(0, 1000),
        }));
      if (!last5.length) return { suggestions: [] };
      const response = await this.client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 200,
        system: `Tu es un assistant qui génère des suggestions de réponses courtes et naturelles pour une messagerie instantanée.
Génère exactement 3 suggestions de réponses au dernier message reçu. Chaque suggestion doit être sur une ligne séparée, sans numérotation, sans guillemets, sans tirets. Maximum 15 mots par suggestion. Réponds en français sauf si la conversation est dans une autre langue.`,
        messages: [
          ...last5.map((m) => ({
            role: m.role as 'user' | 'assistant',
            content: m.content,
          })),
          {
            role: 'user',
            content: 'Génère 3 suggestions de réponses courtes.',
          },
        ],
      });
      const text =
        response.content[0].type === 'text' ? response.content[0].text : '';
      const suggestions = text
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 3);
      return { suggestions };
    } catch (err: unknown) {
      this.logger.error(
        `Suggestions IA : ${err instanceof Error ? err.message : String(err)}`,
      );
      return { suggestions: [] };
    }
  }
}
