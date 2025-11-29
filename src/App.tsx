import { useState, useCallback, useEffect } from 'react'
import { AppHeader } from './components/app/AppHeader'
import { MenuDrawer } from './components/app/MenuDrawer'
import { ChatView } from './components/app/ChatView'
import { ChatList } from './components/app/ChatList'
import type { Character, ChatMessage, GroupChat } from './types/chat'
import type { SettingsState } from './types/settings'
import { generateId } from './lib/worldData'
import { executeCharacterTurn } from './lib/characterAI'
import { needsSummarization, summarizeOldMessages } from './lib/summarize'
import { Analytics } from '@vercel/analytics/react';

const STORAGE_KEYS = {
  SETTINGS: 'onemind_settings',
  CHARACTERS: 'onemind_characters',
  GROUP_CHATS: 'onemind_groupChats',
  MESSAGES: 'onemind_messages',
  TOKEN_USAGE: 'onemind_tokenUsage',
} as const

const INITIAL_SETTINGS: SettingsState = {
  chatListStyle: 'modern',
  messageStyle: 'descriptive',
  shareUserProfile: false,
  charactersKnowAll: false,
  aiProvider: 'openai',
  userProfile: {
    displayName: '',
    bio: ''
  },
  strangerLabel: 'Stranger',
  apiKey: '',
  model: '',
  summarizationModel: '',
  worldbuilderModel: '',
  temperature: 0.7,
  topK: 40,
  topP: 0.9,
  providerSettings: {}
}

// Helper functions for localStorage
function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const stored = localStorage.getItem(key)
    if (stored) {
      return JSON.parse(stored) as T
    }
  } catch (error) {
    console.warn(`Failed to load ${key} from localStorage:`, error)
  }
  return fallback
}

function saveToStorage<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch (error) {
    console.warn(`Failed to save ${key} to localStorage:`, error)
  }
}

