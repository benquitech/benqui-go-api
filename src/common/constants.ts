export const ROLE_ADMIN = 'Administrador';
export const ROLE_CASHIER = 'Cajero';

/**
 * Rol del token que emite POST /demo/session (no existe en la tabla roles ni tiene usuario).
 * Solo puede usar los endpoints marcados con @AllowDemo() (ver RolesGuard).
 */
export const ROLE_DEMO = 'Demo';
export const DEMO_USER_NAME = 'demo';
