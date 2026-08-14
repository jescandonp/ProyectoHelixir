const UNIDADES = [
  '', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve',
  'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete',
  'dieciocho', 'diecinueve', 'veinte', 'veintiuno', 'veintidós', 'veintitrés',
  'veinticuatro', 'veinticinco', 'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve',
]

const DECENAS = [
  '', '', 'veinte', 'treinta', 'cuarenta', 'cincuenta',
  'sesenta', 'setenta', 'ochenta', 'noventa',
]

const CENTENAS = [
  '', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos',
  'seiscientos', 'setecientos', 'ochocientos', 'novecientos',
]

function menorQueCien(n: number): string {
  if (n < 30) return UNIDADES[n]
  const decena = Math.floor(n / 10)
  const unidad = n % 10
  return unidad === 0 ? DECENAS[decena] : `${DECENAS[decena]} y ${UNIDADES[unidad]}`
}

function menorQueMil(n: number): string {
  if (n === 100) return 'cien'
  const centena = Math.floor(n / 100)
  const resto = n % 100
  if (centena === 0) return menorQueCien(resto)
  if (resto === 0) return CENTENAS[centena]
  return `${CENTENAS[centena]} ${menorQueCien(resto)}`
}

/** "veintiuno" → "veintiún", "treinta y uno" → "treinta y un", "uno" → "un" */
function apocopar(texto: string): string {
  if (texto.endsWith('veintiuno')) return texto.replace(/veintiuno$/, 'veintiún')
  return texto.replace(/uno$/, 'un')
}

export function numeroALetras(n: number): string {
  if (!Number.isInteger(n)) throw new Error(`numeroALetras espera un entero, recibió ${n}`)
  if (n < 0) throw new Error(`numeroALetras no acepta negativos, recibió ${n}`)
  if (n === 0) return 'cero'

  const millones = Math.floor(n / 1_000_000)
  const miles = Math.floor((n % 1_000_000) / 1000)
  const unidades = n % 1000

  const partes: string[] = []

  if (millones === 1) {
    partes.push('un millón')
  } else if (millones > 1) {
    partes.push(`${apocopar(menorQueMil(millones))} millones`)
  }

  if (miles === 1) {
    partes.push('mil')
  } else if (miles > 1) {
    partes.push(`${apocopar(menorQueMil(miles))} mil`)
  }

  if (unidades > 0) partes.push(menorQueMil(unidades))

  return partes.join(' ')
}

export function valorEnLetras(n: number): string {
  const texto = numeroALetras(n)
  return `${texto.charAt(0).toUpperCase()}${texto.slice(1)} M/cte`
}
