import { useRef, useEffect, useState } from 'react'
import { ArrowLeft, Send, Clapperboard, RotateCcw, AlertTriangle, Loader2, Check } from 'lucide-react'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { Textarea } from '../ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog'
import type { Character, ChatMessage, GroupChat } from '../../types/chat'

type ChatViewProps = {
  chat: GroupChat | undefined
  characters: Character[]
  messages: ChatMessage[]
  selectedCharId: string | undefined
  message: string
  summarizationStatus: 'idle' | 'summarizing' | 'success'
  onBack: () => void
  onSelectedCharChange: (value: string) => void
  onMessageChange: (value: string) => void
  onSend: () => void
  onRetry?: (messageId: string) => void
}

export function ChatView({
  chat,
  characters,
  messages,
  selectedCharId,
  message,
  summarizationStatus,
  onBack,
  onSelectedCharChange,
  onMessageChange,
  onSend,
  onRetry
}: ChatViewProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [retryMessageId, setRetryMessageId] = useState<string | null>(null)

  // Calculate how many messages will be deleted
  const messagesToDelete = retryMessageId 
    ? messages.length - messages.findIndex(m => m.id === retryMessageId)
    : 0

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Auto-resize textarea as user types
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`
    }
  }, [message])

  const handleConfirmRetry = () => {
    if (retryMessageId && onRetry) {
      onRetry(retryMessageId)
    }
    setRetryMessageId(null)
  }

  return (
    <>
      <Dialog open={retryMessageId !== null} onOpenChange={(open) => !open && setRetryMessageId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Retry Message?
            </DialogTitle>
            <DialogDescription>
              This will delete <strong>{messagesToDelete} message{messagesToDelete !== 1 ? 's' : ''}</strong> (this message and everything after it) and regenerate the response. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRetryMessageId(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleConfirmRetry}>
              Delete & Retry
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex flex-col h-full max-w-4xl mx-auto">
      <div className="flex items-center gap-3 p-4 border-b bg-card">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h2 className="font-semibold text-lg">{chat?.name}</h2>
          <p className="text-sm text-muted-foreground">{chat?.description}</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {chat?.exposition && chat.exposition.length > 0 && (
          <div className="space-y-2">
            {chat.exposition.map((text, idx) => (
              <div key={`exposition-${idx}`} className="text-center py-2">
                <Badge variant="secondary" className="text-xs">
                  Narrator
                </Badge>
                <p className="text-sm text-muted-foreground italic mt-1">{text}</p>
              </div>
            ))}
          </div>
        )}
        {messages.map((msg) => {
          const character = msg.charId ? characters.find(c => c.id === msg.charId) : undefined

          // Loading state
          if (msg.type === 'loading') {
            return (
              <div key={msg.id} className="flex gap-3">
                {character && (
                  <Avatar className="w-10 h-10 mt-1 flex-shrink-0">
                    <AvatarImage src={character.pfp_base64} />
                    <AvatarFallback>{character.name[0]}</AvatarFallback>
                  </Avatar>
                )}
                <div className="rounded-lg p-3 bg-muted animate-pulse">
                  <p className="text-xs font-medium mb-1 opacity-70">{msg.sender}</p>
                  <p className="text-sm">Thinking...</p>
                </div>
              </div>
            )
          }

          if (msg.type === 'exposition' || msg.type === 'narration' || msg.type === 'director' || msg.type === 'summary') {
            const isNarrator = msg.type === 'narration'
            const isDirector = msg.type === 'director'
            const isSummary = msg.type === 'summary'
            
            return (
              <div key={msg.id} className={`text-center py-2 px-4 mx-auto max-w-[90%] rounded-md ${
                isSummary ? 'bg-muted/50 border border-dashed border-muted-foreground/40' :
                isNarrator ? 'bg-accent/10 border border-accent' : 
                isDirector ? 'border border-muted-foreground/30 bg-transparent' : 
                'border border-dashed border-border'
              }`}>
                <Badge variant="secondary" className={`text-xs ${
                  isSummary ? 'bg-muted-foreground/30' :
                  isDirector ? 'bg-muted-foreground/20' : ''
                }`}>
                  {isSummary ? '📜 Previous Context' : msg.sender}
                </Badge>
                <p className={`text-sm text-muted-foreground mt-1 whitespace-pre-wrap ${isSummary ? 'text-left' : 'italic'}`}>{msg.text}</p>
              </div>
            )
          }

          return (
            <div key={msg.id} className={`flex gap-3 max-w-[85%] group relative ${msg.type === 'user' ? 'ml-auto flex-row-reverse' : ''}`}>
              {msg.type === 'character' && character && (
                <Avatar className="w-10 h-10 mt-1 flex-shrink-0">
                  <AvatarImage src={character.pfp_base64} />
                  <AvatarFallback>{character.name[0]}</AvatarFallback>
                </Avatar>
              )}
              <div className={`rounded-lg p-3 relative ${msg.type === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                <p className="text-xs font-medium mb-1 opacity-70">{msg.sender}</p>
                <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                {msg.type === 'character' && onRetry && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute -top-2 -right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity bg-background border shadow-sm"
                    onClick={() => setRetryMessageId(msg.id)}
                    title="Retry this message"
                  >
                    <RotateCcw className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
          )
        })}
        
        {summarizationStatus === 'summarizing' && (
          <div className="flex flex-col items-center justify-center py-4 text-muted-foreground animate-in fade-in slide-in-from-bottom-2">
            <p className="text-sm font-medium mb-2">Summarizing the conversation...</p>
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        )}
        
        {summarizationStatus === 'success' && (
          <div className="flex flex-col items-center justify-center py-4 text-green-600 dark:text-green-400 animate-in fade-in slide-in-from-bottom-2">
            <p className="text-sm font-medium mb-2">Summarized the conversation!</p>
            <Check className="h-6 w-6" />
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="flex items-center gap-3 p-4 border-t bg-card">
        <Select value={selectedCharId} onValueChange={onSelectedCharChange}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Pick Character" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">You</SelectItem>
            <SelectItem value="director">
              <span className="flex items-center gap-2">
                <Clapperboard className="h-4 w-4" />
                Director
              </span>
            </SelectItem>
            {chat?.characterIds.map(charId => {
              const char = characters.find(c => c.id === charId)
              return char ? (
                <SelectItem key={char.id} value={char.id}>{char.name}</SelectItem>
              ) : null
            })}
          </SelectContent>
        </Select>
        <Textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => onMessageChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              onSend()
            }
          }}
          placeholder="Type your message..."
          className="min-h-10 max-h-[200px] resize-none overflow-y-auto"
          rows={1}
        />
        <Button size="icon" onClick={onSend}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
    </>
  )
}
