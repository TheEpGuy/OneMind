import { Menu } from 'lucide-react'
import { Button } from '../ui/button'

type AppHeaderProps = {
  onMenuToggle: () => void
}

export function AppHeader({ onMenuToggle }: AppHeaderProps) {
  return (
    <header className="flex items-center gap-4 p-4 border-b bg-card">
      <Button variant="ghost" size="icon" onClick={onMenuToggle}>
        <Menu className="h-5 w-5" />
      </Button>
      <h1 className="text-xl font-bold">OneMind</h1>
    </header>
  )
}
