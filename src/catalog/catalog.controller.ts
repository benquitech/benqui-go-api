import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { AllowDemo } from '../common/decorators/allow-demo.decorator';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { ROLE_ADMIN } from '../common/constants';
import { CatalogService } from './catalog.service';
import {
  BrandsQueryDto,
  CreateCategoryDto,
  CreateManualProductDto,
  ProductsQueryDto,
  ProvinceQueryDto,
  SyncRunsQueryDto,
  UpdateBrandDto,
  UpdateCategoryDto,
  UpdateProductDto,
} from './dto/catalog.dto';

/**
 * Consultas del catalogo de precios de referencia. Las usan los usuarios del sistema y el demo
 * (token de POST /demo/session), que solo ve DEMO_PRODUCTS_PER_CATEGORY productos por rubro.
 */
@ApiTags('catalog')
@ApiBearerAuth()
@UseGuards(ThrottlerGuard)
@Throttle({ default: { limit: 120, ttl: 60000 } })
@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  /** Rubros con la cantidad de productos (para el demo: los que puede ver). */
  @AllowDemo()
  @Get('categories')
  categories(@CurrentUser() user: AuthUser) {
    return this.catalog.listCategories(user);
  }

  /** Provincias (codigo ISO "AR-A") para pedir precios regionales. */
  @AllowDemo()
  @Get('provinces')
  provinces() {
    return this.catalog.provinces();
  }

  /**
   * Productos paginados. Filtros: categoryId o category (slug "bebidas" / "cat-bebidas"), brandId,
   * search (palabras, sin importar acentos), province. Demo: ordenados por rubro y posicion.
   */
  @AllowDemo()
  @Get('products')
  products(@Query() q: ProductsQueryDto, @CurrentUser() user: AuthUser) {
    return this.catalog.listProducts(q, user);
  }

  /** Busca por codigo de barras (para precargar el alta de un producto al escanear). 404 si no esta. */
  @AllowDemo()
  @Get('products/barcode/:barcode')
  byBarcode(@Param('barcode') barcode: string, @Query() q: ProvinceQueryDto, @CurrentUser() user: AuthUser) {
    return this.catalog.findByBarcode(barcode, user, q.province);
  }

  /** Detalle: precios por provincia e historial del precio de referencia. */
  @AllowDemo()
  @Get('products/:id')
  product(@Param('id', ParseUUIDPipe) id: string, @Query() q: ProvinceQueryDto, @CurrentUser() user: AuthUser) {
    return this.catalog.findProduct(id, user, q.province);
  }
}

/** Administracion del catalogo: rubros y palabras clave, marcas destacadas, seleccion del demo. */
@ApiTags('catalog-admin')
@ApiBearerAuth()
@Roles(ROLE_ADMIN)
@Controller('catalog')
export class CatalogAdminController {
  constructor(private readonly catalog: CatalogService) {}

  /** Alta manual de un producto que SEPA no informa (ej. cigarrillos). La sincronizacion no lo toca. */
  @Post('products')
  async createProduct(@Body() dto: CreateManualProductDto, @CurrentUser() user: AuthUser) {
    const id = await this.catalog.createManualProduct(dto, user.userId);
    // Si es de una marca destacada (o se fijo), puede entrar al demo.
    await this.catalog.rebuildDemo();
    return this.catalog.findProduct(id, user);
  }

  /** Fijar rubro, fijar en el demo, ocultar. Nombre y precio solo en productos manuales. */
  @Patch('products/:id')
  async updateProduct(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateProductDto, @CurrentUser() user: AuthUser) {
    await this.catalog.updateProduct(id, dto, user.userId);
    return this.catalog.findProduct(id, user);
  }

  /** Solo productos manuales (los de SEPA se ocultan con isHidden). */
  @Delete('products/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteProduct(@Param('id', ParseUUIDPipe) id: string) {
    return this.catalog.deleteManualProduct(id);
  }

  @Post('categories')
  createCategory(@Body() dto: CreateCategoryDto, @CurrentUser() user: AuthUser) {
    return this.catalog.createCategory(dto, user.userId);
  }

  /** Cambiar nombre, color, icono, orden o palabras clave. Para aplicar las palabras ya: POST /catalog/reclassify. */
  @Patch('categories/:id')
  updateCategory(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCategoryDto, @CurrentUser() user: AuthUser) {
    return this.catalog.updateCategory(id, dto, user.userId);
  }

  @Delete('categories/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteCategory(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.catalog.deleteCategory(id, user.userId);
  }

  /** Vuelve a clasificar los productos con las palabras clave actuales. */
  @Post('reclassify')
  @HttpCode(HttpStatus.OK)
  reclassify() {
    return this.catalog.reclassify();
  }

  /** Marcas (?featured=true las destacadas, ?search=). */
  @Get('brands')
  brands(@Query() q: BrandsQueryDto) {
    return this.catalog.listBrands(q);
  }

  /** Destacar una marca: sus productos pasan a poder entrar al demo. */
  @Patch('brands/:id')
  updateBrand(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateBrandDto, @CurrentUser() user: AuthUser) {
    return this.catalog.updateBrand(id, dto.isFeatured, user.userId);
  }

  /** Cuantos productos ve el demo en cada rubro. */
  @Get('demo')
  demoSummary() {
    return this.catalog.demoSummary();
  }

  /** Recalcula los productos visibles del demo (la sincronizacion ya lo hace al terminar). */
  @Post('demo/rebuild')
  @HttpCode(HttpStatus.OK)
  rebuildDemo() {
    return this.catalog.rebuildDemo();
  }

  /** Ultimas sincronizaciones con SEPA (estado, filas, productos, cambios de precio, error). */
  @Get('sync-runs')
  syncRuns(@Query() q: SyncRunsQueryDto) {
    return this.catalog.listSyncRuns(q.limit);
  }
}
