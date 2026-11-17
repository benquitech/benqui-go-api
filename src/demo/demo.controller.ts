import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiProperty, ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { Public } from '../common/decorators/public.decorator';
import { DemoService } from './demo.service';

export class DemoSessionDto {
  @ApiProperty({ description: 'Clave del demo (DEMO_ACCESS_KEY). El front la tiene en su environment.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  key: string;
}

@ApiTags('demo')
@Controller('demo')
export class DemoController {
  constructor(private readonly demo: DemoService) {}

  /**
   * Canjea la clave del demo por un token temporal (Bearer) de solo lectura del catálogo.
   * Maximo 10 intentos por minuto por IP.
   */
  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('session')
  @HttpCode(HttpStatus.OK)
  session(@Body() dto: DemoSessionDto) {
    return this.demo.createSession(dto.key);
  }
}
