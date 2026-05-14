import { createClient } from 'npm:@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

Deno.serve(async (_req) => {
  const cutoff = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString()

  // Busca fotos de devoluções processadas há mais de 1 ano
  const { data: photos, error } = await supabase
    .from('return_photos')
    .select('id, storage_path, photo_type, returns!inner(processed_at)')
    .eq('returns.status', 'processed')
    .lt('returns.processed_at', cutoff)
    .not('returns.processed_at', 'is', null)
    .limit(500)

  if (error) {
    console.error('[photo-cleanup] query error:', error.message)
    return json({ deleted: 0, error: error.message }, 500)
  }

  if (!photos || photos.length === 0) {
    console.log('[photo-cleanup] nothing to clean up')
    return json({ deleted: 0 })
  }

  // Separa paths por bucket
  const boxPaths:  string[] = []
  const itemPaths: string[] = []
  for (const p of photos) {
    if (p.photo_type === 'box') boxPaths.push(p.storage_path)
    else itemPaths.push(p.storage_path)
  }

  // Remove do Storage
  const storageErrors: string[] = []
  if (boxPaths.length > 0) {
    const { error: e } = await supabase.storage.from('box-photos').remove(boxPaths)
    if (e) storageErrors.push(`box-photos: ${e.message}`)
  }
  if (itemPaths.length > 0) {
    const { error: e } = await supabase.storage.from('item-photos').remove(itemPaths)
    if (e) storageErrors.push(`item-photos: ${e.message}`)
  }

  if (storageErrors.length > 0) {
    console.error('[photo-cleanup] storage errors:', storageErrors)
  }

  // Remove registros do DB
  const ids = photos.map((p) => p.id)
  const { error: dbErr } = await supabase.from('return_photos').delete().in('id', ids)
  if (dbErr) {
    console.error('[photo-cleanup] db delete error:', dbErr.message)
    return json({ deleted: 0, error: dbErr.message }, 500)
  }

  console.log(`[photo-cleanup] deleted ${photos.length} photos (box: ${boxPaths.length}, item: ${itemPaths.length})`)
  return json({ deleted: photos.length, box: boxPaths.length, item: itemPaths.length })
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
