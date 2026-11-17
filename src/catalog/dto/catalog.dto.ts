import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsHexColor,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { PROVINCE_CODES } from '../logic/provinces';

const toBool = ({ value }: { value: unknown }) => (value === 'true' || value === true ? true : value === 'false' || value === false ? false : value);
const toUpper = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toUpperCase() : value);

export class ProductsQueryDto extends PaginationQueryDto {
  /** Rubro por id. */
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  /** Rubro por slug ("bebidas"). Tambien acepta el id del demo ("cat-bebidas"). */
  @IsOptional()
  @IsString()
  @MaxLength(44)
  category?: string;

  @IsOptional()
  @IsUUID()
  brandId?: string;

  /** Provincia para el precio ("AR-A" = Salta). Sin provincia, o sin datos en esa provincia: precio nacional. */
  @IsOptional()
  @Transform(toUpper)
  @IsIn(PROVINCE_CODES)
  province?: string;

  /** Solo administrador: incluir productos ocultos. */
  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  includeHidden?: boolean;

  /** Solo administrador: solo los que ve el demo. */
  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  demoOnly?: boolean;
}

export class ProvinceQueryDto {
  @IsOptional()
  @Transform(toUpper)
  @IsIn(PROVINCE_CODES)
  province?: string;
}

export class CreateCategoryDto {
  @Matches(/^[a-z0-9-]{2,40}$/, { message: 'El slug solo admite minúsculas, números y guiones (2 a 40)' })
  slug: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name: string;

  @IsHexColor()
  color: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  icon?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;

  /** Palabras clave para clasificar productos ("gaseosa", "agua mineral"). */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(300)
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  keywords?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(300)
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  excludeKeywords?: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateCategoryDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsHexColor()
  color?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  icon?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(300)
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  keywords?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(300)
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  excludeKeywords?: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateManualProductDto {
  @Matches(/^(\d{8}|\d{12,14})$/, { message: 'El código de barras debe tener 8, 12, 13 o 14 dígitos' })
  barcode: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  brandName?: string;

  @IsUUID()
  categoryId: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  referencePrice: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  presentationQty?: number;

  @IsOptional()
  @IsIn(['g', 'ml', 'unit'])
  presentationUnit?: 'g' | 'ml' | 'unit';

  @IsOptional()
  @IsBoolean()
  isPinned?: boolean;
}

export class UpdateProductDto {
  /** Fija el rubro a mano (la sincronizacion ya no lo cambia). null = vuelve a la clasificacion automatica. */
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsUUID()
  categoryId?: string | null;

  /** Demo: fijarlo entre los productos visibles de su rubro. */
  @IsOptional()
  @IsBoolean()
  isPinned?: boolean;

  /** Ocultarlo de todas las consultas. */
  @IsOptional()
  @IsBoolean()
  isHidden?: boolean;

  /** Solo productos MANUAL (los de SEPA los pisa la sincronizacion). */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name?: string;

  /** Solo productos MANUAL. */
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  referencePrice?: number;
}

export class BrandsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  featured?: boolean;
}

export class UpdateBrandDto {
  @IsBoolean()
  isFeatured: boolean;
}

export class SyncRunsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;
}
