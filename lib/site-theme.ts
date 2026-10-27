// Sistem koyu temadaysa sayfa ilk boyamadan önce koyu açılır (hidrasyondan sonra beyaz→siyah flaşı olmaz)
export const SITE_THEME_SCRIPT =
  "try{if(matchMedia('(prefers-color-scheme: dark)').matches)document.documentElement.classList.add('dark')}catch(e){}"
