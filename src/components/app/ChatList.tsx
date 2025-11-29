import type { KeyboardEvent } from "react"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card"
import type { Character, GroupChat } from "../../types/chat"
import type { SettingsState } from "../../types/settings"

type ChatListProps = {
  groupChats: GroupChat[]
  characters: Character[]
  layout: SettingsState["chatListStyle"]
  onSelectChat: (chatId: string) => void
}

const avatarClasses = "size-10 border-2 border-background bg-secondary text-sm transition-transform duration-150 hover:z-10 hover:scale-105"

export function ChatList({ groupChats, characters, layout, onSelectChat }: ChatListProps) {
  const isClassicLayout = layout === "classic"

  const renderCharacterCircles = (characterIds: string[]) =>
    characterIds.map((charId, index) => {
      const character = characters.find(c => c.id === charId)
      if (!character) return null

      return (
        <Avatar
          key={charId}
          title={character.name}
          className={cn(avatarClasses, index > 0 && "-ml-3")}
        >
          <AvatarImage src={character.pfp_base64} alt={`${character.name} avatar`} />
          <AvatarFallback className="text-xs font-medium uppercase text-foreground/80">
            {character.name.charAt(0)}
          </AvatarFallback>
        </Avatar>
      )
    })

  const handleCardKeyDown = (event: KeyboardEvent<HTMLDivElement>, chatId: string) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault()
      onSelectChat(chatId)
    }
  }

  if (groupChats.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-12">
        <p className="text-lg">No group chats. Add one from the menu, or import world data.</p>
      </div>
    )
  }

  return (
    <div
      className={cn(
        "mx-auto",
        isClassicLayout ? "flex max-w-3xl flex-col gap-4" : "grid max-w-6xl gap-6 md:grid-cols-2 lg:grid-cols-3"
      )}
    >
      {groupChats.map(chat => (
        <Card
          key={chat.id}
          role="button"
          tabIndex={0}
          aria-label={`Open chat: ${chat.name}`}
          onClick={() => onSelectChat(chat.id)}
          onKeyDown={event => handleCardKeyDown(event, chat.id)}
          className={cn(
            "cursor-pointer group-chat-card hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            isClassicLayout && "gap-4 px-6 py-5"
          )}
        >
          {isClassicLayout ? (
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <h3 className="text-lg font-semibold text-accent">{chat.name}</h3>
                <p className="text-sm leading-snug text-muted-foreground">{chat.description}</p>
              </div>
              <div className="flex items-center justify-start sm:justify-end">
                {renderCharacterCircles(chat.characterIds)}
              </div>
            </div>
          ) : (
            <>
              <CardHeader>
                <CardTitle className="text-lg">{chat.name}</CardTitle>
                <CardDescription>{chat.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center">
                  {renderCharacterCircles(chat.characterIds)}
                </div>
              </CardContent>
            </>
          )}
        </Card>
      ))}
    </div>
  )
}
