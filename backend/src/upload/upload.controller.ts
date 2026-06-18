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
import { diskStorage, memoryStorage } from 'multer';
import { extname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { randomUUID } from 'crypto';
import { getSessionUser } from '../auth/get-session-user';

const USE_R2 = !!(
  process.env.R2_ACCOUNT_ID &&
  process.env.R2_ACCESS_KEY_ID &&
  process.env.R2_SECRET_ACCESS_KEY &&
  process.env.R2_BUCKET_NAME &&
  process.env.R2_PUBLIC_URL
);

// Disk fallback (dev without R2)
const UPLOAD_DIR = join(process.cwd(), 'uploads');
if (!USE_R2 && !existsSync(UPLOAD_DIR)) mkdirSync(UPLOAD_DIR, { recursive: true });

const storageConfig = USE_R2
  ? memoryStorage()
  : diskStorage({
      destination: UPLOAD_DIR,
      filename: (_req, file, cb) => {
        const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        cb(null, `${unique}${extname(file.originalname)}`);
      },
    });

@Controller('upload')
export class UploadController {
  @Post()
  @Throttle({ global: { ttl: 60_000, limit: 10 } })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: storageConfig,
      limits: { fileSize: 50 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const allowed = /image\/(jpeg|png|gif|webp)|video\/(mp4|webm)|audio\/(webm|ogg|mpeg|mp4)|application\/pdf|text\//;
        if (allowed.test(file.mimetype)) cb(null, true);
        else cb(new BadRequestException('Type de fichier non supporté'), false);
      },
    }),
  )
  async uploadFile(@Req() req: any, @UploadedFile() file: Express.Multer.File) {
    await getSessionUser(req);
    if (!file) throw new BadRequestException('Aucun fichier reçu');

    if (USE_R2) {
      const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
      const s3 = new S3Client({
        region: 'auto',
        endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId: process.env.R2_ACCESS_KEY_ID!,
          secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
        },
      });
      const key = `uploads/${randomUUID()}${extname(file.originalname)}`;
      await s3.send(
        new PutObjectCommand({
          Bucket: process.env.R2_BUCKET_NAME!,
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype,
        }),
      );
      return {
        url: `${process.env.R2_PUBLIC_URL}/${key}`,
        name: file.originalname,
        type: file.mimetype,
        size: file.size,
      };
    }

    // Disk fallback
    const baseUrl = process.env.BACKEND_URL || 'http://localhost:3001';
    return {
      url: `${baseUrl}/uploads/${file.filename}`,
      name: file.originalname,
      type: file.mimetype,
      size: file.size,
    };
  }
}
