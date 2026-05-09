const flagMap: Record<string, string> = {
  'czechia': '/flags/cz.webp',
  'czech republic': '/flags/cz.webp',
  'cze': '/flags/cz.webp',
  'sweden': '/flags/se.webp',
  'swe': '/flags/se.webp',
  'canada': '/flags/ca.webp',
  'can': '/flags/ca.webp',
  'usa': '/flags/us.webp',
  'united states': '/flags/us.webp',
  'us': '/flags/us.webp',
  'switzerland': '/flags/ch.webp',
  'sui': '/flags/ch.webp',
  'finland': '/flags/fi.webp',
  'fin': '/flags/fi.webp',
  'germany': '/flags/de.webp',
  'ger': '/flags/de.webp',
  'denmark': '/flags/dk.webp',
  'den': '/flags/dk.webp',
  'norway': '/flags/no.webp',
  'nor': '/flags/no.webp',
  'slovakia': '/flags/sk.webp',
  'svk': '/flags/sk.webp',
  'slovenia': '/flags/si.webp',
  'slo': '/flags/si.webp',
  'italy': '/flags/it.webp',
  'ita': '/flags/it.webp',
  'austria': '/flags/at.webp',
  'aut': '/flags/at.webp',
  'latvia': '/flags/lv.webp',
  'lat': '/flags/lv.webp',
  'hungary': '/flags/hu.webp',
  'hun': '/flags/hu.webp',
  'great britain': '/flags/gb.webp',
  'gbr': '/flags/gb.webp',
  'england': '/flags/gb.webp',
  'russia': '/flags/ru.webp',
  'rus': '/flags/ru.webp',
  'poland': '/flags/pl.webp',
  'pol': '/flags/pl.webp',
  'france': '/flags/fr.webp',
  'fra': '/flags/fr.webp',
  'japan': '/flags/jp.webp',
  'jpn': '/flags/jp.webp',
  'kazakhstan': '/flags/kz.webp',
  'kaz': '/flags/kz.webp',
}

export function getFlag(teamName: string): string {
  const normalized = teamName.trim().toLowerCase()
  const flag = flagMap[normalized]
  if (flag) return flag
  for (const [key, value] of Object.entries(flagMap)) {
    if (normalized.includes(key)) return value
  }
  return ''
}