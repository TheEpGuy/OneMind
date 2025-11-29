import type { Character, GroupChat, WorldData, ChatMessage, ChatHistoryExport } from '../types/chat'

export function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
}

export function exportWorldData(characters: Character[], groupChats: GroupChat[]): WorldData {
  return {
    locations: groupChats.map(gc => ({
      name: gc.name,
      description: gc.description,
      exposition: gc.exposition || []
    })),
    characters: characters.map(char => {
      const loc = groupChats.find(gc => gc.id === char.groupChatId)
      return {
        name: char.name,
        description: char.description,
        pfp_base64: char.pfp_base64,
        location: loc ? loc.name : (groupChats[0]?.name || 'Unknown Location'),
        quotes: char.quotes,
        notes: char.notes,
        knownCharacters: char.knownCharacterIds
          .map(id => characters.find(c => c.id === id)?.name)
          .filter(Boolean) as string[]
      }
    })
  }
}

export function importWorldData(data: WorldData): {
  characters: Character[]
  groupChats: GroupChat[]
} {
  const groupChats: GroupChat[] = []
  const characters: Character[] = []

  // First pass: Create all locations
  data.locations.forEach(loc => {
    if (loc.name && loc.description) {
      groupChats.push({
        id: generateId(),
        name: loc.name,
        description: loc.description,
        characterIds: [],
        exposition: Array.isArray(loc.exposition) ? loc.exposition.filter(Boolean) : []
      })
    }
  })

  // Create default location if none exist
  if (groupChats.length === 0 && data.characters.length > 0) {
    groupChats.push({
      id: generateId(),
      name: 'Default Location',
      description: 'A starting place',
      characterIds: [],
      exposition: ['A plain, featureless area.']
    })
  }

  // Second pass: Create all characters
  data.characters.forEach(c => {
    if (c.name && c.description) {
      const locationName = c.location
      let gc = groupChats.find(g => g.name === locationName)
      if (!gc && groupChats.length > 0) {
        gc = groupChats[0] // Default to first location if specified one not found
      }
      const charId = generateId()
      const assignedChatId = gc?.id || ''

      if (gc) gc.characterIds.push(charId)

      characters.push({
        id: charId,
        name: c.name,
        description: c.description,
        pfp_base64: c.pfp_base64,
        groupChatId: assignedChatId,
        notes: Array.isArray(c.notes) ? c.notes.filter(Boolean) : [],
        quotes: Array.isArray(c.quotes) ? c.quotes.filter(Boolean) : [],
        knownCharacterIds: [] // Will be linked in third pass
      })
    }
  })

  // Third pass: Link known characters
  data.characters.forEach((sourceChar) => {
    const newChar = characters.find(c => c.name === sourceChar.name)
    if (!newChar) return

    const knownNames = sourceChar.knownCharacters || []
    if (Array.isArray(knownNames)) {
      const knownIds = knownNames
        .map(name => characters.find(c => c.name === name)?.id)
        .filter(Boolean) as string[]
      newChar.knownCharacterIds = knownIds
    }
  })

  return { characters, groupChats }
}

export function downloadJSON(filename: string, data: any): void {
  const jsonStr = JSON.stringify(data, null, 2)
  const blob = new Blob([jsonStr], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export async function uploadJSON(): Promise<any> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'application/json'

    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) {
        reject(new Error('No file selected'))
        return
      }

      try {
        const text = await file.text()
        const data = JSON.parse(text)
        resolve(data)
      } catch (err) {
        reject(err)
      }
    }

    input.click()
  })
}

/**
 * Export chat history to a portable format
 */
export function exportChatHistory(
  messages: Record<string, ChatMessage[]>,
  groupChats: GroupChat[]
): ChatHistoryExport {
  // Build location name mapping
  const locationNames: Record<string, string> = {}
  groupChats.forEach(gc => {
    locationNames[gc.id] = gc.name
  })

  // Filter out loading messages and only include chats with messages
  const filteredMessages: Record<string, ChatMessage[]> = {}
  Object.entries(messages).forEach(([chatId, msgs]) => {
    const filtered = msgs.filter(m => m.type !== 'loading')
    if (filtered.length > 0) {
      filteredMessages[chatId] = filtered
    }
  })

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    messages: filteredMessages,
    locationNames
  }
}

/**
 * Import chat history, matching by location name
 * Returns the messages mapped to current groupChat IDs
 */
export function importChatHistory(
  data: ChatHistoryExport,
  groupChats: GroupChat[]
): Record<string, ChatMessage[]> {
  const importedMessages: Record<string, ChatMessage[]> = {}

  // Build reverse mapping: location name -> current groupChat ID
  const nameToId: Record<string, string> = {}
  groupChats.forEach(gc => {
    nameToId[gc.name] = gc.id
  })

  // Map imported messages to current IDs by matching location names
  Object.entries(data.messages).forEach(([oldChatId, msgs]) => {
    const locationName = data.locationNames[oldChatId]
    if (locationName && nameToId[locationName]) {
      const newChatId = nameToId[locationName]
      // Regenerate message IDs to avoid conflicts
      importedMessages[newChatId] = msgs.map(m => ({
        ...m,
        id: generateId()
      }))
    }
  })

  return importedMessages
}
