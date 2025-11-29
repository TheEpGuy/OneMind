import { useRef, useState, type Dispatch, type MouseEvent, type SetStateAction } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, ChevronRight, X, Loader2 } from 'lucide-react'
import { Button } from '../ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible'
import { Label } from '../ui/label'
import { Input } from '../ui/input'
import { Textarea } from '../ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar'
import { Badge } from '../ui/badge'
import { Switch } from '../ui/switch'
import type { Character, GroupChat, ChatMessage } from '../../types/chat'
import type { SettingsState, AIProvider, ProviderSettings } from '../../types/settings'
import { exportWorldData, importWorldData, exportChatHistory, importChatHistory, downloadJSON, uploadJSON } from '../../lib/worldData'
import { generateWorld, type WorldBuilderLogEntry } from '../../lib/worldBuilder'

type TabValue = 'chats' | 'characters' | 'profile' | 'settings' | 'world'

// Default settings for each provider
const DEFAULT_PROVIDER_SETTINGS: Record<AIProvider, ProviderSettings> = {
  openai: { apiKey: '', model: '', summarizationModel: '', worldbuilderModel: '', temperature: 0.7, topK: 40, topP: 0.9 },
  anthropic: { apiKey: '', model: '', summarizationModel: '', worldbuilderModel: '', temperature: 0.7, topK: 40, topP: 0.9 },
  google: { apiKey: '', model: '', summarizationModel: '', worldbuilderModel: '', temperature: 0.7, topK: 40, topP: 0.9 },
  together: { apiKey: '', model: '', summarizationModel: '', worldbuilderModel: '', temperature: 0.7, topK: 40, topP: 0.9 },
  openrouter: { apiKey: '', model: '', summarizationModel: '', worldbuilderModel: '', temperature: 0.7, topK: 40, topP: 0.9 },
  xai: { apiKey: '', model: '', summarizationModel: '', worldbuilderModel: '', temperature: 0.7, topK: 40, topP: 0.9 }
}

type MenuDrawerProps = {
  isOpen: boolean
  onClose: () => void
  characters: Character[]
  groupChats: GroupChat[]
  messages: Record<string, ChatMessage[]>
  settings: SettingsState
  onSettingsChange: Dispatch<SetStateAction<SettingsState>>
  onCreateCharacter: (char: Omit<Character, 'id'>) => string
  onUpdateCharacter: (id: string, updates: Partial<Character>) => void
  onDeleteCharacter: (id: string) => void
  onCreateGroupChat: (chat: Omit<GroupChat, 'id'>) => string
  onUpdateGroupChat: (id: string, updates: Partial<GroupChat>) => void
  onDeleteGroupChat: (id: string) => void
  onRemoveCharacterFromChat: (chatId: string, charId: string) => void
  onImportWorld: (chars: Character[], chats: GroupChat[]) => void
  onExportWorld: () => { characters: Character[]; groupChats: GroupChat[] }
  onImportMessages: (messages: Record<string, ChatMessage[]>) => void
}

type CharacterFormState = {
  name: string
  description: string
  groupChatId: string
  quotes: string
  knownCharacterIds: string[]
  pfp: File | null
}

type ChatFormState = {
  name: string
  description: string
  exposition: string
}

