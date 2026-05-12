interface LogvaleLogoProps {
  subtitle?: string
}

export default function LogvaleLogo({ subtitle }: LogvaleLogoProps) {
  return (
    <div className="text-center mb-8">
      <div className="inline-flex items-center justify-center w-16 h-16 bg-primary rounded-xl mb-4">
        <span className="text-white font-bold text-2xl">L</span>
      </div>
      <h1 className="text-2xl font-bold text-primary">
        LOG<span className="text-accent">VALE</span>
      </h1>
      {subtitle && <p className="text-muted-foreground mt-1 text-sm">{subtitle}</p>}
    </div>
  )
}
