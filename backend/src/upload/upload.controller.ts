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
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { getSessionUser } from '../auth/get-session-user';

const UPLOAD_DIR = join(process.cwd(), 'uploads');
if (!existsSync(UPLOAD_DIR)) mkdirSync(UPLOAD_DIR, { recursive: true });

@Controller('upload')
export class UploadController {
  @Post()
  @Throttle({ global: { ttl: 60_000, limit: 10 } }) // max 10 uploads/min
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: UPLOAD_DIR,
        filename: (_req, file, cb) => {
          const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
          cb(null, `${unique}${extname(file.originalname)}`);
        },
      }),
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
    const baseUrl = process.env.BACKEND_URL || 'http://localhost:3001';
    return {
      url: `${baseUrl}/uploads/${file.filename}`,
      name: file.originalname,
      type: file.mimetype,
      size: file.size,
    };
  }
}
