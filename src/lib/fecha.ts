/** Zona fija del negocio. No se usa la del servidor: en Vercel es UTC, y
 *  el recibo diría una hora en el papel y otra en la imagen de WhatsApp. */
const ZONA = 'America/Bogota'

/** Solo se leen las partes numéricas. Los separadores del idioma nunca
 *  entran al resultado: `toLocaleString` pone U+00A0 en Node y un espacio
 *  normal en Chrome, y esa diferencia invisible rompe la hidratación. */
const EN_BOGOTA = new Intl.DateTimeFormat('en-CA', {
  timeZone: ZONA,
  year: '2-digit', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit',
  hourCycle: 'h23',
})

export function formatearFechaCo(iso: string): string {
  const partes = Object.fromEntries(
    EN_BOGOTA.formatToParts(new Date(iso)).map((p) => [p.type, p.value]),
  ) as Record<string, string>

  const hora24 = Number(partes.hour)
  const meridiano = hora24 < 12 ? 'a. m.' : 'p. m.'
  const hora12 = hora24 % 12 === 0 ? 12 : hora24 % 12

  return `${partes.day}/${partes.month}/${partes.year}, ${hora12}:${partes.minute} ${meridiano}`
}
