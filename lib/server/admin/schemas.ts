import { z } from 'zod'
import { businessTypeSlug, profileUpdateSchema } from '@/lib/restaurant-profile'
import { SUBDOMAIN_RE } from './orgs'
import { isReservedSlug } from '@/lib/site-url'

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
  .regex(SUBDOMAIN_RE, 'Site adresi yalnızca küçük harf, rakam ve tire içerebilir (2-40 karakter)')
  .min(2)
  .refine((s) => !isReservedSlug(s), 'Bu ad sistem sayfalarına ayrılmış; başka bir site adresi seçin')

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
    // '' = işletme türünü temizle
    businessType: businessTypeSlug.or(z.literal('')).optional(),
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
    status: z.enum(['active', 'suspended', 'pending', 'rejected']),
    reason: clean(500).optional().default(''),
  })
  .refine((v) => (v.status !== 'suspended' && v.status !== 'rejected') || v.reason.length >= 3, {
    message: 'Sebep zorunludur',
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

/** system_admin restorana bağlanmaz; diğer roller organizationId ile o restorana eklenir */
export const createUserSchema = z
  .object({
    email,
    password,
    ownerName: clean(80).optional(),
    mustChangePassword: z.boolean().default(true),
    role: z.enum(['system_admin', 'owner', 'admin', 'staff']),
    organizationId: z.string().uuid().optional(),
  })
  .refine((v) => (v.role === 'system_admin' ? !v.organizationId : !!v.organizationId), {
    message: 'Sistem yöneticisine restoran atanamaz; restoran kullanıcısı için restoran seçilmeli',
    path: ['organizationId'],
  })

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

/*
 * Güncelleme şemaları varsayılansız tabandan türetilir: Zod 4'te .default() alanları .partial() içinde de
 * uygulanır; aksi halde tek alanlık PATCH (ör. varsayılan şablon seçimi) diğer alanları varsayılana çekerdi.
 */
const businessTypeFields = {
  label: clean(60).pipe(z.string().min(2)),
  icon: clean(16),
  hint: clean(160),
  color: hexColor,
  coverImage: z.string().max(2048),
  defaultTemplateSlug: z.string().max(80).nullable(),
  displayOrder: z.number().int().min(0).max(10000),
  isActive: z.boolean(),
}

export const businessTypeCreateSchema = z.object({
  ...businessTypeFields,
  slug: businessTypeSlug,
  icon: businessTypeFields.icon.optional().default(''),
  hint: businessTypeFields.hint.optional().default(''),
  color: businessTypeFields.color.optional().default('#e11d48'),
  coverImage: businessTypeFields.coverImage.optional().default(''),
  defaultTemplateSlug: businessTypeFields.defaultTemplateSlug.optional(),
  displayOrder: businessTypeFields.displayOrder.optional(),
  isActive: businessTypeFields.isActive.optional().default(true),
})

export const businessTypeUpdateSchema = z.object(businessTypeFields).partial()

const templateFields = {
  businessType: businessTypeSlug.nullable(),
  name: clean(100).pipe(z.string().min(2)),
  tagline: clean(200),
  venueType: clean(60),
  icon: clean(16),
  color: hexColor,
  coverImage: z.string().max(2048),
  description: clean(1000),
  displayOrder: z.number().int().min(0).max(10000),
  isActive: z.boolean(),
}

export const templateCreateSchema = z.object({
  ...templateFields,
  slug: catalogSlug,
  businessType: templateFields.businessType.optional(),
  tagline: templateFields.tagline.optional().default(''),
  venueType: templateFields.venueType.optional().default(''),
  icon: templateFields.icon.optional().default(''),
  color: templateFields.color.optional().default('#e11d48'),
  coverImage: templateFields.coverImage.optional().default(''),
  description: templateFields.description.optional().default(''),
  displayOrder: templateFields.displayOrder.optional(),
  isActive: templateFields.isActive.optional().default(true),
})

export const templateUpdateSchema = z.object(templateFields).partial()

export const templateContentSchema = z.object({
  categories: z.array(z.object({ categoryId: z.string().uuid(), displayOrder: z.number().int().min(0) })).max(500),
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
  signup_requires_approval: z.boolean().optional(),
  image_gen_org_daily_cap: z.number().int().min(0).max(1000).optional(),
  image_gen_daily_cap: z.number().int().min(0).max(10000).optional(),
  suspended_menu_message: clean(300).optional(),
})
