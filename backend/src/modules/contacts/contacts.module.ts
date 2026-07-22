import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { ContactsRepository } from './contacts.repository';
import { ContactsService } from './contacts.service';
import { ContactsController } from './contacts.controller';

@Module({
  imports: [MulterModule.register({ dest: '/tmp' })],
  controllers: [ContactsController],
  providers: [ContactsRepository, ContactsService],
  exports: [ContactsService],
})
export class ContactsModule {}
