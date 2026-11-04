import type { Metadata } from 'next'
import { ResetPassword } from '@/components/auth/ResetPassword'

export const metadata: Metadata = { title: 'Şifre Yenile', robots: { index: false, follow: false } }

/** Şifremi unuttum: ?token_hash yoksa bağlantı isteme formu, varsa yeni şifre formu (e-postadaki bağlantı) */
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const { token_hash } = await searchParams
  return <ResetPassword tokenHash={typeof token_hash === 'string' && token_hash ? token_hash : null} />
}
