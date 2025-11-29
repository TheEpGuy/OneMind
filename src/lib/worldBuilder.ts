import { generateText, tool, stepCountIs } from 'ai'
import { z } from 'zod'
import type { Character, GroupChat } from '../types/chat'
import type { SettingsState } from '../types/settings'
import { getModelInstance, getGenerationSettings } from './aiService'
import { generateId } from './worldData'

export type WorldBuilderLogEntry = {
  key: string
  message: string
  type: 'info' | 'success' | 'warning' | 'error'
}

export type WorldBuilderResult = {
  success: boolean
  characters: Character[]
  groupChats: GroupChat[]
  logs: WorldBuilderLogEntry[]
}

/**
 * Generates a world (locations + characters) from a text description using AI.
 * Uses the Vercel AI SDK with multi-step tool calling.
 */
export async function generateWorld(
  inputText: string,
  settings: SettingsState,
  onLogUpdate?: (logs: WorldBuilderLogEntry[]) => void
): Promise<WorldBuilderResult> {
  const logs: WorldBuilderLogEntry[] = []
  const characters: Character[] = []
  const groupChats: GroupChat[] = []

  const addLog = (key: string, message: string, type: WorldBuilderLogEntry['type'] = 'info') => {
    // Update existing log with same key or add new
    const existingIndex = logs.findIndex(l => l.key === key)
    if (existingIndex >= 0) {
      logs[existingIndex] = { key, message, type }
    } else {
      logs.push({ key, message, type })
    }
    onLogUpdate?.([...logs])
  }

  addLog('init', 'Starting world generation with AI...', 'info')

  const systemPrompt = `You are an AI world builder. Populate worlds from user text using the provided tools in this exact order:

1. **Create ALL locations** - Call \`createLocations\` once with all locations
2. **Create ALL characters** - Call \`createCharacters\` once with all characters
3. **Assign to locations** - Use \`addCharacterToLocation\` for each character
4. **Set relationships** - Use \`setKnownCharacters\` to establish connections (infer from context)
5. **Complete** - Call \`worldGenerationComplete\` when done

Rules:
- Skip entities that already exist
- Extract ALL characters/locations from input
- Create multiple entities per call when possible`

  try {
    const model = getModelInstance(settings, 'worldbuilder')
    const genSettings = getGenerationSettings(settings)

    await generateText({
      model: model as Parameters<typeof generateText>[0]['model'],
      system: systemPrompt,
      prompt: inputText,
      ...genSettings,
      stopWhen: stepCountIs(150),
      tools: {
        createLocations: tool({
          description: 'Creates one or more new locations (group chats) in the world in a single batch.',
          inputSchema: z.object({
            locations: z.array(z.object({
              name: z.string().describe('The unique name of the location.'),
              description: z.string().describe('A brief description of the location.'),
              exposition: z.array(z.string()).optional().describe('2-3 short descriptive sentences for the location.')
            }))
          }),
          execute: async ({ locations }) => {
            let created = 0
            let skipped = 0

            for (const loc of locations) {
              const exists = groupChats.some(gc => gc.name.toLowerCase() === loc.name.toLowerCase())
              if (exists) {
                skipped++
                continue
              }

              groupChats.push({
                id: generateId(),
                name: loc.name,
                description: loc.description,
                characterIds: [],
                exposition: loc.exposition?.filter(Boolean) || []
              })
              created++
            }

            const message = `Created ${created} location(s)${skipped > 0 ? `, skipped ${skipped} existing` : ''}`
            addLog('locations', `${message}`, 'success')
            return { success: true, created, skipped, message }
          }
        }),

        createCharacters: tool({
          description: 'Creates one or more new characters in a single batch. Does NOT assign them to a location or set relationships.',
          inputSchema: z.object({
            characters: z.array(z.object({
              name: z.string().describe('The unique name of the character.'),
              description: z.string().describe("A detailed description of the character's personality, appearance, and background."),
              quotes: z.array(z.string()).optional().describe("2-3 plausible example quotes that capture the character's speaking style.")
            }))
          }),
          execute: async ({ characters: chars }) => {
            let created = 0
            let skipped = 0

            for (const char of chars) {
              const exists = characters.some(c => c.name.toLowerCase() === char.name.toLowerCase())
              if (exists) {
                skipped++
                continue
              }

              characters.push({
                id: generateId(),
                name: char.name,
                description: char.description,
                groupChatId: '',
                notes: [],
                quotes: char.quotes?.filter(Boolean) || [],
                knownCharacterIds: []
              })
              created++
            }

            const message = `Created ${created} character(s)${skipped > 0 ? `, skipped ${skipped} existing` : ''}`
            addLog('characters', `${message}`, 'success')
            return { success: true, created, skipped, message }
          }
        }),

        addCharacterToLocation: tool({
          description: 'Assigns an existing character to an existing location.',
          inputSchema: z.object({
            characterName: z.string().describe('The name of the character to be assigned.'),
            locationName: z.string().describe('The name of the location to assign the character to.')
          }),
          execute: async ({ characterName, locationName }) => {
            const character = characters.find(c => c.name.toLowerCase() === characterName.toLowerCase())
            const location = groupChats.find(gc => gc.name.toLowerCase() === locationName.toLowerCase())

            if (!character) {
              return { success: false, error: `Character "${characterName}" not found.` }
            }
            if (!location) {
              return { success: false, error: `Location "${locationName}" not found.` }
            }

            character.groupChatId = location.id
            if (!location.characterIds.includes(character.id)) {
              location.characterIds.push(character.id)
            }

            addLog('assignments', `Assigned ${character.name} to ${location.name}`, 'info')
            return { success: true, message: `Assigned ${characterName} to ${locationName}` }
          }
        }),

        setKnownCharacters: tool({
          description: 'Sets the relationships for a character, specifying which other characters they know.',
          inputSchema: z.object({
            characterName: z.string().describe('The name of the character whose relationships are being set.'),
            knownCharacterNames: z.array(z.string()).describe('A list of names of other existing characters that this character knows.')
          }),
          execute: async ({ characterName, knownCharacterNames }) => {
            const character = characters.find(c => c.name.toLowerCase() === characterName.toLowerCase())

            if (!character) {
              return { success: false, error: `Character "${characterName}" not found.` }
            }

            const foundIds: string[] = []
            const notFound: string[] = []

            for (const name of knownCharacterNames) {
              const known = characters.find(c => c.name.toLowerCase() === name.toLowerCase())
              if (known && known.id !== character.id) {
                foundIds.push(known.id)
              } else if (!known) {
                notFound.push(name)
              }
            }

            character.knownCharacterIds = foundIds

            let message = `Set ${foundIds.length} relationship(s) for ${characterName}`
            if (notFound.length > 0) {
              message += ` (couldn't find: ${notFound.join(', ')})`
            }
            addLog('relationships', `${message}`, notFound.length > 0 ? 'warning' : 'info')

            return { success: true, found: foundIds.length, notFound, message }
          }
        }),

        worldGenerationComplete: tool({
          description: 'Call this function ONLY when all locations and characters have been created, assigned, and relationships set.',
          // Note: Using a dummy field because some models omit `arguments` for empty schemas
          inputSchema: z.object({
            confirm: z.boolean().optional().describe('Set to true to confirm completion.')
          }),
          execute: async () => {
            addLog('done', 'World generation complete!', 'success')
            return { success: true, message: 'World generation complete' }
          }
        })
      },
      onStepFinish: ({ finishReason }) => {
        // Log finish reason for debugging
        if (finishReason === 'error') {
          addLog('step_error', 'A step encountered an error', 'warning')
        }
      }
    })

    // Ensure we have valid data
    if (groupChats.length === 0 && characters.length > 0) {
      // Create a default location if we have characters but no locations
      const defaultLocation: GroupChat = {
        id: generateId(),
        name: 'Default Location',
        description: 'A starting place for characters',
        characterIds: [],
        exposition: []
      }
      groupChats.push(defaultLocation)

      // Assign unassigned characters to the default location
      for (const char of characters) {
        if (!char.groupChatId) {
          char.groupChatId = defaultLocation.id
          defaultLocation.characterIds.push(char.id)
        }
      }
      addLog('default_loc', 'Created default location for unassigned characters', 'info')
    }

    return {
      success: true,
      characters,
      groupChats,
      logs
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    addLog('error', `Error generating world: ${errorMessage}`, 'error')
    console.error('WorldBuilder AI Error:', error)

    return {
      success: false,
      characters,
      groupChats,
      logs
    }
  }
}
