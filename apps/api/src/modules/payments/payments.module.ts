import { Module } from '@nestjs/common';
import { PromisesModule } from '../promises/promises.module';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { WompiService } from './wompi.service';

@Module({
  imports: [PromisesModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, WompiService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
