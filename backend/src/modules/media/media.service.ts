import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  CreateBucketCommand,
  HeadBucketCommand,
  PutBucketPolicyCommand,
} from '@aws-sdk/client-s3';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { ScheduleDeliveryDto } from './dto/schedule-delivery.dto';
import { MediaRepository } from './media.repository';

@Injectable()
export class MediaService implements OnModuleInit {
  private readonly logger = new Logger(MediaService.name);
  private s3: S3Client;
  private bucket: string;
  private publicUrl: string;

  constructor(
    private repo: MediaRepository,
    private configService: ConfigService,
    @InjectQueue('media-delivery') private mediaQueue: Queue,
  ) {
    const endpoint = this.configService.get<string>('S3_ENDPOINT');
    const region = this.configService.get<string>('S3_REGION', 'us-east-1');
    const accessKeyId = this.configService.get<string>('S3_ACCESS_KEY', '');
    const secretAccessKey = this.configService.get<string>('S3_SECRET_KEY', '');

    this.bucket = this.configService.get<string>('S3_BUCKET', 'media');
    this.publicUrl = this.configService.get<string>('S3_PUBLIC_URL', '');

    this.s3 = new S3Client({
      endpoint,
      region,
      credentials: { accessKeyId, secretAccessKey },
      forcePathStyle: true,
    });
  }

  async onModuleInit() {
    try {
      await this.s3.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch {
      await this.s3.send(new CreateBucketCommand({ Bucket: this.bucket }));
      this.logger.log(`Bucket "${this.bucket}" criado automaticamente`);
    }

    // A Evolution API baixa a mídia anonimamente (só recebe a URL, sem credenciais AWS),
    // então o bucket precisa de leitura pública para o download não cair em 403 AccessDenied.
    try {
      await this.s3.send(
        new PutBucketPolicyCommand({
          Bucket: this.bucket,
          Policy: JSON.stringify({
            Version: '2012-10-17',
            Statement: [
              {
                Effect: 'Allow',
                Principal: '*',
                Action: ['s3:GetObject'],
                Resource: [`arn:aws:s3:::${this.bucket}/*`],
              },
            ],
          }),
        }),
      );
    } catch (err) {
      this.logger.warn(`Não foi possível aplicar policy pública no bucket "${this.bucket}": ${err}`);
    }
  }

  async upload(file: Express.Multer.File, name: string, userId: string) {
    const key = `midias/${Date.now()}-${file.originalname}`;

    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      }),
    );

    const url = `${this.publicUrl}/${key}`;

    const mimeToTipo = (mime: string): 'IMAGEM' | 'VIDEO' | 'AUDIO' | 'DOCUMENTO' => {
      if (mime.startsWith('image/')) return 'IMAGEM';
      if (mime.startsWith('video/')) return 'VIDEO';
      if (mime.startsWith('audio/')) return 'AUDIO';
      return 'DOCUMENTO';
    };

    const [result] = await this.repo.insertMidia({
      name,
      type: mimeToTipo(file.mimetype),
      url,
      sizeBytes: file.size,
      mimeType: file.mimetype,
      createdBy: userId,
    });

    return result;
  }

  async findAll() {
    return this.repo.findAllMidias();
  }

  async softDelete(id: string) {
    const [existing] = await this.repo.findMidiaById(id);

    if (!existing) {
      throw new NotFoundException(`Mídia ${id} não encontrada`);
    }

    await this.repo.softDeleteMidia(id);
    return { message: 'Mídia removida com sucesso' };
  }

  async scheduleDelivery(dto: ScheduleDeliveryDto, userId: string) {
    const scheduledFor = new Date(dto.scheduledFor);
    const delay = scheduledFor.getTime() - Date.now();

    const [result] = await this.repo.insertEntrega({
      contactId: dto.contactId,
      mediaId: dto.mediaId,
      caption: dto.caption,
      scheduledFor,
      createdBy: userId,
    });

    await this.mediaQueue.add(
      'media-delivery',
      { entregaId: result.id },
      { delay: Math.max(delay, 0) },
    );

    return result;
  }

  async getDeliveries(query: { pagina?: number; limite?: number }) {
    const pagina = query.pagina ?? 1;
    const limite = query.limite ?? 20;

    const { rows, total } = await this.repo.findAllEntregasPaginated(pagina, limite);
    return { data: rows, total, pagina, limite };
  }

  async cancelDelivery(id: string) {
    const [existing] = await this.repo.findEntregaById(id);

    if (!existing) {
      throw new NotFoundException(`Entrega ${id} não encontrada`);
    }

    const [updated] = await this.repo.updateEntrega(id, { status: 'CANCELADO' });
    return updated;
  }
}
