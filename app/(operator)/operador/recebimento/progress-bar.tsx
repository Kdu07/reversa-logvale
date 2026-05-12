interface ProgressBarProps {
  step: number
  total?: number
}

export function ProgressBar({ step, total = 7 }: ProgressBarProps) {
  return (
    <div className="space-y-1">
      <p className="text-sm text-muted-foreground text-right">
        Etapa <span className="font-medium text-foreground">{step}</span> de {total}
      </p>
      <div className="flex gap-1">
        {Array.from({ length: total }, (_, i) => (
          <div
            key={i}
            className={`flex-1 h-1.5 rounded-full transition-colors ${
              i + 1 <= step ? 'bg-primary' : 'bg-primary/20'
            }`}
          />
        ))}
      </div>
    </div>
  )
}
