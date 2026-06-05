export const teamFlags: Record<string, string> = {
  "Česko": "cz", "Czech Republic": "cz", "CZE": "cz", "Czechia": "cz",
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
  "Alžírsko": "dz", "Algeria": "dz", "ALG": "dz",
  "Argentýna": "ar", "Argentina": "ar", "ARG": "ar",
  "Austrálie": "au", "Australia": "au", "AUS": "au",
  "Belgie": "be", "Belgium": "be", "BEL": "be",
  "Bosna a Hercegovina": "ba", "Bosnia and Herzegovina": "ba", "BIH": "ba",
  "Brazílie": "br", "Brazil": "br", "BRA": "br",
  "Kapverdy": "cv", "Cabo Verde": "cv", "CPV": "cv",
  "Kolumbie": "co", "Colombia": "co", "COL": "co",
  "Demokratická republika Kongo": "cd", "Democratic Republic of the Congo": "cd", "COD": "cd",
  "Chorvatsko": "hr", "Croatia": "hr", "CRO": "hr",
  "Curacao": "cw", "Curaçao": "cw", "CUW": "cw",
  "Pobřeží slonoviny": "ci", "Côte d'Ivoire": "ci", "CIV": "ci",
  "Ekvádor": "ec", "Ecuador": "ec", "ECU": "ec",
  "Egypt": "eg", "EGY": "eg",
  "Anglie": "gb-eng", "England": "gb-eng", "ENG": "gb-eng",
  "Ghana": "gh", "GHA": "gh",
  "Haiti": "ht", "HTI": "ht",
  "Írán": "ir", "Iran": "ir", "IRN": "ir",
  "Irák": "iq", "Iraq": "iq", "IRQ": "iq",
  "Jordánsko": "jo", "Jordan": "jo", "JOR": "jo",
  "Korejská republika": "kr", "Korea Republic": "kr", "KOR": "kr",
  "Mexiko": "mx", "Mexico": "mx", "MEX": "mx",
  "Maroko": "ma", "Morocco": "ma", "MAR": "ma",
  "Nizozemsko": "nl", "Netherlands": "nl", "NED": "nl",
  "Nový Zéland": "nz", "New Zealand": "nz", "NZL": "nz",
  "Panama": "pa", "PAN": "pa",
  "Paraguay": "py", "PAR": "py",
  "Portugalsko": "pt", "Portugal": "pt", "POR": "pt",
  "Qatar": "qa", "QAT": "qa",
  "Saudská Arábie": "sa", "Saudi Arabia": "sa", "KSA": "sa",
  "Skotsko": "gb-sct", "Scotland": "gb-sct", "SCO": "gb-sct",
  "Senegal": "sn", "SEN": "sn",
  "Jižní Afrika": "za", "South Africa": "za", "RSA": "za",
  "Španělsko": "es", "Spain": "es", "ESP": "es",
  "Tunisko": "tn", "Tunisia": "tn", "TUN": "tn",
  "Turecko": "tr", "Türkiye": "tr", "TUR": "tr",
  "Uruguay": "uy", "URU": "uy",
  "Uzbekistán": "uz", "Uzbekistan": "uz", "UZB": "uz",
}

export function getFlagPath(teamName: string): string {
  const code = teamFlags[teamName] || teamName.toLowerCase().slice(0, 2)
  return `/flags/${code}.webp`
}

export function getFlagCode(teamName: string): string {
  return teamFlags[teamName] || teamName.toLowerCase().slice(0, 2)
}

export function getFlag(teamName: string): string {
  return getFlagPath(teamName)
}