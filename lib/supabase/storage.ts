import type { createClient } from '@/lib/supabase/server'

export async function buildSignedUrlMap(
  supabase: ReturnType<typeof createClient>,
  bucket:   string,
  paths:    string[],
): Promise<Map<string, string>> {
  if (paths.length === 0) return new Map()
  const { data } = await supabase.storage.from(bucket).createSignedUrls(paths, 3600)
  const map = new Map<string, string>()
  data?.forEach((entry) => {
    if (entry.path && entry.signedUrl) map.set(entry.path, entry.signedUrl)
  })
  return map
}
