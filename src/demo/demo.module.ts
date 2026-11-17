import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { DemoController } from './demo.controller';
import { DemoService } from './demo.service';

@Module({
  imports: [JwtModule.register({})],
  controllers: [DemoController],
  providers: [DemoService],
})
export class DemoModule {}
