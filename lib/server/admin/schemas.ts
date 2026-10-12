import { z } from 'zod'
import { businessTypeSlug, profileUpdateSchema } from '@/lib/restaurant-profile'
import { SUBDOMAIN_RE } from './orgs'

const clean = (max: number) => z.string().transform((s) => s.replace(/[<>]/g, '').trim().slice(0, max))

export const password = z
  .string()
  .min(8, 'Şifre en az 8 karakter olmalı')
  .max(100)
  .refine((s) => /[A-Za-zÇĞİÖŞÜçğıöşü]/.test(s) && /\d/.test(s), 'Şifre harf ve rakam içermeli')

export const email = z.string().trim().toLowerCase().email('Geçerli bir e-posta girin').max(200)

export const subdomain = z
  .string()
  .trim()
  .toLowerCase()
  .regex(SUBDOMAIN_RE, 'Subdomain yalnızca küçük harf, rakam ve tire içerebilir (2-40 karakter)')
  .min(2)

export const memberRole = z.enum(['owner', 'admin', 'staff'])

/* ---------------- Restoranlar ---------------- */

export const createOrganizationSchema = z.object({
  businessName: clean(100).pipe(z.string().min(2, 'İşletme adı en az 2 karakter olmalı')),
  ownerName: clean(80).pipe(z.string().min(2, 'Yetkili adı en az 2 karakter olmalı')),
  email,
  password,
  phone: clean(30).optional(),
  city: clean(50).optional(),
  subdomain: subdomain.optional().or(z.literal('')),
  businessType: businessTypeSlug.optional().or(z.literal('')),
  templateSlug: z.string().max(80).optional().or(z.literal('')),
  mustChangePassword: z.boolean().default(true),
  skipOnboarding: z.boolean().default(false),
})

export const updateOrganizationSchema = profileUpdateSchema
  .omit({ onboardingStep: true, completeOnboarding: true })
  .extend({
    subdomain: subdomain.optional(),
    ownerName: clean(80).optional(),
    state: clean(50).optional(),
    zipcode: clean(12).optional(),
    logoUrl: z.string().max(2048).optional(),
    coverUrl: z.string().max(2048).optional(),
    adminNote: z.string().max(4000).optional(),
    onboardingCompleted: z.boolean().optional(),
  })

export const statusSchema = z
  .object({
    status: z.enum(['active', 'suspended']),
    reason: clean(500).optional().default(''),
  })
  .refine((v) => v.status === 'active' || v.reason.length >= 3, {
    message: 'Askıya alma sebebi zorunludur',
    path: ['reason'],
  })

export const deleteOrganizationSchema = z.object({
  confirmSubdomain: z.string(),
  deleteUsers: z.boolean().default(false),
})

export const addMemberSchema = z.union([
  z.object({ mode: z.literal('existing'), email, role: memberRole }),
  z.object({
    mode: z.literal('new'),
    email,
    password,
    ownerName: clean(80).optional(),
    role: memberRole,
    mustChangePassword: z.boolean().default(true),
  }),
])

export const updateMemberSchema = z.object({ userId: z.string().uuid(), role: memberRole })
export const removeMemberSchema = z.object({ userId: z.string().uuid() })

/* ---------------- Kullanıcılar ---------------- */

export const updateUserSchema = z.object({
  email: email.optional(),
  ownerName: clean(80).optional(),
  password: password.optional(),
  mustChangePassword: z.boolean().optional(),
  /** true: süresiz engelle, false: engeli kaldır */
  banned: z.boolean().optional(),
  banReason: clean(300).optional(),
})

/* ---------------- Katalog ---------------- */

const catalogSlug = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug yalnızca küçük harf, rakam ve tire içerebilir')
  .max(80)

export const categoryCreateSchema = z.object({
  slug: catalogSlug,
  name: clean(80).pipe(z.string().min(1)),
  nameEn: clean(80).optional().default(''),
  icon: clean(40).optional().default(''),
  parentId: z.string().uuid().nullable().optional(),
  isActive: z.boolean().optional().default(true),
})

