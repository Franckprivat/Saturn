import { Body, Controller, Post, Req } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { getSessionUser } from '../auth/get-session-user';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

@Controller('ai')
export class AiController {
  @Post('suggest')
  async suggest(@Req() req: any, @Body('messages') messages: { role: string; content: string }[]) {
    await getSessionUser(req);

    const last5 = (messages || []).slice(-5);

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      system: `Tu es un assistant qui génère des suggestions de réponses courtes et naturelles pour une messagerie instantanée.
Génère exactement 3 suggestions de réponses au dernier message reçu. Chaque suggestion doit être sur une ligne séparée, sans numérotation, sans guillemets, sans tirets. Maximum 15 mots par suggestion. Réponds en français sauf si la conversation est dans une autre langue.`,
      messages: [
        ...last5.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
        {
          role: 'user',
          content: 'Génère 3 suggestions de réponses courtes.',
        },
      ],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const suggestions = text.split('\n').map((s) => s.trim()).filter(Boolean).slice(0, 3);
    return { suggestions };
  }
}
