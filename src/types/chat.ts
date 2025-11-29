export type Character = {
  id: string
  name: string
  description: string
  pfp_base64?: string
  groupChatId: string
  notes: string[]
  quotes: string[]
  knownCharacterIds: string[]
}

export type GroupChat = {
  id: string
  name: string
  description: string
  characterIds: string[]
  exposition?: string[]
}

export type WorldData = {
  locations: {
    name: string
    description: string
    exposition: string[]
  }[]
  characters: {
    name: string
    description: string
    pfp_base64?: string
    location: string
    quotes: string[]
    notes: string[]
    knownCharacters: string[]
  }[]
}

export type ChatMessage = {
  id: string
  type: 'user' | 'character' | 'exposition' | 'narration' | 'director' | 'loading' | 'summary'
  text: string
  sender: string
  charId?: string
}

export type ChatHistoryExport = {
  version: 1
  exportedAt: string
  messages: Record<string, ChatMessage[]>
  /** Maps groupChatId to location name for readability */
  locationNames: Record<string, string>
}