export const categoryUpdateSchema = z.object({
  name: clean(80).pipe(z.string().min(1)).optional(),
  nameEn: clean(80).optional(),
  icon: clean(40).optional(),
  parentId: z.string().uuid().nullable().optional(),
  isActive: z.boolean().optional(),
})

export const reorderSchema = z.object({
  orders: z.array(z.object({ id: z.string().uuid(), displayOrder: z.number().int().min(0).max(100000) })).max(1000),
})

const allergenList = z.array(clean(40)).max(20)
const tagList = z.array(z.string().regex(/^[a-z_]{2,30}$/)).max(20)

export const itemCreateSchema = z.object({
  slug: catalogSlug,
  categoryId: z.string().uuid(),
  name: clean(120).pipe(z.string().min(1)),
  nameEn: clean(120).optional().default(''),
  description: clean(600).optional().default(''),
  descriptionEn: clean(600).optional().default(''),
  priceSuggested: clean(20).optional().default('0'),
  allergens: allergenList.optional().default([]),
  calories: z.number().int().min(0).max(5000).nullable().optional(),
  tags: tagList.optional().default([]),
  isActive: z.boolean().optional().default(true),
})

export const itemUpdateSchema = z.object({
  categoryId: z.string().uuid().optional(),
  name: clean(120).pipe(z.string().min(1)).optional(),
  nameEn: clean(120).optional(),
  description: clean(600).optional(),
  descriptionEn: clean(600).optional(),
  priceSuggested: clean(20).optional(),
  allergens: allergenList.optional(),
  calories: z.number().int().min(0).max(5000).nullable().optional(),
  tags: tagList.optional(),
  isActive: z.boolean().optional(),
  displayOrder: z.number().int().min(0).max(100000).optional(),
})

export const itemImageSchema = z.union([
  z.object({ mode: z.literal('upload'), dataUrl: z.string().min(20) }),
  z.object({ mode: z.literal('generate'), prompt: z.string().max(400).optional() }),
])

/* ---------------- İşletme türleri ve şablonlar ---------------- */

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Renk #RRGGBB biçiminde olmalı')

export const businessTypeCreateSchema = z.object({
  slug: businessTypeSlug,
  label: clean(60).pipe(z.string().min(2)),
  icon: clean(16).optional().default(''),
  hint: clean(160).optional().default(''),
  color: hexColor.optional().default('#e11d48'),
  coverImage: z.string().max(2048).optional().default(''),
  defaultTemplateSlug: z.string().max(80).nullable().optional(),
  displayOrder: z.number().int().min(0).max(10000).optional(),
  isActive: z.boolean().optional().default(true),
})

export const businessTypeUpdateSchema = businessTypeCreateSchema.omit({ slug: true }).partial()

export const templateCreateSchema = z.object({
  slug: catalogSlug,
  businessType: businessTypeSlug.nullable().optional(),
  name: clean(100).pipe(z.string().min(2)),
  tagline: clean(200).optional().default(''),
  venueType: clean(60).optional().default(''),
  icon: clean(16).optional().default(''),
  color: hexColor.optional().default('#e11d48'),
  coverImage: z.string().max(2048).optional().default(''),
  description: clean(1000).optional().default(''),
  displayOrder: z.number().int().min(0).max(10000).optional(),
  isActive: z.boolean().optional().default(true),
})

export const templateUpdateSchema = templateCreateSchema.omit({ slug: true }).partial()

export const templateCategoriesSchema = z.object({
  categories: z.array(z.object({ categoryId: z.string().uuid(), displayOrder: z.number().int().min(0) })).max(500),
})

export const templateItemsSchema = z.object({
  items: z
    .array(
      z.object({
        itemId: z.string().uuid(),
        displayOrder: z.number().int().min(0),
        priceOverride: clean(20).nullable().optional(),
      })
    )
    .max(3000),
})

/* ---------------- Ayarlar ---------------- */

export const settingsSchema = z.object({
  signup_enabled: z.boolean().optional(),
  image_gen_org_daily_cap: z.number().int().min(0).max(1000).optional(),
  image_gen_daily_cap: z.number().int().min(0).max(10000).optional(),
  suspended_menu_message: clean(300).optional(),
})
