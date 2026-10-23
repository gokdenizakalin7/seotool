import type { Metadata } from 'next'
import { ClientApp } from '@/components/ClientApp'

export const metadata: Metadata = { title: 'Giriş Yap', robots: { index: false, follow: true } }

export default function LoginPage() {
  return <ClientApp />
}
