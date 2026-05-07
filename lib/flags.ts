const flagMap: Record<string, string> = {
  'czechia': '🇨🇿',
  'czech republic': '🇨🇿',
  'cze': '🇨🇿',
  'sweden': '🇸🇪',
  'swe': '🇸🇪',
  'canada': '🇨🇦',
  'can': '🇨🇦',
  'usa': '🇺🇸',
  'united states': '🇺🇸',
  'us': '🇺🇸',
  'switzerland': '🇨🇭',
  'sui': '🇨🇭',
  'finland': '🇫🇮',
  'fin': '🇫🇮',
  'germany': '🇩🇪',
  'ger': '🇩🇪',
  'denmark': '🇩🇰',
  'den': '🇩🇰',
  'norway': '🇳🇴',
  'nor': '🇳🇴',
  'slovakia': '🇸🇰',
  'svk': '🇸🇰',
  'slovenia': '🇸🇮',
  'slo': '🇸🇮',
  'italy': '🇮🇹',
  'ita': '🇮🇹',
  'austria': '🇦🇹',
  'aut': '🇦🇹',
  'latvia': '🇱🇻',
  'lat': '🇱🇻',
  'hungary': '🇭🇺',
  'hun': '🇭🇺',
  'great britain': '🇬🇧',
  'gbr': '🇬🇧',
  'england': '🇬🇧',
  'russia': '🇷🇺',
  'rus': '🇷🇺',
  'poland': '🇵🇱',
  'pol': '🇵🇱',
  'france': '🇫🇷',
  'fra': '🇫🇷',
  'japan': '🇯🇵',
  'jpn': '🇯🇵',
  'kazakhstan': '🇰🇿',
  'kaz': '🇰🇿',
}

export function getFlag(teamName: string): string {
  const normalized = teamName.trim().toLowerCase()
  const flag = flagMap[normalized]
  if (flag) return flag
  
  // Zkus najít částečnou shodu
  for (const [key, value] of Object.entries(flagMap)) {
    if (normalized.includes(key)) return value
  }
  
  return '🏳️'
}