function App() {
  const [characters, setCharacters] = useState<Character[]>(() => 
    loadFromStorage(STORAGE_KEYS.CHARACTERS, [])
  )
  const [groupChats, setGroupChats] = useState<GroupChat[]>(() => 
    loadFromStorage(STORAGE_KEYS.GROUP_CHATS, [])
  )
  const [messages, setMessages] = useState<Record<string, ChatMessage[]>>(() => 
    loadFromStorage(STORAGE_KEYS.MESSAGES, {})
  )
  const [tokenUsage, setTokenUsage] = useState<Record<string, number>>(() =>
    loadFromStorage(STORAGE_KEYS.TOKEN_USAGE, {})
  )
  const [summarizationStatus, setSummarizationStatus] = useState<Record<string, 'idle' | 'summarizing' | 'success'>>({})
  const [activeChatId, setActiveChatId] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [selectedCharId, setSelectedCharId] = useState<string | undefined>('none')
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [settings, setSettings] = useState<SettingsState>(() => 
    loadFromStorage(STORAGE_KEYS.SETTINGS, INITIAL_SETTINGS)
  )

  // Persist whenever they change
  useEffect(() => {
    saveToStorage(STORAGE_KEYS.SETTINGS, settings)
  }, [settings])

  // Ditto
  useEffect(() => {
    saveToStorage(STORAGE_KEYS.CHARACTERS, characters)
  }, [characters])

  // Ditto
  useEffect(() => {
    saveToStorage(STORAGE_KEYS.GROUP_CHATS, groupChats)
  }, [groupChats])

  // Ditto
  useEffect(() => {
    saveToStorage(STORAGE_KEYS.MESSAGES, messages)
  }, [messages])

  // Ditto
  useEffect(() => {
    saveToStorage(STORAGE_KEYS.TOKEN_USAGE, tokenUsage)
  }, [tokenUsage])

  const activeChat = groupChats.find(gc => gc.id === activeChatId)
  const activeChatMessages = activeChatId ? (messages[activeChatId] || []) : []

  // Character CRUD operations
  const createCharacter = (char: Omit<Character, 'id'>): string => {
    const id = generateId()
    const newChar: Character = { ...char, id }
    setCharacters(prev => [...prev, newChar])

    // Add character to their assigned group chat (prevent duplicates)
    if (char.groupChatId) {
      setGroupChats(prev => prev.map(gc =>
        gc.id === char.groupChatId
          ? { ...gc, characterIds: [...new Set([...gc.characterIds, id])] }
          : gc
      ))
    }

    return id
  }

  const updateCharacter = useCallback((id: string, updates: Partial<Character>): void => {
    setCharacters(prev => prev.map(char => {
      if (char.id !== id) return char

      const updated = { ...char, ...updates }

      // Handle group chat reassignment
      if (updates.groupChatId && updates.groupChatId !== char.groupChatId) {
        // Remove from old chat
        setGroupChats(gc => gc.map(g =>
          g.id === char.groupChatId
            ? { ...g, characterIds: g.characterIds.filter(cid => cid !== id) }
            : g
        ))
        // Add to new chat (filter first to prevent duplicates)
        setGroupChats(gc => gc.map(g =>
          g.id === updates.groupChatId
            ? { ...g, characterIds: [...g.characterIds.filter(cid => cid !== id), id] }
            : g
        ))
      }

      return updated
    }))
  }, [])

  const deleteCharacter = (id: string): void => {
    const char = characters.find(c => c.id === id)
    if (!char) return

    // Remove
    setGroupChats(prev => prev.map(gc =>
      gc.id === char.groupChatId
        ? { ...gc, characterIds: gc.characterIds.filter(cid => cid !== id) }
        : gc
    ))

    // Remove
    setCharacters(prev => prev.map(c => ({
      ...c,
      knownCharacterIds: c.knownCharacterIds.filter(knownId => knownId !== id)
    })).filter(c => c.id !== id))
  }

  // GroupChat CRUD operations
  const createGroupChat = (chat: Omit<GroupChat, 'id'>): string => {
    const id = generateId()
    const newChat: GroupChat = { ...chat, id }
    setGroupChats(prev => [...prev, newChat])
    return id
  }

  const updateGroupChat = useCallback((id: string, updates: Partial<GroupChat>): void => {
    setGroupChats(prev => prev.map(gc => {
      if (gc.id !== id) return gc
      
      // If updating characterIds, ensure no duplicates
      if (updates.characterIds) {
        updates = {
          ...updates,
          characterIds: [...new Set(updates.characterIds)]
        }
      }
      
      return { ...gc, ...updates }
    }))
  }, [])

  const deleteGroupChat = (id: string): void => {
    // Remove all characters from this chat
    const charsToUpdate = characters.filter(c => c.groupChatId === id)
    charsToUpdate.forEach(char => {
      deleteCharacter(char.id)
    })

    setGroupChats(prev => prev.filter(gc => gc.id !== id))

    if (activeChatId === id) {
      setActiveChatId(null)
    }
  }

  const removeCharacterFromChat = (chatId: string, charId: string): void => {
    setGroupChats(prev => prev.map(gc =>
      gc.id === chatId
        ? { ...gc, characterIds: gc.characterIds.filter(id => id !== charId) }
        : gc
    ))

    // Update character's groupChatId to empty
    setCharacters(prev => prev.map(char =>
      char.id === charId ? { ...char, groupChatId: '' } : char
    ))
  }

  // AI Chat Functions
  const handleSendMessage = async () => {
    const chat = groupChats.find(gc => gc.id === activeChatId)
    if (!chat) return

    const actingCharacterId = selectedCharId
    const hasMessage = message.trim().length > 0
    
    // Determine user's display name based on settings
    const userDisplayName = settings.shareUserProfile && settings.userProfile.displayName.trim()
      ? settings.userProfile.displayName.trim()
      : settings.strangerLabel || 'Stranger'

    // Handle "You" mode - just add user message
    if (actingCharacterId === 'none') {
      if (!hasMessage) return
      const newUserMessage: ChatMessage = {
        id: generateId(),
        sender: userDisplayName,
        text: message,
        type: 'user',
      }
      setMessages(prev => ({
        ...prev,
        [chat.id]: [...(prev[chat.id] || []), newUserMessage]
      }))
      setMessage('')
      return
    }

    // Handle director mode - add director message
    if (actingCharacterId === 'director') {
      if (!hasMessage) return
      const directorMessage: ChatMessage = {
        id: generateId(),
        sender: 'Director',
        text: message,
        type: 'director',
      }
      setMessages(prev => ({
        ...prev,
        [chat.id]: [...(prev[chat.id] || []), directorMessage]
      }))
      setMessage('')
      return
    }

    // Character mode - if user typed a message, send it first, then trigger character
    const actingCharacter = characters.find(c => c.id === actingCharacterId)
    if (!actingCharacter) return

    // Build the user message if present (we'll add it after potential summarization)
    let newUserMessage: ChatMessage | null = null
    if (hasMessage) {
      newUserMessage = {
        id: generateId(),
        sender: userDisplayName,
        text: message,
        type: 'user',
      }
      setMessage('')
    }

    // Check if we need to summarize based on cumulative token usage
    let currentMessages = messages[chat.id] || []
    const chatTokenUsage = tokenUsage[chat.id] || 0
    
    if (needsSummarization(chatTokenUsage)) {
      console.log(`Token threshold reached (${chatTokenUsage} tokens), summarizing older messages...`)
      
      // Set summarization status
      setSummarizationStatus(prev => ({ ...prev, [chat.id]: 'summarizing' }))
      
      const summarizedMessages = await summarizeOldMessages(currentMessages, settings)
      
      // Update with summarized messages
      setMessages(prev => ({
        ...prev,
        [chat.id]: summarizedMessages
      }))
      currentMessages = summarizedMessages
      
      // Reset token count after summarization
      setTokenUsage(prev => ({
        ...prev,
        [chat.id]: 0
      }))

      // Set success status and clear after delay
      setSummarizationStatus(prev => ({ ...prev, [chat.id]: 'success' }))
      setTimeout(() => {
        setSummarizationStatus(prev => ({ ...prev, [chat.id]: 'idle' }))
      }, 3000)
    }

    // Now add the user message (after summarization so it doesn't get summarized)
    if (newUserMessage) {
      currentMessages = [...currentMessages, newUserMessage]
      setMessages(prev => ({
        ...prev,
        [chat.id]: [...(prev[chat.id] || []), newUserMessage]
      }))
    }

    // Add loading message
    const loadingMessage: ChatMessage = {
      id: generateId(),
      sender: actingCharacter.name,
      text: '',
      type: 'loading',
      charId: actingCharacter.id,
    }
    setMessages(prev => ({
      ...prev,
      [chat.id]: [...(prev[chat.id] || []), loadingMessage]
    }))

    try {
      // Execute character turn
      const result = await executeCharacterTurn(
        actingCharacter,
        chat,
        characters,
        groupChats,
        currentMessages,
        settings
      )

      // Track
      if (result.usage) {
        setTokenUsage(prev => ({
          ...prev,
          [chat.id]: (prev[chat.id] || 0) + result.usage!.inputTokens
        }))
        console.log(`Token usage: ${result.usage.inputTokens} input, ${result.usage.outputTokens} output (total for chat: ${(tokenUsage[chat.id] || 0) + result.usage.inputTokens})`)
      }

      // Remove
      setMessages(prev => ({
        ...prev,
        [chat.id]: prev[chat.id].filter(m => m.type !== 'loading' || m.charId !== actingCharacter.id)
      }))

      // Add
      setMessages(prev => ({
        ...prev,
        [chat.id]: [...(prev[chat.id] || []), ...result.messages]
      }))

      // Apply notes, location changes
      if (result.characterUpdates) {
        updateCharacter(actingCharacter.id, result.characterUpdates)
      }

      // Apply character movements
      if (result.groupChatUpdates) {
        result.groupChatUpdates.forEach((updates, chatId) => {
          updateGroupChat(chatId, updates)
        })
      }

      // Apply stranger label if a character learned the user's name
      if (result.strangerLabel) {
        setSettings(prev => ({ ...prev, strangerLabel: result.strangerLabel! }))
      }

    } catch (error) {
      console.error('Turn execution error:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      
      // Remove loading, show error
      setMessages(prev => ({
        ...prev,
        [chat.id]: prev[chat.id]
          .filter(m => m.type !== 'loading' || m.charId !== actingCharacter.id)
          .concat([{
            id: generateId(),
            sender: actingCharacter.name,
            text: `(Error: ${errorMessage})`,
            type: 'character',
            charId: actingCharacter.id,
          }])
      }))
    }
  }

  const handleRetryMessage = useCallback(async (messageId: string) => {
    const chat = groupChats.find(gc => gc.id === activeChatId)
    if (!chat) return

    const chatMessages = messages[chat.id] || []
    const messageIndex = chatMessages.findIndex(m => m.id === messageId)
    if (messageIndex === -1) return

    const messageToRetry = chatMessages[messageIndex]
    if (messageToRetry.type !== 'character' || !messageToRetry.charId) return

    const actingCharacter = characters.find(c => c.id === messageToRetry.charId)
    if (!actingCharacter) return

    // Remove the message being retried and everything after it
    const trimmedMessages = chatMessages.slice(0, messageIndex)
    setMessages(prev => ({
      ...prev,
      [chat.id]: trimmedMessages
    }))

    // Add loading message
    const loadingMessage: ChatMessage = {
      id: generateId(),
      sender: actingCharacter.name,
      text: '',
      type: 'loading',
      charId: actingCharacter.id,
    }
    setMessages(prev => ({
      ...prev,
      [chat.id]: [...(prev[chat.id] || []), loadingMessage]
    }))

    try {
      const result = await executeCharacterTurn(
        actingCharacter,
        chat,
        characters,
        groupChats,
        trimmedMessages,
        settings
      )

      // Track token usage
      if (result.usage) {
        setTokenUsage(prev => ({
          ...prev,
          [chat.id]: (prev[chat.id] || 0) + result.usage!.inputTokens
        }))
      }

      // Remove
      setMessages(prev => ({
        ...prev,
        [chat.id]: prev[chat.id].filter(m => m.type !== 'loading' || m.charId !== actingCharacter.id)
      }))

      // Add
      setMessages(prev => ({
        ...prev,
        [chat.id]: [...(prev[chat.id] || []), ...result.messages]
      }))

      // Apply
      if (result.characterUpdates) {
        updateCharacter(actingCharacter.id, result.characterUpdates)
      }

      // Apply
      if (result.groupChatUpdates) {
        result.groupChatUpdates.forEach((updates, chatId) => {
          updateGroupChat(chatId, updates)
        })
      }

      // Apply stranger label if a character learned the user's name
      if (result.strangerLabel) {
        setSettings(prev => ({ ...prev, strangerLabel: result.strangerLabel! }))
      }

    } catch (error) {
      console.error('Retry error:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      
      // Remove
      setMessages(prev => ({
        ...prev,
        [chat.id]: prev[chat.id]
          .filter(m => m.type !== 'loading' || m.charId !== actingCharacter.id)
          .concat([{
            id: generateId(),
            sender: actingCharacter.name,
            text: `(Error: ${errorMessage})`,
            type: 'character',
            charId: actingCharacter.id,
          }])
      }))
    }
  }, [activeChatId, characters, groupChats, messages, settings, updateCharacter, updateGroupChat])

  return (
    <div className="flex flex-col h-screen bg-background">
      <AppHeader onMenuToggle={() => setIsMenuOpen(prev => !prev)} />

      <MenuDrawer
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        characters={characters}
        groupChats={groupChats}
        messages={messages}
        settings={settings}
        onSettingsChange={setSettings}
        onCreateCharacter={createCharacter}
        onUpdateCharacter={updateCharacter}
        onDeleteCharacter={deleteCharacter}
        onCreateGroupChat={createGroupChat}
        onUpdateGroupChat={updateGroupChat}
        onDeleteGroupChat={deleteGroupChat}
        onRemoveCharacterFromChat={removeCharacterFromChat}
        onImportWorld={(chars: Character[], chats: GroupChat[]) => {
          setCharacters(chars)
          setGroupChats(chats)
          setMessages({}) // Clear old messages when importing a new world
        }}
        onExportWorld={() => ({ characters, groupChats })}
        onImportMessages={(importedMessages) => {
          setMessages(prev => ({ ...prev, ...importedMessages }))
        }}
      />

      <main className="flex-1 overflow-hidden">
        {activeChatId ? (
          <ChatView
            chat={activeChat}
            characters={characters}
            messages={activeChatMessages}
            selectedCharId={selectedCharId}
            message={message}
            summarizationStatus={activeChatId ? summarizationStatus[activeChatId] || 'idle' : 'idle'}
            onBack={() => setActiveChatId(null)}
            onSelectedCharChange={(value) => setSelectedCharId(value)}
            onMessageChange={(value) => setMessage(value)}
            onSend={handleSendMessage}
            onRetry={handleRetryMessage}
          />
        ) : (
          <div className="p-6 h-full overflow-y-auto">
            <ChatList
              groupChats={groupChats}
              characters={characters}
              layout={settings.chatListStyle}
              onSelectChat={(chatId) => setActiveChatId(chatId)}
            />
          </div>
        )}
      </main>
      <Analytics />
    </div>
  )
}

export default App

