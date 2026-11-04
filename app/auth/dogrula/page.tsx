import type { Metadata } from 'next'
import { VerifyEmail } from '@/components/auth/VerifyEmail'

export const metadata: Metadata = { title: 'E-posta Doğrulama', robots: { index: false, follow: false } }

/** Kayıt doğrulama bağlantısı (?token_hash, lib/server/account-emails.ts) */
export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const { token_hash } = await searchParams
  return <VerifyEmail tokenHash={typeof token_hash === 'string' && token_hash ? token_hash : null} />
}
