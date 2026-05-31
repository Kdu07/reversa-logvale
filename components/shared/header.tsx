import type { AuthUser } from '@/types'
import { ptBR } from '@/lib/i18n/pt-BR'
import SignOutButton from './sign-out-button'
import { ReversaIcon } from './reversa-icon'

interface HeaderProps {
  user: AuthUser
}

export default function Header({ user }: HeaderProps) {
  return (
    <header className="h-14 bg-primary text-white flex items-center px-6 gap-4 shadow-md flex-shrink-0">
      <div className="flex items-center gap-2 flex-shrink-0">
        <div className="w-8 h-8 bg-white/20 rounded flex items-center justify-center">
          <ReversaIcon size={18} className="[&_path]:stroke-white" />
        </div>
        <span className="font-bold text-base tracking-wide hidden sm:block">
          LOG<span className="text-accent">VALE</span>
        </span>
      </div>

      <div className="flex-1" />

      <div className="flex items-center gap-3">
        <span className="text-sm text-white/80 hidden md:block truncate max-w-[200px]">
          {user.profile.full_name}
        </span>
        <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full text-white/70 flex-shrink-0">
          {ptBR.roles[user.profile.role]}
        </span>
        <SignOutButton />
      </div>
    </header>
  )
}
