import { SetMetadata } from '@nestjs/common';

export const ALLOW_DEMO_KEY = 'allowDemo';

/**
 * Habilita el endpoint para el token del demo (rol "Demo"). Por defecto el demo NO puede usar
 * ningun endpoint: asi un endpoint nuevo nunca queda expuesto al demo por olvido.
 */
export const AllowDemo = () => SetMetadata(ALLOW_DEMO_KEY, true);
