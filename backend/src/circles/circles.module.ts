import { Module } from '@nestjs/common';
import { CirclesService } from './circles.service.js';
import { CirclesController } from './circles.controller.js';

@Module({
  controllers: [CirclesController],
  providers: [CirclesService],
  exports: [CirclesService],
})
export class CirclesModule {}
