interface ProgressBarProps {
  step: number
  total?: number
}

export function ProgressBar({ step, total = 7 }: ProgressBarProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Progresso</p>
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{step}</span> / {total}
        </p>
      </div>
      <div className="flex gap-1">
        {Array.from({ length: total }, (_, i) => (
          <div
            key={i}
            className={`flex-1 h-1.5 rounded-full transition-all duration-300 ease-quint ${
              i + 1 < step
                ? 'bg-primary'
                : i + 1 === step
                  ? 'bg-primary/70'
                  : 'bg-muted'
            }`}
          />
        ))}
      </div>
    </div>
  )
}
