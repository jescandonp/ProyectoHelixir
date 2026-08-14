import { toPng } from 'html-to-image'

/** Convierte el mismo DOM que se imprime en una imagen para WhatsApp.
 *  Se usa 3× de resolución para que se vea nítida en un celular. */
export async function descargarComoPng(elemento: HTMLElement, nombreArchivo: string) {
  const dataUrl = await toPng(elemento, {
    pixelRatio: 3,
    backgroundColor: '#ffffff',
    cacheBust: true,
  })

  const enlace = document.createElement('a')
  enlace.download = `${nombreArchivo}.png`
  enlace.href = dataUrl
  enlace.click()
}
