import {
  Controller,
  Post,
  Req,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { writeFile } from 'fs/promises';
import { randomUUID } from 'crypto';
import { getSessionUser } from '../auth/get-session-user';
import type { Request } from 'express';
import { ALLOWED_TYPES, baseMime, matchesSignature } from './file-types';

const USE_R2 = !!(
  process.env.R2_ACCOUNT_ID &&
  process.env.R2_ACCESS_KEY_ID &&
  process.env.R2_SECRET_ACCESS_KEY &&
  process.env.R2_BUCKET_NAME &&
  process.env.R2_PUBLIC_URL
);

// Disk fallback (dev without R2)
const UPLOAD_DIR = join(process.cwd(), 'uploads');
if (!USE_R2 && !existsSync(UPLOAD_DIR))
  mkdirSync(UPLOAD_DIR, { recursive: true });

let s3Client: import('@aws-sdk/client-s3').S3Client | null = null;
async function getS3() {
  if (!s3Client) {
    const { S3Client } = await import('@aws-sdk/client-s3');
    s3Client = new S3Client({
      region: 'auto',
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    });
  }
  return s3Client;
}

@Controller('upload')
export class UploadController {
  @Post()
  @Throttle({ global: { ttl: 60_000, limit: 10 } })
  @UseInterceptors(
    FileInterceptor('file', {
      // Mémoire : la signature du fichier est vérifiée avant toute écriture
      storage: memoryStorage(),
      limits: { fileSize: 50 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        if (ALLOWED_TYPES[baseMime(file.mimetype)]) cb(null, true);
        else cb(new BadRequestException('Type de fichier non supporté'), false);
      },
    }),
  )
  async uploadFile(
    @Req() req: Request,
    @UploadedFile() file: Express.Multer.File,
  ) {
    await getSessionUser(req);
    if (!file) throw new BadRequestException('Aucun fichier reçu');

    const mime = baseMime(file.mimetype);
    const ext = ALLOWED_TYPES[mime];
    // Le type MIME vient du client : on vérifie le contenu réel du fichier
    if (!ext || !matchesSignature(mime, file.buffer.subarray(0, 512))) {
      throw new BadRequestException(
        'Le contenu du fichier ne correspond pas à son type',
      );
    }
    // Nom imposé par le serveur : jamais l'extension d'origine
    const filename = `${randomUUID()}${ext}`;

    if (USE_R2) {
      const { PutObjectCommand } = await import('@aws-sdk/client-s3');
      const key = `uploads/${filename}`;
      const s3 = await getS3();
      await s3.send(
        new PutObjectCommand({
          Bucket: process.env.R2_BUCKET_NAME!,
          Key: key,
          Body: file.buffer,
          ContentType: mime,
        }),
      );
      return {
        url: `${process.env.R2_PUBLIC_URL}/${key}`,
        name: file.originalname,
        type: mime,
        size: file.size,
      };
    }

    // Stockage disque : URL RELATIVE. Le client la résout vers l'origine API
    // courante (lib/media.ts) — les fichiers restent valides quel que soit
    // l'environnement (dev direct :3001, Docker/nginx :80, domaine déployé).
    await writeFile(join(UPLOAD_DIR, filename), file.buffer);
    return {
      url: `/uploads/${filename}`,
      name: file.originalname,
      type: mime,
      size: file.size,
    };
  }
}
