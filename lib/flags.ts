const flagMap: Record<string, string> = {
  'czechia': '/flags/cz.png',
  'czech republic': '/flags/cz.png',
  'cze': '/flags/cz.png',
  'sweden': '/flags/se.png',
  'swe': '/flags/se.png',
  'canada': '/flags/ca.png',
  'can': '/flags/ca.png',
  'usa': '/flags/us.png',
  'united states': '/flags/us.png',
  'us': '/flags/us.png',
  'switzerland': '/flags/ch.png',
  'sui': '/flags/ch.png',
  'finland': '/flags/fi.png',
  'fin': '/flags/fi.png',
  'germany': '/flags/de.png',
  'ger': '/flags/de.png',
  'denmark': '/flags/dk.png',
  'den': '/flags/dk.png',
  'norway': '/flags/no.png',
  'nor': '/flags/no.png',
  'slovakia': '/flags/sk.png',
  'svk': '/flags/sk.png',
  'slovenia': '/flags/si.png',
  'slo': '/flags/si.png',
  'italy': '/flags/it.png',
  'ita': '/flags/it.png',
  'austria': '/flags/at.png',
  'aut': '/flags/at.png',
  'latvia': '/flags/lv.png',
  'lat': '/flags/lv.png',
  'hungary': '/flags/hu.png',
  'hun': '/flags/hu.png',
  'great britain': '/flags/gb.png',
  'gbr': '/flags/gb.png',
  'england': '/flags/gb.png',
  'russia': '/flags/ru.png',
  'rus': '/flags/ru.png',
  'poland': '/flags/pl.png',
  'pol': '/flags/pl.png',
  'france': '/flags/fr.png',
  'fra': '/flags/fr.png',
  'japan': '/flags/jp.png',
  'jpn': '/flags/jp.png',
  'kazakhstan': '/flags/kz.png',
  'kaz': '/flags/kz.png',
}

export function getFlag(teamName: string): string {
  const normalized = teamName.trim().toLowerCase()
  const flag = flagMap[normalized]
  if (flag) return flag
  for (const [key, value] of Object.entries(flagMap)) {
    if (normalized.includes(key)) return value
  }
  return '/flags/unknown.png'
}