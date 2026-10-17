/**
 * İşletme hesap durumu (organizations.status). İstemci ve sunucu ortak.
 *  - active:    yayında, panel düzenlenebilir
 *  - pending:   /signup başvurusu; sistem yöneticisi onaylayana kadar site yayınlanmaz, panel kullanılabilir
 *  - rejected:  başvuru reddedildi; site yok, panel salt-okunur (sebep gösterilir)
 *  - suspended: askıda; site "hizmet dışı", panel salt-okunur (sebep gösterilir)
 */
export const ORG_STATUSES = ['active', 'pending', 'rejected', 'suspended'] as const
export type OrgStatus = (typeof ORG_STATUSES)[number]

export function normalizeOrgStatus(value: unknown): OrgStatus {
  return (ORG_STATUSES as readonly string[]).includes(String(value)) ? (value as OrgStatus) : 'active'
}

/** Panel salt-okunur olan durumlar (yazma 423 döner) */
export function isReadOnlyStatus(status: OrgStatus | string | null | undefined): boolean {
  return status === 'suspended' || status === 'rejected'
}

export const ORG_STATUS_LABELS: Record<OrgStatus, string> = {
  active: 'Aktif',
  pending: 'Onay bekliyor',
  rejected: 'Reddedildi',
  suspended: 'Askıda',
}
