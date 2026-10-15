'use client'

import React, { useRef, useState } from 'react'
import { toast } from 'sonner'
import { authFetch } from '@/lib/api-client'
import { QRCodeSVG } from 'qrcode.react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Restaurant } from '@/lib/types'
import { useRestaurant } from '@/components/providers/RestaurantProvider'
import { A4SheetPage, AcrylicTemplate, SHEET_SIZE, StickerTemplate } from '@/components/dashboard/QRPrintTemplates'
import { downloadBlob, fileSlug, qrSvgToJpeg, serializeQrSvg } from '@/lib/qr-export'
import { 
  QrCode, 
  Download, 
  Eye, 
  Copy, 
  Check, 
  Plus, 
  Trash2, 
  Printer, 
  Sparkles, 
  Layers, 
  FileText,
  ExternalLink
} from 'lucide-react'

type PrintTemplate = 'acrylic' | 'sticker' | 'general_a4' | 'tables_a4'

// İndirilen dosya adları: {subdomain}-{şablon}[-{masa}][-sayfa-N]
const TEMPLATE_FILE: Record<PrintTemplate, string> = {
  acrylic: 'masa-standi',
  sticker: 'sticker',
  general_a4: 'a4-genel',
  tables_a4: 'a4-masalar',
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

export interface TableItem {
  id: string
  name: string
  views: number
}

export function QRCodesContent() {
  const { restaurant: currentRestaurant } = useRestaurant()
  const logoUrl = currentRestaurant?.branding?.logoUrl || ''
  const qrLevel = logoUrl ? 'H' : 'M'
  const logoImage = (size: number) =>
    logoUrl ? { src: logoUrl, height: Math.round(size * 0.22), width: Math.round(size * 0.22), excavate: true } : undefined

  const subdomain = currentRestaurant?.subdomain || ''
  const primaryColor = currentRestaurant?.branding?.primaryColor || '#e11d48'

  const [tables, setTables] = useState<TableItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  // Liste yüklenemezse ekleme/silme kapalı: sync tüm listeyi yazar, boş listeyle mevcut masalar silinir
  const [loadError, setLoadError] = useState<string | null>(null)
  // Kayıtlar sırayla gider: üst üste binen iki sync aynı masayı iki kez ekleyebilir
  const [isSyncing, setIsSyncing] = useState(false)
  const canEdit = !isLoading && !loadError && !isSyncing

  const loadTables = React.useCallback(async () => {
    if (!subdomain) return
    setIsLoading(true)
    setLoadError(null)
    try {
      const res = await authFetch(`/api/tables/load?subdomain=${encodeURIComponent(subdomain)}`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Masalar yüklenemedi.')
      setTables(data.tables || [])
    } catch (err: any) {
      console.error(err)
      setLoadError(err?.message || 'Masalar yüklenemedi.')
    } finally {
      setIsLoading(false)
    }
  }, [subdomain])

  React.useEffect(() => {
    loadTables()
  }, [loadTables])

  const syncWithSupabase = async (updatedTables: TableItem[], previousTables: TableItem[]) => {
    setIsSyncing(true)
    try {
      const res = await authFetch('/api/tables/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subdomain, tables: updatedTables })
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Masalar kaydedilemedi.')
      // Yeni masalar gerçek kimlikleriyle gelir; geçici tbl- kimlikleri bir sonraki kayıtta silinip yeniden oluşmasın
      if (Array.isArray(data.tables)) setTables(data.tables)
      return true
    } catch (err: any) {
      console.error(err)
      toast.error(err?.message || 'Masalar kaydedilemedi.')
      setTables(previousTables)
      return false
    } finally {
      setIsSyncing(false)
    }
  }

  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [isAddTableOpen, setIsAddTableOpen] = useState(false)
  const [newTableName, setNewTableName] = useState('')
  
  // ŞABLON MODALI STATE'İ
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<PrintTemplate>('acrylic')
  const [activePrintTable, setActivePrintTable] = useState<TableItem | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<TableItem | null>(null)
  const [exporting, setExporting] = useState<null | 'print' | 'jpeg' | 'svg'>(null)
  const printAreaRef = useRef<HTMLDivElement>(null)

  // tid: masa adı değişse de basılı QR o masa için sayılsın; table: menüde masa adı gösterimi (eski QR'lar yalnızca bunu taşır)
  const getTableLink = (table: Pick<TableItem, 'id' | 'name'>) => {
    const tid = table.id.startsWith('tbl-') ? '' : `&tid=${encodeURIComponent(table.id)}`
    return `${window.location.origin}/menu/${subdomain}?table=${encodeURIComponent(table.name)}${tid}`
  }
  // Genel QR masaya bağlı değildir: Instagram bio vb. için sade menü adresi
  const menuLink = `${typeof window !== 'undefined' ? window.location.origin : ''}/menu/${subdomain}`
  const GENERAL_ID = 'gen'
  const printLink = (table: TableItem | null) => (!table || table.id === GENERAL_ID ? menuLink : getTableLink(table))



  const handleCopyLink = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleAddTable = async (e: React.FormEvent) => {
    e.preventDefault()
    const name = newTableName.trim()
    if (!name || !canEdit) return
    // Aynı adlı iki masa aynı QR adresini üretir
    if (tables.some((t) => t.name.trim().toLocaleLowerCase('tr') === name.toLocaleLowerCase('tr'))) {
      toast.error(`"${name}" adında bir masa zaten var.`)
      return
    }

    const newTable: TableItem = {
      id: `tbl-${Date.now()}`,
      name,
      views: 0
    }

    const previousTables = [...tables]
    const updated = [...tables, newTable]
    setTables(updated)
    setNewTableName('')
    setIsAddTableOpen(false)
    if (await syncWithSupabase(updated, previousTables)) toast.success(`${name} eklendi.`)
  }

  const handleDeleteTable = async (table: TableItem) => {
    if (!canEdit) return
    const previousTables = [...tables]
    const updated = tables.filter(t => t.id !== table.id)
    setTables(updated)
    setDeleteTarget(null)
    if (await syncWithSupabase(updated, previousTables)) toast.success(`${table.name} silindi.`)
  }

  const isSheet = selectedTemplate === 'general_a4' || selectedTemplate === 'tables_a4'
  const printDisabled = selectedTemplate === 'tables_a4' && tables.length === 0

  const handleOpenPrintModal = (table?: TableItem, tmpl: PrintTemplate = 'acrylic') => {
    // Toplu baskıda tek masa seçili değildir; önceki masa tekil şablonlara taşınmasın
    setActivePrintTable(table ?? null)
    setSelectedTemplate(tmpl)
    setIsPrintModalOpen(true)
  }

  /** Önizlemedeki şablon sayfaları (A4'te birden çok olabilir); yazdırma ve indirme bunlardan üretilir */
  const templatePages = () => Array.from(printAreaRef.current?.querySelectorAll<SVGSVGElement>('svg[data-qr-page]') ?? [])

  /** Yalnızca seçili şablonu ayrı pencerede yazdırır (panelin tamamı basılmasın). */
  const handlePrint = async () => {
    const svgs = templatePages()
    if (!svgs.length) return
    // Açılır pencere engeline takılmasın diye pencere tıklamayla aynı anda açılır, içerik hazırlanınca yazılır
    const w = window.open('', '_blank', 'width=900,height=1000')
    if (!w) {
      toast.error('Yazdırma penceresi açılamadı. Tarayıcının açılır pencere engelini kaldırın.')
      return
    }
    setExporting('print')
    try {
      const pages = await Promise.all(svgs.map(serializeQrSvg))
      const title = `${currentRestaurant?.name || 'QR'} - QR baskı`
      // A4 sayfaları kendi kenar boşluğunu taşır (mm); yazıcı boşluğu eklenmesin, her sayfa ayrı kâğıda.
      // 296 mm: tam A4 yüksekliği bazı yazıcılarda boş ikinci sayfa açar (alt 1 mm boş alan kırpılır)
      const pageCss = isSheet
        ? `@page{size:A4;margin:0}body>svg{display:block;width:210mm;height:296mm;break-after:page}body>svg:last-child{break-after:auto}`
        : `@page{margin:10mm}body{display:flex;justify-content:center;padding-top:16px}`
      w.document.write(
        `<!doctype html><html><head><meta charset="utf-8"><title>${title.replace(/</g, '&lt;')}</title>` +
          `<style>html,body{background:#fff;margin:0}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}${pageCss}</style>` +
          `</head><body>${pages.map((p) => p.replace(/^<\?xml[^>]*>\s*/, '')).join('')}</body></html>`
      )
      w.document.close()
      let printed = false
      const doPrint = () => {
        if (printed) return
        printed = true
        w.focus()
        w.print()
      }
      // Gömülü font ve logo yüklenince yazdır; load gecikirse yine de aç
      w.addEventListener('load', doPrint)
      setTimeout(doPrint, 1500)
    } catch (err) {
      console.error(err)
      w.close()
      toast.error('Baskı hazırlanamadı.')
    } finally {
      setExporting(null)
    }
  }

  /** Seçili şablonu vektör SVG ya da 300 DPI JPEG olarak indirir; A4'te her sayfa ayrı dosya */
  const handleDownload = async (format: 'jpeg' | 'svg') => {
    const svgs = templatePages()
    if (!svgs.length) return
    setExporting(format)
    try {
      const table = !isSheet && activePrintTable && activePrintTable.id !== GENERAL_ID ? `-${fileSlug(activePrintTable.name)}` : ''
      const base = `${subdomain || 'qr'}-${TEMPLATE_FILE[selectedTemplate]}${table}`
      for (let i = 0; i < svgs.length; i++) {
        const text = await serializeQrSvg(svgs[i])
        const blob = format === 'svg' ? new Blob([text], { type: 'image/svg+xml' }) : await qrSvgToJpeg(text, svgs[i])
        const page = svgs.length > 1 ? `-sayfa-${i + 1}` : ''
        downloadBlob(blob, `${base}${page}.${format === 'svg' ? 'svg' : 'jpg'}`)
        // Art arda indirmeler tarayıcıda birbirini ezmesin
        if (i < svgs.length - 1) await new Promise((r) => setTimeout(r, 400))
      }
    } catch (err) {
      console.error(err)
      toast.error('Dosya oluşturulamadı.')
    } finally {
      setExporting(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Üst Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border shadow-sm">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground flex items-center">
            <QrCode className="mr-2 h-6 w-6 text-primary" /> QR Kodlar & Masa Standı Baskı Şablonları
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Masalarınıza özel QR kodlar oluşturabilir ve matbaaya/yazıcıya hazır profesyonel akrilik standlar yazdırabilirsiniz.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => handleOpenPrintModal(undefined, 'general_a4')}
            className="text-xs border-primary/40 text-primary hover:bg-primary/5 font-semibold"
          >
            <Layers className="h-4 w-4 mr-1.5 text-primary" /> A4 QR Baskısı
          </Button>
          <Button size="sm" onClick={() => setIsAddTableOpen(true)} disabled={!canEdit} className="text-xs bg-primary text-white">
            <Plus className="h-4 w-4 mr-1" /> Yeni Masa Ekle
          </Button>
        </div>
      </div>

      {/* Ana Genel Mekan QR Kartı */}
      <Card className="border-2 border-primary/20 shadow-sm overflow-hidden">
        <div className="p-5 flex flex-col lg:flex-row items-center justify-between gap-6">
          <div className="flex flex-col sm:flex-row items-center gap-4 min-w-0">
            <div className="keep-light bg-white p-3 border-2 border-gray-200 rounded-2xl shadow-xs shrink-0 flex items-center justify-center w-32 h-32">
              <QRCodeSVG 
                value={menuLink}
                size={112}
                level={qrLevel}
                    imageSettings={logoImage(112)}
                includeMargin={false}
              />
            </div>
            <div className="space-y-1.5 min-w-0 text-center sm:text-left">
              <span className="text-[11px] font-bold uppercase tracking-wider text-primary bg-primary/10 px-2.5 py-0.5 rounded-full">
                Genel Mekan QR Kodu
              </span>
              <h2 className="text-lg font-extrabold text-foreground">{currentRestaurant?.name}</h2>
              <p className="text-xs text-muted-foreground max-w-md">
                Sosyal medya bio'nuzda, broşürlerinizde veya restoran giriş kapısında kullanabileceğiniz genel dijital menü bağlantınızdır.
              </p>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <code className="text-[11px] bg-muted px-2.5 py-1 rounded border text-foreground font-mono break-all">
                  {menuLink}
                </code>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  className="h-7 text-xs" 
                  onClick={() => handleCopyLink(menuLink, 'general')}
                >
                  {copiedId === 'general' ? <Check className="h-3.5 w-3.5 text-green-600 mr-1" /> : <Copy className="h-3.5 w-3.5 mr-1" />}
                  {copiedId === 'general' ? 'Kopyalandı' : 'Kopyala'}
                </Button>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 w-full lg:w-auto sm:justify-center">
            <Button 
              size="sm" 
              variant="outline" 
              className="text-xs"
              onClick={() => handleOpenPrintModal({ id: GENERAL_ID, name: 'Giriş / Kapı QR', views: 0 }, 'acrylic')}
            >
              <Printer className="h-4 w-4 mr-1.5" /> Stand Olarak Yazdır
            </Button>
            <Button 
              size="sm" 
              asChild
              className="text-xs bg-gray-900 text-white hover:bg-gray-800"
            >
              <a href={`/menu/${subdomain}`} target="_blank" rel="noreferrer">
                <ExternalLink className="h-4 w-4 mr-1.5" /> Menüyü Görüntüle
              </a>
            </Button>
          </div>
        </div>
      </Card>

      {/* Masalar Tablosu */}
      <Card className="shadow-sm">
        <CardHeader className="py-3 px-4 bg-muted/40 border-b flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm font-bold text-foreground">Masaya Özel QR Kodlar & Görüntüleme</CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Masalarınız için ayrı QR kodlar; masa numarası ve Wi-Fi bilgisiyle profesyonel masa standı olarak yazdırabilirsiniz.
            </CardDescription>
          </div>
          <span className="text-xs font-bold text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
            {tables.length} Masa Kayıtlı
          </span>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="w-16 text-xs font-bold">Masa</TableHead>
                <TableHead className="text-xs font-bold">Masa Adı / Konum</TableHead>
                <TableHead className="hidden sm:table-cell text-xs font-bold">QR Önizleme</TableHead>
                <TableHead className="hidden sm:table-cell text-xs font-bold">Okunma Sayısı</TableHead>
                <TableHead className="text-right text-xs font-bold">Baskı & İşlemler</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadError && (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                    {loadError}{' '}
                    <button type="button" className="font-semibold text-primary hover:underline" onClick={loadTables}>
                      Tekrar dene
                    </button>
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && !loadError && tables.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                    Henüz masa yok.{' '}
                    <button type="button" className="font-semibold text-primary hover:underline" onClick={() => setIsAddTableOpen(true)}>
                      İlk masayı ekleyin
                    </button>
                  </TableCell>
                </TableRow>
              )}
              {tables.map((table, index) => {
                const tableUrl = getTableLink(table)
                return (
                  <TableRow key={table.id} className="hover:bg-accent/80">
                    <TableCell className="font-mono text-xs font-bold text-muted-foreground">
                      #{index + 1}
                    </TableCell>
                    <TableCell>
                      <span className="font-bold text-sm text-foreground">{table.name}</span>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <div className="flex items-center space-x-2">
                        <div className="keep-light bg-white w-9 h-9 rounded border p-0.5 flex items-center justify-center shrink-0">
                          <QRCodeSVG 
                            value={tableUrl}
                            size={32}
                            level="M"
                            includeMargin={false}
                          />
                        </div>
                        <button
                          onClick={() => handleCopyLink(tableUrl, table.id)}
                          className="text-[11px] text-muted-foreground hover:text-primary flex items-center font-mono"
                        >
                          {copiedId === table.id ? <Check className="h-3 w-3 mr-1 text-green-600" /> : <Copy className="h-3 w-3 mr-1" />}
                          {copiedId === table.id ? 'Kopyalandı' : 'Linki Al'}
                        </button>
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <span className="text-xs font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded">
                        {table.views} kez tarandı
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="h-7 text-xs border-primary/30 text-primary hover:bg-primary/5"
                          onClick={() => handleOpenPrintModal(table, 'acrylic')}
                        >
                          <Printer className="h-3.5 w-3.5 mr-1" /> Masa Standı Bas
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="h-7 text-xs text-muted-foreground"
                          onClick={() => handleOpenPrintModal(table, 'sticker')}
                        >
                          Sticker
                        </Button>
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="h-7 w-7 text-muted-foreground hover:text-red-600"
                          onClick={() => setDeleteTarget(table)}
                          disabled={!canEdit}
                          title="Masayı Sil"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* YENİ MASA EKLE MODALI */}
      <Dialog open={isAddTableOpen} onOpenChange={setIsAddTableOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Yeni Masa Ekle</DialogTitle>
            <DialogDescription>
              Masaya özel bir ad veya numara verin (Örn: Masa 12, Bahçe 3, Teras VIP).
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddTable} className="space-y-4 py-2">
            <div className="space-y-1">
              <Label htmlFor="t-name">Masa Adı / Numarası</Label>
              <Input
                id="t-name"
                placeholder="Örn: Masa 7 veya Bahçe 2"
                value={newTableName}
                onChange={(e) => setNewTableName(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="flex justify-end space-x-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setIsAddTableOpen(false)}>
                Vazgeç
              </Button>
              <Button type="submit" disabled={!canEdit}>
                Masayı Oluştur
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* BASKIYA HAZIR MASA STANDI & QR ŞABLON TASARIMCISI MODALI */}
      <Dialog open={isPrintModalOpen} onOpenChange={setIsPrintModalOpen}>
        <DialogContent className="sm:max-w-[800px] max-h-[92vh] overflow-y-auto flex flex-col p-6">
          <DialogHeader className="pb-3 border-b print:hidden">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-xl font-bold flex items-center">
                  <Printer className="h-5 w-5 mr-2 text-primary" />
                  Baskıya Hazır QR Şablonu
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Şablonu seçin; yazıcınızdan basın, PDF olarak kaydedin ya da JPEG veya SVG olarak indirin.
                </DialogDescription>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <Button variant="outline" onClick={() => handleDownload('jpeg')} disabled={printDisabled || !!exporting} className="text-xs h-8">
                  <Download className="h-3.5 w-3.5 mr-1" /> {exporting === 'jpeg' ? 'Hazırlanıyor…' : 'JPEG indir'}
                </Button>
                <Button variant="outline" onClick={() => handleDownload('svg')} disabled={printDisabled || !!exporting} className="text-xs h-8">
                  <Download className="h-3.5 w-3.5 mr-1" /> {exporting === 'svg' ? 'Hazırlanıyor…' : 'SVG indir'}
                </Button>
                <Button onClick={handlePrint} disabled={printDisabled || !!exporting} className="bg-primary text-white text-xs h-8">
                  <Printer className="h-3.5 w-3.5 mr-1" /> Yazdır / PDF olarak kaydet
                </Button>
              </div>
            </div>
          </DialogHeader>

          {/* Şablon Seçici Butonlar (Print sırasında gizlenir) */}
          <div className="flex flex-wrap gap-2 py-2 print:hidden">
            <button
              onClick={() => setSelectedTemplate('acrylic')}
              className={`disabled:opacity-40 disabled:cursor-not-allowed px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                selectedTemplate === 'acrylic' 
                  ? 'bg-primary text-white border-primary shadow-xs' 
                  : 'text-foreground hover:bg-accent border-border'
              }`}
            >
              Dikey Akrilik Masa Standı (10x15cm)
            </button>
            <button
              onClick={() => setSelectedTemplate('sticker')}
              className={`disabled:opacity-40 disabled:cursor-not-allowed px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                selectedTemplate === 'sticker' 
                  ? 'bg-primary text-white border-primary shadow-xs' 
                  : 'text-foreground hover:bg-accent border-border'
              }`}
            >
              Masa Çıkartması (Sticker)
            </button>
            {([
              ['general_a4', `A4 Genel QR Sayfası (${SHEET_SIZE} adet, 5x5 cm)`],
              ['tables_a4', 'A4 Masa Bazlı QR Sayfası'],
            ] as const).map(([id, label]) => (
              <button
                key={id}
                onClick={() => setSelectedTemplate(id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                  selectedTemplate === id
                    ? 'bg-primary text-white border-primary shadow-xs'
                    : 'text-foreground hover:bg-accent border-border'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* BASKI ALANI: şablonlar SVG; önizleme, yazdırma, JPEG ve SVG aynı çizimden çıkar */}
          {/* A4 sayfaları gerçek mm ölçüsünde çizilir; önizlemede küçültülür (kapsayıcı stili dışa aktarılmaz) */}
          <div
            ref={printAreaRef}
            className={`flex-1 flex justify-center ${isSheet ? 'items-start' : 'items-center'} py-4 bg-muted rounded-xl p-4 overflow-y-auto`}
            style={isSheet ? { zoom: 0.8 } : undefined}
          >
            {/* 1. DİKEY AKRİLİK STAND ŞABLONU */}
            {selectedTemplate === 'acrylic' && (
              <AcrylicTemplate
                restaurantName={currentRestaurant?.name || ''}
                link={printLink(activePrintTable)}
                color={primaryColor}
                qrLevel={qrLevel}
                logoImage={logoImage}
                className="rounded-2xl shadow-xl"
              />
            )}

            {/* 2. MASA STICKER ŞABLONU */}
            {selectedTemplate === 'sticker' && (
              <StickerTemplate
                restaurantName={currentRestaurant?.name || ''}
                link={printLink(activePrintTable)}
                color={primaryColor}
                qrLevel={qrLevel}
                logoImage={logoImage}
                className="rounded-3xl shadow-xl"
              />
            )}

            {/* 3. A4 GENEL QR SAYFASI: restoranın genel QR'ı, kesip her yerde kullanmak için */}
            {selectedTemplate === 'general_a4' && (
              <div className="flex flex-col items-center gap-4">
                <A4SheetPage
                  cards={Array.from({ length: SHEET_SIZE }, (_, i) => ({ key: String(i), link: menuLink, label: null }))}
                  restaurantName={currentRestaurant?.name || ''}
                  qrLevel={qrLevel}
                  logoImage={logoImage}
                  className="shadow-lg"
                />
              </div>
            )}

            {/* 4. A4 MASA BAZLI QR SAYFASI: her masaya kendi QR'ı (masa sayacı), 20 masada bir yeni sayfa */}
            {selectedTemplate === 'tables_a4' && (
              tables.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">Yazdırılacak masa yok. Önce masa ekleyin.</p>
              ) : (
                <div className="flex flex-col items-center gap-4">
                  {chunk(tables.map((t) => ({ key: t.id, link: getTableLink(t), label: t.name })), SHEET_SIZE).map((cards, i) => (
                    <A4SheetPage
                      key={i}
                      cards={cards}
                      restaurantName={currentRestaurant?.name || ''}
                      qrLevel={qrLevel}
                      logoImage={logoImage}
                      accentColor={primaryColor}
                      className="shadow-lg"
                    />
                  ))}
                </div>
              )
            )}
          </div>

          <div className="pt-3 border-t flex justify-end space-x-2 print:hidden">
            <Button variant="outline" size="sm" onClick={() => setIsPrintModalOpen(false)}>
              Kapat
            </Button>
            <Button size="sm" onClick={handlePrint} disabled={printDisabled || !!exporting} className="bg-primary text-white">
              <Printer className="h-3.5 w-3.5 mr-1" /> Yazdır
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* MASA SİLME ONAYI */}
      <Dialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>{deleteTarget?.name} silinsin mi?</DialogTitle>
            <DialogDescription>
              Masa listeden ve okunma sayısıyla birlikte silinir. Basılı QR kodu menüyü açmaya devam eder ama bu masa için sayılmaz.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Vazgeç
            </Button>
            <Button variant="destructive" onClick={() => deleteTarget && handleDeleteTable(deleteTarget)}>
              <Trash2 className="h-4 w-4 mr-1.5" /> Masayı sil
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