export function MenuDrawer({
  isOpen,
  onClose,
  characters,
  groupChats,
  messages,
  settings,
  onSettingsChange,
  onCreateCharacter,
  onUpdateCharacter,
  onDeleteCharacter,
  onCreateGroupChat,
  onUpdateGroupChat,
  onDeleteGroupChat,
  // onRemoveCharacterFromChat,
  onImportWorld,
  onExportWorld,
  onImportMessages
}: MenuDrawerProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [startX, setStartX] = useState(0)
  const [scrollLeft, setScrollLeft] = useState(0)
  const [isChatFormOpen, setIsChatFormOpen] = useState(false)
  const [isCharacterFormOpen, setIsCharacterFormOpen] = useState(false)
  const [isModelSettingsOpen, setIsModelSettingsOpen] = useState(false)
  const [expandedCharacters, setExpandedCharacters] = useState<Set<string>>(new Set())
  const [expandedChats, setExpandedChats] = useState<Set<string>>(new Set())
  const [currentTab, setCurrentTab] = useState<TabValue>('chats')
  const [newCharacterForm, setNewCharacterForm] = useState<CharacterFormState>({
    name: '',
    description: '',
    groupChatId: '',
    quotes: '',
    knownCharacterIds: [],
    pfp: null
  })
  const [newChatForm, setNewChatForm] = useState<ChatFormState>({
    name: '',
    description: '',
    exposition: ''
  })
  const [editForms, setEditForms] = useState<{
    [key: string]: {
      name?: string
      description?: string
      exposition?: string
      groupChatId?: string
      quotes?: string
      knownCharacterIds?: string
    }
  }>({})
  
  // World builder state
  const [worldBuilderInput, setWorldBuilderInput] = useState('')
  const [worldBuilderInProgress, setWorldBuilderInProgress] = useState(false)
  const [worldBuilderLogs, setWorldBuilderLogs] = useState<WorldBuilderLogEntry[]>([])

  const handleMouseDown = (e: MouseEvent<HTMLDivElement>) => {
    if (!scrollRef.current) return
    setIsDragging(true)
    setStartX(e.pageX - scrollRef.current.offsetLeft)
    setScrollLeft(scrollRef.current.scrollLeft)
  }

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!isDragging || !scrollRef.current) return
    e.preventDefault()
    const x = e.pageX - scrollRef.current.offsetLeft
    const walk = (x - startX) * 2
    scrollRef.current.scrollLeft = scrollLeft - walk
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const toggleCharacterExpansion = (charId: string) => {
    setExpandedCharacters(prev => {
      const next = new Set(prev)
      if (next.has(charId)) {
        next.delete(charId)
      } else {
        next.add(charId)
      }
      return next
    })
  }

  const toggleChatExpansion = (chatId: string) => {
    setExpandedChats(prev => {
      const next = new Set(prev)
      if (next.has(chatId)) {
        next.delete(chatId)
      } else {
        next.add(chatId)
      }
      return next
    })
  }

  const handleCreateCharacter = async () => {
    if (!newCharacterForm.name || !newCharacterForm.description) return

    let pfp_base64: string | undefined
    if (newCharacterForm.pfp) {
      pfp_base64 = await fileToBase64(newCharacterForm.pfp)
    }

    onCreateCharacter({
      name: newCharacterForm.name,
      description: newCharacterForm.description,
      groupChatId: newCharacterForm.groupChatId,
      notes: [],
      quotes: newCharacterForm.quotes.split('\n').filter(Boolean),
      knownCharacterIds: newCharacterForm.knownCharacterIds,
      pfp_base64
    })

    setNewCharacterForm({
      name: '',
      description: '',
      groupChatId: '',
      quotes: '',
      knownCharacterIds: [],
      pfp: null
    })
    setIsCharacterFormOpen(false)
  }

  const handleCreateGroupChat = () => {
    if (!newChatForm.name || !newChatForm.description) return

    onCreateGroupChat({
      name: newChatForm.name,
      description: newChatForm.description,
      characterIds: [],
      exposition: newChatForm.exposition.split('\n').filter(Boolean)
    })

    setNewChatForm({
      name: '',
      description: '',
      exposition: ''
    })
    setIsChatFormOpen(false)
  }

  const handleExportWorld = () => {
    const worldState = onExportWorld()
    const worldData = exportWorldData(worldState.characters, worldState.groupChats)
    downloadJSON('world-data.json', worldData)
  }

  const handleImportWorld = async () => {
    try {
      const data = await uploadJSON()
      const { characters: newChars, groupChats: newChats } = importWorldData(data)
      onImportWorld(newChars, newChats)
    } catch (err) {
      console.error('Failed to import world:', err)
    }
  }

  const handleExportChatHistory = () => {
    const historyData = exportChatHistory(messages, groupChats)
    downloadJSON('chat-history.json', historyData)
  }

  const handleImportChatHistory = async () => {
    try {
      const data = await uploadJSON()
      if (data.version !== 1 || !data.messages) {
        console.error('Invalid chat history format')
        return
      }
      const importedMessages = importChatHistory(data, groupChats)
      onImportMessages(importedMessages)
    } catch (err) {
      console.error('Failed to import chat history:', err)
    }
  }

  const handleGenerateWorld = async () => {
    const inputText = worldBuilderInput.trim()
    if (!inputText) {
      setWorldBuilderLogs([{ key: 'error', message: '⚠️ Please enter a world description.', type: 'warning' }])
      return
    }

    if (!settings.apiKey) {
      setWorldBuilderLogs([{ key: 'error', message: '🔑 Please set an API key in Settings first.', type: 'error' }])
      return
    }

    setWorldBuilderInProgress(true)
    setWorldBuilderLogs([])

    try {
      const result = await generateWorld(inputText, settings, (logs) => {
        setWorldBuilderLogs([...logs])
      })

      if (result.success && (result.characters.length > 0 || result.groupChats.length > 0)) {
        onImportWorld(result.characters, result.groupChats)
        setWorldBuilderInput('') // Clear input on success
      }
    } catch (err) {
      console.error('World generation failed:', err)
      setWorldBuilderLogs(prev => [...prev, {
        key: 'fatal',
        message: `🛑 Fatal error: ${err instanceof Error ? err.message : 'Unknown error'}`,
        type: 'error'
      }])
    } finally {
      setWorldBuilderInProgress(false)
    }
  }

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = () => {
        const result = reader.result as string
        resolve(result)
      }
      reader.onerror = (error) => reject(error)
    })
  }

  const handleSaveCharacter = (charId: string) => {
    const form = editForms[charId]
    if (!form) return

    const updates: Partial<Character> = {}
    if (form.name) updates.name = form.name
    if (form.description) updates.description = form.description
    if (form.groupChatId) updates.groupChatId = form.groupChatId
    if (form.quotes) updates.quotes = form.quotes.split('\n').filter(Boolean)
    if (form.knownCharacterIds) updates.knownCharacterIds = JSON.parse(form.knownCharacterIds)

    onUpdateCharacter(charId, updates)
    setEditForms(prev => {
      const next = { ...prev }
      delete next[charId]
      return next
    })
  }

  const handleSaveGroupChat = (chatId: string) => {
    const form = editForms[chatId]
    if (!form) return

    const updates: Partial<GroupChat> = {}
    if (form.name) updates.name = form.name
    if (form.description) updates.description = form.description
    if (form.exposition) updates.exposition = form.exposition.split('\n').filter(Boolean)

    onUpdateGroupChat(chatId, updates)
    setEditForms(prev => {
      const next = { ...prev }
      delete next[chatId]
      return next
    })
  }

  const updateEditForm = (id: string, field: string, value: string) => {
    setEditForms(prev => ({
      ...prev,
      [id]: { ...(prev[id] || {}), [field]: value }
    }))
  }

  const handleCharacterNameClick = (charId: string) => {
    setCurrentTab('characters')
    setExpandedCharacters(prev => {
      const next = new Set(prev)
      next.add(charId)
      return next
    })
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 bg-black/50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
        >
          <motion.div
            className="fixed left-0 top-0 h-full w-full max-w-sm bg-card border-r sm:w-96"
            initial={{ x: -384 }}
            animate={{ x: 0 }}
            exit={{ x: -384 }}
            transition={{ duration: 0.25, ease: 'linear' }}
            onClick={e => e.stopPropagation()}
          >
            <Tabs value={currentTab} onValueChange={(value) => setCurrentTab(value as TabValue)} className="h-full flex flex-col">
              <div className="flex items-center justify-between p-4 border-b">
                <div
                  ref={scrollRef}
                  className="relative flex-1 overflow-x-auto flex items-center no-scrollbar drag-scroll"
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                >
                  <TabsList className="inline-flex">
                    <TabsTrigger value="chats">Chats</TabsTrigger>
                    <TabsTrigger value="characters">Characters</TabsTrigger>
                    <TabsTrigger value="profile">Profile</TabsTrigger>
                    <TabsTrigger value="settings">Settings</TabsTrigger>
                    <TabsTrigger value="world">World</TabsTrigger>
                  </TabsList>
                </div>
                <Button variant="ghost" size="icon" onClick={onClose} className="ml-2 flex-shrink-0">
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex-1 overflow-y-auto p-4">
                <TabsContent value="chats" className="mt-0">
                  <h3 className="text-lg font-semibold mb-4">Group Chats</h3>

                  <Collapsible open={isChatFormOpen} onOpenChange={setIsChatFormOpen}>
                    <CollapsibleTrigger asChild>
                      <Button variant="outline" className="w-full justify-between mb-4">
                        Add New Group Chat
                        {isChatFormOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mb-4">
                      <div className="p-4 rounded-lg border border-dashed border-primary/40 bg-card/60 space-y-4 shadow-sm">
                        <div>
                          <Label htmlFor="chat-name" className="text-sm font-medium">Name</Label>
                          <Input
                            id="chat-name"
                            value={newChatForm.name}
                            onChange={(e) => setNewChatForm({ ...newChatForm, name: e.target.value })}
                            placeholder="Group chat name"
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label htmlFor="chat-desc" className="text-sm font-medium">Description</Label>
                          <Input
                            id="chat-desc"
                            value={newChatForm.description}
                            onChange={(e) => setNewChatForm({ ...newChatForm, description: e.target.value })}
                            placeholder="Brief description of the setting"
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label htmlFor="chat-exposition" className="text-sm font-medium">Exposition</Label>
                          <Textarea
                            id="chat-exposition"
                            value={newChatForm.exposition}
                            onChange={(e) => setNewChatForm({ ...newChatForm, exposition: e.target.value })}
                            placeholder="Set the scene... (one line per entry)&#10;e.g., The room is cold.&#10;A window is broken."
                            rows={3}
                            className="mt-1"
                          />
                        </div>
                        <Button className="w-full" onClick={handleCreateGroupChat}>Add Group Chat</Button>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>

                  <div className="mt-6 space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Existing Group Chats</p>
                    {groupChats.map((chat) => (
                      <div key={chat.id} className="border border-border/60 rounded-lg bg-card/40">
                        <Collapsible
                          open={expandedChats.has(chat.id)}
                          onOpenChange={() => toggleChatExpansion(chat.id)}
                        >
                          <CollapsibleTrigger asChild>
                            <div className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/30">
                              <div>
                                <p className="font-medium">{chat.name}</p>
                                <p className="text-sm text-muted-foreground">{chat.description}</p>
                              </div>
                              {expandedChats.has(chat.id) ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </div>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="p-4 border-t border-border/60 bg-background/60 space-y-4">
                              <div>
                                <Label htmlFor={`edit-chat-name-${chat.id}`} className="text-sm font-medium">Name</Label>
                                <Input
                                  id={`edit-chat-name-${chat.id}`}
                                  defaultValue={chat.name}
                                  onChange={(e) => updateEditForm(chat.id, 'name', e.target.value)}
                                  placeholder="Group chat name"
                                  className="mt-1"
                                />
                              </div>
                              <div>
                                <Label htmlFor={`edit-chat-desc-${chat.id}`} className="text-sm font-medium">Description</Label>
                                <Textarea
                                  id={`edit-chat-desc-${chat.id}`}
                                  defaultValue={chat.description}
                                  onChange={(e) => updateEditForm(chat.id, 'description', e.target.value)}
                                  placeholder="Brief description of the setting"
                                  rows={3}
                                  className="mt-1"
                                />
                              </div>
                              <div>
                                <Label htmlFor={`edit-chat-exposition-${chat.id}`} className="text-sm font-medium">Exposition</Label>
                                <Textarea
                                  id={`edit-chat-exposition-${chat.id}`}
                                  defaultValue={chat.exposition?.join('\n') || ''}
                                  onChange={(e) => updateEditForm(chat.id, 'exposition', e.target.value)}
                                  placeholder="Set the scene (one line per entry)..."
                                  rows={3}
                                  className="mt-1"
                                />
                              </div>
                              <div>
                                <Label className="text-sm font-medium">Characters</Label>
                                <div className="flex flex-wrap gap-2 mt-1">
                                  {chat.characterIds.length === 0 ? (
                                    <p className="text-sm text-muted-foreground italic">No characters in this location yet.</p>
                                  ) : (
                                    chat.characterIds.map(charId => {
                                      const character = characters.find(c => c.id === charId)
                                      return character ? (
                                        <Badge
                                          key={charId}
                                          variant="secondary"
                                          className="cursor-pointer hover:bg-secondary/80 transition-colors"
                                          onClick={() => handleCharacterNameClick(charId)}
                                        >
                                          {character.name}
                                        </Badge>
                                      ) : null
                                    })
                                  )}
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <Button className="flex-1" onClick={() => handleSaveGroupChat(chat.id)}>Save Changes</Button>
                                <Button variant="destructive" className="flex-1" onClick={() => onDeleteGroupChat(chat.id)}>Delete Chat</Button>
                              </div>
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      </div>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="characters" className="mt-0">
                  <h3 className="text-lg font-semibold mb-4">Characters</h3>

                  <Collapsible open={isCharacterFormOpen} onOpenChange={setIsCharacterFormOpen}>
                    <CollapsibleTrigger asChild>
                      <Button variant="outline" className="w-full justify-between mb-4">
                        Add New Character
                        {isCharacterFormOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mb-4">
                      <div className="p-4 rounded-lg border border-dashed border-primary/40 bg-card/60 space-y-4 shadow-sm">
                        <div>
                          <Label htmlFor="char-name" className="text-sm font-medium">Name</Label>
                          <Input
                            id="char-name"
                            value={newCharacterForm.name}
                            onChange={(e) => setNewCharacterForm({ ...newCharacterForm, name: e.target.value })}
                            placeholder="Character name"
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label htmlFor="char-desc" className="text-sm font-medium">Description</Label>
                          <Textarea
                            id="char-desc"
                            value={newCharacterForm.description}
                            onChange={(e) => setNewCharacterForm({ ...newCharacterForm, description: e.target.value })}
                            placeholder="Describe the character's personality, background, etc."
                            rows={3}
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label htmlFor="char-group" className="text-sm font-medium">Assign to Group Chat</Label>
                          <Select
                            value={newCharacterForm.groupChatId}
                            onValueChange={(value) => setNewCharacterForm({ ...newCharacterForm, groupChatId: value })}
                          >
                            <SelectTrigger className="mt-1">
                              <SelectValue placeholder="Select group chat" />
                            </SelectTrigger>
                            <SelectContent>
                              {groupChats.map(gc => (
                                <SelectItem key={gc.id} value={gc.id}>{gc.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="char-quotes" className="text-sm font-medium">Example Quotes</Label>
                          <Textarea
                            id="char-quotes"
                            value={newCharacterForm.quotes}
                            onChange={(e) => setNewCharacterForm({ ...newCharacterForm, quotes: e.target.value })}
                            placeholder="One quote per line...&#10;e.g., 'I'm ready for adventure!'&#10;'This looks dangerous.'"
                            rows={3}
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label className="text-sm font-medium">Known Characters</Label>
                          <div className="mt-1 p-3 border rounded-md bg-muted/30 max-h-32 overflow-y-auto">
                            {characters.length === 0 ? (
                              <p className="text-sm text-muted-foreground italic">No other characters exist yet.</p>
                            ) : (
                              <div className="space-y-2">
                                {characters.map(c => {
                                  const isKnown = newCharacterForm.knownCharacterIds.includes(c.id)
                                  return (
                                    <label key={c.id} className="flex items-center gap-2 cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={isKnown}
                                        onChange={(e) => {
                                          const updated = e.target.checked
                                            ? [...newCharacterForm.knownCharacterIds, c.id]
                                            : newCharacterForm.knownCharacterIds.filter(id => id !== c.id)
                                          setNewCharacterForm({ ...newCharacterForm, knownCharacterIds: updated })
                                        }}
                                        className="rounded"
                                      />
                                      <span className="text-sm">{c.name}</span>
                                    </label>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                        <div>
                          <Label htmlFor="char-pfp" className="text-sm font-medium">Profile Picture</Label>
                          <Input
                            id="char-pfp"
                            type="file"
                            accept="image/*"
                            onChange={(e) =>
                              setNewCharacterForm({ ...newCharacterForm, pfp: e.target.files?.[0] || null })
                            }
                            className="mt-1"
                          />
                        </div>
                        <Button className="w-full" onClick={handleCreateCharacter}>Add Character</Button>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>

                  <div className="mt-6 space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Existing Characters</p>
                    {characters.map((char) => (
                      <div key={char.id} className="border border-border/60 rounded-lg bg-card/40">
                        <Collapsible
                          open={expandedCharacters.has(char.id)}
                          onOpenChange={() => toggleCharacterExpansion(char.id)}
                        >
                          <CollapsibleTrigger asChild>
                            <div className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/30">
                              <div className="flex items-center gap-3">
                                <Avatar className="w-8 h-8">
                                  <AvatarImage src={char.pfp_base64} />
                                  <AvatarFallback>{char.name[0]}</AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="font-medium">{char.name}</p>
                                </div>
                              </div>
                              {expandedCharacters.has(char.id) ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </div>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="p-4 border-t border-border/60 bg-background/60 space-y-4">
                              <div>
                                <Label htmlFor={`edit-char-name-${char.id}`} className="text-sm font-medium">Name</Label>
                                <Input
                                  id={`edit-char-name-${char.id}`}
                                  defaultValue={char.name}
                                  onChange={(e) => updateEditForm(char.id, 'name', e.target.value)}
                                  placeholder="Character name"
                                  className="mt-1"
                                />
                              </div>
                              <div>
                                <Label htmlFor={`edit-char-desc-${char.id}`} className="text-sm font-medium">Description</Label>
                                <Textarea
                                  id={`edit-char-desc-${char.id}`}
                                  defaultValue={char.description}
                                  onChange={(e) => updateEditForm(char.id, 'description', e.target.value)}
                                  placeholder="Describe the character's personality, background, etc."
                                  rows={3}
                                  className="mt-1"
                                />
                              </div>
                              <div>
                                <Label htmlFor={`edit-char-group-${char.id}`} className="text-sm font-medium">Assign to Group Chat</Label>
                                <Select
                                  defaultValue={char.groupChatId}
                                  onValueChange={(value) => updateEditForm(char.id, 'groupChatId', value)}
                                >
                                  <SelectTrigger className="mt-1">
                                    <SelectValue placeholder="Select group chat" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {groupChats.map(gc => (
                                      <SelectItem key={gc.id} value={gc.id}>{gc.name}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <Label htmlFor={`edit-char-quotes-${char.id}`} className="text-sm font-medium">Example Quotes</Label>
                                <Textarea
                                  id={`edit-char-quotes-${char.id}`}
                                  defaultValue={char.quotes.join('\n')}
                                  onChange={(e) => updateEditForm(char.id, 'quotes', e.target.value)}
                                  placeholder="One quote per line..."
                                  rows={3}
                                  className="mt-1"
                                />
                              </div>
                              <div className="border-t pt-4">
                                <Label className="text-sm font-medium">AI-Generated Notes</Label>
                                <div className="mt-1 p-3 rounded-md bg-muted/30 min-h-[60px]">
                                  {char.notes && char.notes.length > 0 ? (
                                    <ul className="list-disc list-inside space-y-1 text-sm">
                                      {char.notes.map((note, idx) => (
                                        <li key={idx}>{note}</li>
                                      ))}
                                    </ul>
                                  ) : (
                                    <p className="text-sm text-muted-foreground italic">This character has not made any notes yet.</p>
                                  )}
                                </div>
                              </div>
                              <div>
                                <Label className="text-sm font-medium">Known Characters</Label>
                                <div className="mt-1 p-3 border rounded-md bg-muted/30 max-h-32 overflow-y-auto">
                                  {characters.filter(c => c.id !== char.id).length === 0 ? (
                                    <p className="text-sm text-muted-foreground italic">No other characters exist yet.</p>
                                  ) : (
                                    <div className="space-y-2">
                                      {characters.filter(c => c.id !== char.id).map(c => {
                                        const isKnown = char.knownCharacterIds.includes(c.id)
                                        return (
                                          <label key={c.id} className="flex items-center gap-2 cursor-pointer">
                                            <input
                                              type="checkbox"
                                              checked={isKnown}
                                              onChange={(e) => {
                                                const currentKnown = editForms[char.id]?.knownCharacterIds
                                                  ? JSON.parse(editForms[char.id].knownCharacterIds!)
                                                  : char.knownCharacterIds
                                                const updated = e.target.checked
                                                  ? [...currentKnown, c.id]
                                                  : currentKnown.filter((id: string) => id !== c.id)
                                                updateEditForm(char.id, 'knownCharacterIds', JSON.stringify(updated))
                                              }}
                                              className="rounded"
                                            />
                                            <span className="text-sm">{c.name}</span>
                                          </label>
                                        )
                                      })}
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <Button className="flex-1" onClick={() => handleSaveCharacter(char.id)}>Save Changes</Button>
                                <Button variant="destructive" className="flex-1" onClick={() => onDeleteCharacter(char.id)}>Delete Character</Button>
                              </div>
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      </div>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="profile" className="mt-0">
                  <h3 className="text-lg font-semibold mb-4">Profile</h3>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="profile-name" className="text-sm font-medium">Display Name</Label>
                      <Input 
                        id="profile-name" 
                        placeholder="Your display name" 
                        className="mt-1"
                        value={settings.userProfile?.displayName || ''}
                        onChange={(e) => onSettingsChange(prev => ({
                          ...prev,
                          userProfile: { ...prev.userProfile, displayName: e.target.value }
                        }))}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Shown to characters when "Share profile" is enabled
                      </p>
                    </div>
                    <div>
                      <Label htmlFor="profile-desc" className="text-sm font-medium">Bio</Label>
                      <Textarea
                        id="profile-desc"
                        placeholder="Describe yourself to the characters..."
                        rows={4}
                        className="mt-1"
                        value={settings.userProfile?.bio || ''}
                        onChange={(e) => onSettingsChange(prev => ({
                          ...prev,
                          userProfile: { ...prev.userProfile, bio: e.target.value }
                        }))}
                      />
                    </div>
                    
                    {!settings.shareUserProfile && (
                      <div className="p-3 rounded-lg bg-muted/30 space-y-2">
                        <Label className="text-sm font-medium">Current Label</Label>
                        <p className="text-sm text-muted-foreground">
                          Characters currently know you as: <span className="font-medium text-foreground">{settings.strangerLabel || 'Stranger'}</span>
                        </p>
                        {settings.strangerLabel && settings.strangerLabel !== 'Stranger' && (
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => onSettingsChange(prev => ({ ...prev, strangerLabel: 'Stranger' }))}
                          >
                            Reset to "Stranger"
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="settings" className="mt-0">
                  <h3 className="text-lg font-semibold mb-4">Story Settings</h3>
                  <div className="space-y-4">
                    <div>
                      <Label className="text-sm font-medium">Chat List Style</Label>
                      <Select
                        value={settings.chatListStyle}
                        onValueChange={(value: SettingsState['chatListStyle']) =>
                          onSettingsChange((prev) => ({ ...prev, chatListStyle: value }))
                        }
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="modern">Modern</SelectItem>
                          <SelectItem value="classic">Classic</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label className="text-sm font-medium">AI Provider</Label>
                      <Select
                        value={settings.aiProvider}
                        onValueChange={(value: AIProvider) => {
                          // Save current settings for current provider before switching
                          const currentProvider = settings.aiProvider
                          const currentSettings: ProviderSettings = {
                            apiKey: settings.apiKey,
                            model: settings.model,
                            summarizationModel: settings.summarizationModel || '',
                            worldbuilderModel: settings.worldbuilderModel || '',
                            temperature: settings.temperature,
                            topK: settings.topK,
                            topP: settings.topP
                          }
                          
                          // Get saved settings for new provider (if any) - handle undefined for legacy data
                          const providerSettings = settings.providerSettings || {}
                          const newSettings = providerSettings[value] || DEFAULT_PROVIDER_SETTINGS[value]
                          
                          onSettingsChange((prev) => ({
                            ...prev,
                            // Save current settings to providerSettings
                            providerSettings: {
                              ...(prev.providerSettings || {}),
                              [currentProvider]: currentSettings
                            },
                            // Switch to new provider
                            aiProvider: value,
                            // Load saved settings for new provider
                            apiKey: newSettings.apiKey,
                            model: newSettings.model,
                            summarizationModel: newSettings.summarizationModel || '',
                            worldbuilderModel: newSettings.worldbuilderModel || '',
                            temperature: newSettings.temperature,
                            topK: newSettings.topK,
                            topP: newSettings.topP
                          }))
                        }}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="openai">OpenAI</SelectItem>
                          <SelectItem value="anthropic">Anthropic</SelectItem>
                          <SelectItem value="google">Google</SelectItem>
                          <SelectItem value="together">Together.ai</SelectItem>
                          <SelectItem value="openrouter">OpenRouter</SelectItem>
                          <SelectItem value="xai">xAI</SelectItem>
                        </SelectContent>
                      </Select>
                      <Label htmlFor="api-key" className="text-sm font-medium mt-3 block">API Key</Label>
                      <Input
                        id="api-key"
                        type="password"
                        value={settings.apiKey}
                        onChange={(e) =>
                          onSettingsChange((prev) => ({ ...prev, apiKey: e.target.value }))
                        }
                        placeholder="Enter your API key"
                        className="mt-1"
                      />
                    </div>

                    <Collapsible open={isModelSettingsOpen} onOpenChange={setIsModelSettingsOpen}>
                      <CollapsibleTrigger asChild>
                        <Button variant="outline" className="w-full justify-between">
                          Model & Settings
                          {isModelSettingsOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-4 space-y-4">
                        <div>
                          <Label htmlFor="model" className="text-sm font-medium">Character Model</Label>
                          <Input
                            id="model"
                            value={settings.model}
                            onChange={(e) => onSettingsChange((prev) => ({ ...prev, model: e.target.value }))}
                            placeholder="e.g., gpt-5.1, claude-4-5-sonnet, gemini-2.5-flash"
                            className="mt-1"
                          />
                          <p className="text-xs text-muted-foreground mt-1">Used for character responses</p>
                        </div>

                        <div>
                          <Label htmlFor="summarization-model" className="text-sm font-medium">Summarization Model</Label>
                          <Input
                            id="summarization-model"
                            value={settings.summarizationModel || ''}
                            onChange={(e) => onSettingsChange((prev) => ({ ...prev, summarizationModel: e.target.value }))}
                            placeholder="Leave empty to use Character Model"
                            className="mt-1"
                          />
                          <p className="text-xs text-muted-foreground mt-1">Used for summarizing long conversations (can use a cheaper model)</p>
                        </div>

                        <div>
                          <Label htmlFor="worldbuilder-model" className="text-sm font-medium">Worldbuilder Model</Label>
                          <Input
                            id="worldbuilder-model"
                            value={settings.worldbuilderModel || ''}
                            onChange={(e) => onSettingsChange((prev) => ({ ...prev, worldbuilderModel: e.target.value }))}
                            placeholder="Leave empty to use Character Model"
                            className="mt-1"
                          />
                          <p className="text-xs text-muted-foreground mt-1">Used for AI world generation (can use a cheaper model)</p>
                        </div>

                        <div>
                          <Label className="text-sm font-medium">Temperature: {settings.temperature}</Label>
                          <input
                            type="range"
                            min="0"
                            max="2"
                            step="0.1"
                            value={settings.temperature}
                            onChange={(e) =>
                              onSettingsChange((prev) => ({ ...prev, temperature: parseFloat(e.target.value) }))
                            }
                            className="w-full mt-1"
                          />
                        </div>

                        <div>
                          <Label className="text-sm font-medium">Top-K: {settings.topK}</Label>
                          <input
                            type="range"
                            min="1"
                            max="100"
                            step="1"
                            value={settings.topK}
                            onChange={(e) =>
                              onSettingsChange((prev) => ({ ...prev, topK: parseInt(e.target.value, 10) }))
                            }
                            className="w-full mt-1"
                          />
                        </div>

                        <div>
                          <Label className="text-sm font-medium">Top-P: {settings.topP}</Label>
                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.01"
                            value={settings.topP}
                            onChange={(e) =>
                              onSettingsChange((prev) => ({ ...prev, topP: parseFloat(e.target.value) }))
                            }
                            className="w-full mt-1"
                          />
                        </div>
                      </CollapsibleContent>
                    </Collapsible>

                    <div>
                      <Label className="text-sm font-medium">AI Generation Style</Label>
                      <Select
                        value={settings.messageStyle}
                        onValueChange={(value: SettingsState['messageStyle']) =>
                          onSettingsChange((prev) => ({ ...prev, messageStyle: value }))
                        }
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="descriptive">Descriptive (Full Paragraphs)</SelectItem>
                          <SelectItem value="casualRoleplay">Casual Roleplay (Actions & Dialogue)</SelectItem>
                          <SelectItem value="dialogueOnly">Dialogue-Only (Cheapest)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="shareProfile"
                          checked={settings.shareUserProfile}
                          onCheckedChange={(checked) =>
                            onSettingsChange((prev) => ({ ...prev, shareUserProfile: checked }))
                          }
                        />
                        <Label htmlFor="shareProfile" className="text-sm">
                          Share profile with characters
                        </Label>
                      </div>

                      <div className="flex items-center space-x-2">
                        <Switch
                          id="charactersKnowAll"
                          checked={settings.charactersKnowAll}
                          onCheckedChange={(checked) =>
                            onSettingsChange((prev) => ({ ...prev, charactersKnowAll: checked }))
                          }
                        />
                        <Label htmlFor="charactersKnowAll" className="text-sm">
                          Characters Know All Others (Legacy)
                        </Label>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <h4 className="font-medium">Data Management</h4>
                      <Button variant="outline" className="w-full" onClick={handleExportChatHistory}>
                        Export All Chat History
                      </Button>
                      <Button variant="outline" className="w-full" onClick={handleImportChatHistory}>
                        Import Chat History
                      </Button>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="world" className="mt-0">
                  <h3 className="text-lg font-semibold mb-4">AI World Builder & Data</h3>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="world-db" className="text-sm font-medium">World Database</Label>
                      <Textarea
                        id="world-db"
                        className="mt-1"
                        value={worldBuilderInput}
                        onChange={(e) => setWorldBuilderInput(e.target.value)}
                        placeholder="Paste character and location descriptions here...&#10;&#10;e.g., Captain Aeri is a fearless sky pirate who commands the airship Tempest Runner.&#10;&#10;The Zephyr Market is a floating marketplace..."
                        rows={8}
                        disabled={worldBuilderInProgress}
                      />
                      {worldBuilderInput.length > 0 && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {worldBuilderInput.length} characters
                        </p>
                      )}
                    </div>
                    
                    <div className="flex gap-2">
                      <Button 
                        className="flex-1" 
                        onClick={handleGenerateWorld}
                        disabled={worldBuilderInProgress || !worldBuilderInput.trim()}
                      >
                        {worldBuilderInProgress ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Generating...
                          </>
                        ) : (
                          'Generate World with AI'
                        )}
                      </Button>
                      {worldBuilderInput.length > 0 && !worldBuilderInProgress && (
                        <Button 
                          variant="outline" 
                          onClick={() => {
                            setWorldBuilderInput('')
                            setWorldBuilderLogs([])
                          }}
                        >
                          Clear
                        </Button>
                      )}
                    </div>

                    {/* World Builder Log Output */}
                    {worldBuilderLogs.length > 0 && (
                      <div className="p-3 rounded-lg bg-muted/50 border max-h-48 overflow-y-auto space-y-1">
                        {worldBuilderLogs.map((log) => (
                          <p 
                            key={log.key} 
                            className={`text-sm ${
                              log.type === 'error' ? 'text-red-500' :
                              log.type === 'warning' ? 'text-yellow-600 dark:text-yellow-500' :
                              log.type === 'success' ? 'text-green-600 dark:text-green-500' :
                              'text-muted-foreground'
                            }`}
                          >
                            {log.message}
                          </p>
                        ))}
                      </div>
                    )}

                    <div className="space-y-2">
                      <h4 className="text-sm font-medium">Import/Export</h4>
                      <Button variant="outline" className="w-full" onClick={handleExportWorld}>
                        Export Current World
                      </Button>
                      <Button variant="outline" className="w-full" onClick={handleImportWorld}>
                        Import World from File
                      </Button>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/30 text-sm text-muted-foreground">
                      <p className="font-medium mb-1">Current World:</p>
                      <p>Locations: {groupChats.length} | Characters: {characters.length}</p>
                    </div>
                  </div>
                </TabsContent>
              </div>
            </Tabs>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
