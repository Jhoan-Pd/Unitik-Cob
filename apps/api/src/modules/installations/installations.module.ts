import { Module } from '@nestjs/common';
import { InstallationsController } from './installations.controller';

@Module({
  controllers: [InstallationsController],
})
export class InstallationsModule {}
