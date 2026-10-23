import { redirect } from 'next/navigation'

// Eski aktivasyon linkleri: şifreyi artık admin belirliyor
export default function ActivatePage() {
  redirect('/login')
}
