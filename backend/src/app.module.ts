import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { BullModule } from '@nestjs/bullmq';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { EvolutionModule } from './modules/evolution/evolution.module';
import { ContactsModule } from './modules/contacts/contacts.module';
import { ProductsModule } from './modules/products/products.module';
import { FlowsModule } from './modules/flows/flows.module';
import { CampaignsModule } from './modules/campaigns/campaigns.module';
import { OrdersModule } from './modules/orders/orders.module';
import { MediaModule } from './modules/media/media.module';
import { WebhookModule } from './modules/webhook/webhook.module';
import { PulseJob } from './jobs/pulse.job';
import { PulseRepository } from './jobs/pulse.repository';
import { ScheduledBroadcastJob } from './jobs/scheduled-broadcast.job';
import { BroadcastRepository } from './jobs/broadcast.repository';
import { MediaDeliveryJob } from './jobs/media-delivery.job';
import { MediaDeliveryRepository } from './jobs/media-delivery.repository';
import { RecurringCampaignJob } from './jobs/recurring-campaign.job';
import { RecurringCampaignRepository } from './jobs/recurring-campaign.repository';
import { InstanceMappingModule } from './modules/instance-mapping/instance-mapping.module';
import { AIModule } from './modules/ai/ai.module';
import { OperatingHoursService } from './common/services/operating-hours.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    // Rate limiting global por IP: bloqueia rajadas (20 req/s) e volume sustentado (120 req/min)
    ThrottlerModule.forRoot([
      { name: 'burst', ttl: 1_000, limit: 20 },
      { name: 'sustained', ttl: 60_000, limit: 120 },
    ]),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('REDIS_HOST', 'localhost'),
          port: config.get<number>('REDIS_PORT', 6379),
          password: config.get<string>('REDIS_PASSWORD'),
        },
      }),
      inject: [ConfigService],
    }),
    BullModule.registerQueue(
      { name: 'pulse' },
      { name: 'broadcast' },
      { name: 'media-delivery' },
      { name: 'campaign-recurring' },
    ),
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot(),
    DatabaseModule,
    AuthModule,
    EvolutionModule,
    ContactsModule,
    ProductsModule,
    FlowsModule,
    CampaignsModule,
    OrdersModule,
    MediaModule,
    WebhookModule,
    InstanceMappingModule,
    AIModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    OperatingHoursService,
    PulseRepository,
    PulseJob,
    BroadcastRepository,
    ScheduledBroadcastJob,
    MediaDeliveryRepository,
    MediaDeliveryJob,
    RecurringCampaignRepository,
    RecurringCampaignJob,
  ],
})
export class AppModule {}
