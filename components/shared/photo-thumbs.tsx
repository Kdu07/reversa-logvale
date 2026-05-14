'use client'

interface PhotoThumbsProps {
  urls:        string[]
  onOpen:      (index: number) => void
  size?:       'sm' | 'md'
  maxVisible?: number
  emptyText?:  string | null
}

export function PhotoThumbs({
  urls,
  onOpen,
  size       = 'md',
  maxVisible,
  emptyText  = null,
}: PhotoThumbsProps) {
  if (urls.length === 0) {
    return emptyText
      ? <span className="text-xs text-muted-foreground">{emptyText}</span>
      : null
  }

  const dim      = size === 'sm' ? 'w-10 h-10' : 'w-14 h-14'
  const visible  = maxVisible !== undefined ? urls.slice(0, maxVisible) : urls
  const overflow = maxVisible !== undefined ? urls.length - maxVisible : 0

  return (
    <div className="flex gap-1 flex-wrap">
      {visible.map((url, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onOpen(i)}
          className={`${dim} rounded overflow-hidden border hover:ring-2 hover:ring-primary focus:outline-none`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={`foto ${i + 1}`} className="w-full h-full object-cover" />
        </button>
      ))}
      {overflow > 0 && (
        <button
          type="button"
          onClick={() => onOpen(0)}
          className={`${dim} rounded border bg-muted flex items-center justify-center text-xs text-muted-foreground hover:bg-muted/80`}
        >
          +{overflow}
        </button>
      )}
    </div>
  )
}
