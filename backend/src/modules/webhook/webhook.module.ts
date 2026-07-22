import { Module } from '@nestjs/common';
import { WebhookRepository } from './webhook.repository';
import { WebhookService } from './webhook.service';
import { WebhookController } from './webhook.controller';
import { WebhookGuard } from './webhook.guard';
import { EvolutionModule } from '../evolution/evolution.module';

@Module({
  imports: [EvolutionModule],
  controllers: [WebhookController],
  providers: [WebhookRepository, WebhookService, WebhookGuard],
})
export class WebhookModule {}
