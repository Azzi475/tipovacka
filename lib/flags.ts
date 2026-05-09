// lib/flags.ts

export const teamFlags: Record<string, string> = {
  "Česko": "cz", "Czech Republic": "cz", "CZE": "cz",
  "Švédsko": "se", "Sweden": "se", "SWE": "se",
  "Kanada": "ca", "Canada": "ca", "CAN": "ca",
  "USA": "us", "United States": "us",
  "Švýcarsko": "ch", "Switzerland": "ch", "SUI": "ch",
  "Finsko": "fi", "Finland": "fi", "FIN": "fi",
  "Německo": "de", "Germany": "de", "GER": "de",
  "Dánsko": "dk", "Denmark": "dk", "DEN": "dk",
  "Norsko": "no", "Norway": "no", "NOR": "no",
  "Slovensko": "sk", "Slovakia": "sk", "SVK": "sk",
  "Slovinsko": "si", "Slovenia": "si", "SLO": "si",
  "Itálie": "it", "Italy": "it", "ITA": "it",
  "Rakousko": "at", "Austria": "at", "AUT": "at",
  "Lotyšsko": "lv", "Latvia": "lv", "LAT": "lv",
  "Maďarsko": "hu", "Hungary": "hu", "HUN": "hu",
  "Velká Británie": "gb", "Great Britain": "gb", "GBR": "gb",
  "Rusko": "ru", "Russia": "ru", "RUS": "ru",
  "Polsko": "pl", "Poland": "pl", "POL": "pl",
  "Francie": "fr", "France": "fr", "FRA": "fr",
  "Japonsko": "jp", "Japan": "jp", "JPN": "jp",
  "Kazachstán": "kz", "Kazakhstan": "kz", "KAZ": "kz",
}

// Původní funkce (pro zpětnou kompatibilitu)
export function getFlag(teamName: string): string {
  const code = teamFlags[teamName] || teamName.toLowerCase().slice(0, 2)
  return `/flags/${code}.webp` // nebo původní emoji logika
}

// NOVÉ: Pro Image komponentu
export function getFlagPath(teamName: string): string {
  const code = teamFlags[teamName] || teamName.toLowerCase().slice(0, 2)
  return `/flags/${code}.webp`
}

// NOVÉ: Pro fallback
export function getFlagCode(teamName: string): string {
  return teamFlags[teamName] || teamName.toLowerCase().slice(0, 2)
}