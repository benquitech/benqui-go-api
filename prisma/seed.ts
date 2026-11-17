import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import { DEFAULT_CATEGORIES, FEATURED_BRANDS } from '../src/catalog/logic/defaults';
import { brandKey, normalizeText, prettyName } from '../src/catalog/logic/text';

const prisma = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL || process.env.DATABASE_URL } } });

const ROLES = [
  { name: 'Administrador', description: 'Configura todo el sistema' },
  { name: 'Cajero', description: 'Vende y consulta precios' },
];

// [name, description, roles que lo tienen]
const A = 'Administrador';
const C = 'Cajero';
const PERMISSIONS: [string, string, string[]][] = [
  ['catalog.read', 'Consultar el catálogo de precios de referencia', [A, C]],
  ['catalog.manage', 'Administrar rubros, marcas destacadas y productos del catálogo', [A]],
  ['users.manage', 'Administrar usuarios, roles y permisos', [A]],
];

async function main() {
  // ── Roles y permisos (sincroniza como fireextracking-api) ──────────────────
  const roleIds: Record<string, string> = {};
  for (const r of ROLES) {
    const role = await prisma.role.upsert({ where: { name: r.name }, update: { description: r.description }, create: r });
    roleIds[r.name] = role.id;
  }
  const permissionIds: Record<string, string> = {};
  for (const [i, [name, description, roles]] of PERMISSIONS.entries()) {
    const perm = await prisma.permission.upsert({
      where: { name },
      update: { description, order: i + 1 },
      create: { name, description, order: i + 1 },
    });
    for (const roleName of roles) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: roleIds[roleName], permissionId: perm.id } },
        update: {},
        create: { roleId: roleIds[roleName], permissionId: perm.id },
      });
    }
    permissionIds[name] = perm.id;
  }
  for (const roleName of Object.keys(roleIds)) {
    const allowed = PERMISSIONS.filter(([, , roles]) => roles.includes(roleName)).map(([name]) => permissionIds[name]);
    await prisma.rolePermission.deleteMany({ where: { roleId: roleIds[roleName], permissionId: { notIn: allowed } } });
  }

  // ── Administrador inicial ──────────────────────────────────────────────────
  const adminUser = process.env.SEED_ADMIN_USER ?? 'admin';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  if (!adminPassword) throw new Error('Definí SEED_ADMIN_PASSWORD en el .env');
  if (!(await prisma.user.findUnique({ where: { userName: adminUser } }))) {
    await prisma.user.create({
      data: {
        userName: adminUser,
        password: await argon2.hash(adminPassword),
        firstName: 'Administrador',
        lastName: 'Sistema',
        roleId: roleIds[A],
      },
    });
    console.log(`Usuario administrador "${adminUser}" creado`);
  }

  // ── Rubros del catalogo (los del demo). Solo se crean: despues se editan desde la API. ──
  for (const [i, c] of DEFAULT_CATEGORIES.entries()) {
    const keywords = [...new Set(c.keywords.map(normalizeText))];
    const excludeKeywords = [...new Set(c.excludeKeywords.map(normalizeText))];
    const existing = await prisma.catalogCategory.findUnique({ where: { slug: c.slug } });
    if (!existing) {
      await prisma.catalogCategory.create({
        data: { slug: c.slug, name: c.name, color: c.color, icon: c.icon, order: i + 1, keywords, excludeKeywords },
      });
    } else if (process.env.SEED_RESET_KEYWORDS === 'true') {
      await prisma.catalogCategory.update({ where: { id: existing.id }, data: { keywords, excludeKeywords } });
    }
  }

  // ── Marcas destacadas (empresas conocidas: las que puede mostrar el demo) ──
  const featured = new Map<string, string>();
  for (const name of FEATURED_BRANDS) {
    const key = brandKey(name);
    if (key && !featured.has(key)) featured.set(key, prettyName(name));
  }
  const created = await prisma.catalogBrand.createMany({
    data: [...featured].map(([key, name]) => ({ key, name, isFeatured: true })),
    skipDuplicates: true,
  });

  console.log(`Seed listo: ${ROLES.length} roles, ${PERMISSIONS.length} permisos, ${DEFAULT_CATEGORIES.length} rubros, ${created.count} marcas destacadas nuevas`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
