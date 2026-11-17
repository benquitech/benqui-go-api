import { applyDecorators } from '@nestjs/common';
import { IsString, Matches, MinLength } from 'class-validator';

export const PASSWORD_MIN_LENGTH = 8;

/**
 * Contraseña segura: al menos 8 caracteres, una mayuscula, una minuscula, un numero y un
 * caracter especial (cualquiera que no sea letra, numero ni espacio).
 * Solo se aplica al crear o cambiar contraseñas; el login no la valida (cuentas existentes).
 */
export function StrongPassword() {
  return applyDecorators(
    IsString(),
    MinLength(PASSWORD_MIN_LENGTH, { message: `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres` }),
    Matches(/\p{Lu}/u, { message: 'La contraseña debe tener al menos una mayúscula' }),
    Matches(/\p{Ll}/u, { message: 'La contraseña debe tener al menos una minúscula' }),
    Matches(/\d/, { message: 'La contraseña debe tener al menos un número' }),
    Matches(/[^\p{L}\p{N}\s]/u, { message: 'La contraseña debe tener al menos un carácter especial (por ejemplo ! @ # $ %)' }),
  );
}
