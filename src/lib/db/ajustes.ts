'use server'

import { crearClienteServidor } from './cliente-supabase'

export interface Ajustes {
  nombreNegocio: string
  eslogan: string
  logoUrl: string | null
  telefonos: string
  datosPago: string
  prefijoConsecutivo: string
  valorDomicilioDefault: number
  etiquetaAnchoMm: number
  etiquetaAltoMm: number
  pieRecibo: string
}

export async function obtenerAjustes(): Promise<Ajustes> {
  const supabase = await crearClienteServidor()
  const { data, error } = await supabase.from('ajustes').select('*').eq('id', true).single()
  if (error) throw new Error(`No se pudieron leer los ajustes: ${error.message}`)

  return {
    nombreNegocio: data.nombre_negocio,
    eslogan: data.eslogan,
    logoUrl: data.logo_url,
    telefonos: data.telefonos,
    datosPago: data.datos_pago,
    prefijoConsecutivo: data.prefijo_consecutivo,
    valorDomicilioDefault: data.valor_domicilio_default,
    etiquetaAnchoMm: data.etiqueta_ancho_mm,
    etiquetaAltoMm: data.etiqueta_alto_mm,
    pieRecibo: data.pie_recibo,
  }
}

export async function guardarAjustes(ajustes: Ajustes): Promise<void> {
  const supabase = await crearClienteServidor()
  const { error } = await supabase
    .from('ajustes')
    .update({
      nombre_negocio: ajustes.nombreNegocio,
      eslogan: ajustes.eslogan,
      logo_url: ajustes.logoUrl,
      telefonos: ajustes.telefonos,
      datos_pago: ajustes.datosPago,
      prefijo_consecutivo: ajustes.prefijoConsecutivo,
      valor_domicilio_default: ajustes.valorDomicilioDefault,
      etiqueta_ancho_mm: ajustes.etiquetaAnchoMm,
      etiqueta_alto_mm: ajustes.etiquetaAltoMm,
      pie_recibo: ajustes.pieRecibo,
    })
    .eq('id', true)

  if (error) throw new Error(`No se pudieron guardar los ajustes: ${error.message}`)
}
