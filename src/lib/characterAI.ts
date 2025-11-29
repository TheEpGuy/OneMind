import { generateText } from 'ai';
import type { Character, GroupChat, ChatMessage } from '../types/chat';
import type { SettingsState } from '../types/settings';
import { getModelInstance, getGenerationSettings } from './aiService';
import { characterTools } from './characterTools';
import { generateId } from './worldData';
import { getMessagesForContext } from './summarize';

export type TokenUsage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
};

export type CharacterTurnResult = {
  messages: ChatMessage[];
  characterUpdates?: Partial<Character>;
  groupChatUpdates?: Map<string, Partial<GroupChat>>;
  strangerLabel?: string; // New label for the stranger if they introduced themselves
  error?: string;
  usage?: TokenUsage;
};

/**
 * Build the system instruction for a character
 * This defines their personality, context, and behavior
 */
export function buildSystemInstruction(
  character: Character,
  groupChat: GroupChat,
  allCharacters: Character[],
  allGroupChats: GroupChat[],
  settings: SettingsState
): string {
  // Get location context
  const locationInfo = `${groupChat.name}: ${groupChat.description}`;
  const expositionInfo = groupChat.exposition?.length 
    ? `\nLocation Details:\n${groupChat.exposition.map(e => `- ${e}`).join('\n')}`
    : '';
  
  // Get available locations for movement
  const otherLocations = allGroupChats.filter(gc => gc.id !== groupChat.id);
  const availableLocationsInfo = otherLocations.length
    ? `Available locations to travel to:\n${otherLocations.map(gc => `- ${gc.name}`).join('\n')}`
    : 'No other locations available.';
  
  // Get known characters
  let knownCharactersInfo = "";
  if (settings.charactersKnowAll) {
    const others = allCharacters.filter(c => c.id !== character.id && groupChat.characterIds.includes(c.id));
    knownCharactersInfo = others.length 
      ? `Other known characters:\n${others.map(c => `- ${c.name}: ${c.description}`).join('\n')}`
      : '';
  } else {
    const known = allCharacters.filter(c => 
      character.knownCharacterIds.includes(c.id) && groupChat.characterIds.includes(c.id)
    );
    knownCharactersInfo = known.length
      ? `Other known characters:\n${known.map(c => `- ${c.name}: ${c.description}`).join('\n')}`
      : 'You do not know any other characters yet.';
  }
  
  // Build notes section
  const notesInfo = character.notes.length
    ? `Your notes about others:\n${character.notes.map(n => `- ${n}`).join('\n')}`
    : 'You have no notes yet. Pay attention to what people say and do!';
  
  // Build quotes section (example dialogue)
  const quotesInfo = character.quotes.length
    ? `Example dialogue from you:\n${character.quotes.map(q => `- "${q}"`).join('\n')}`
    : '';
  
  // Get formatting instructions based on message style
  const formattingInstructions = getFormattingInstructions(settings.messageStyle);
  
  // Build user/stranger info based on profile sharing settings
  let userInfo = '';
  const strangerLabel = settings.strangerLabel || 'Stranger';
  if (settings.shareUserProfile && settings.userProfile.displayName.trim()) {
    const userName = settings.userProfile.displayName.trim();
    const userBio = settings.userProfile.bio?.trim();
    userInfo = `The Player:\n- Name: ${userName}${userBio ? `\n- About them: ${userBio}` : ''}`;
  } else {
    userInfo = `"${strangerLabel}" is a mysterious person - NEVER assume their identity, species, or appearance unless they tell you. If they introduce themselves, use labelStranger() to remember their name.`;
  }
  
  return `
You are "${character.name}": ${character.description}
Location: ${locationInfo}${expositionInfo}

${availableLocationsInfo}

${knownCharactersInfo}

${userInfo}

${notesInfo}

${quotesInfo ? quotesInfo + '\n' : ''}
RULES:
${formattingInstructions}
• Control ONLY your character; let others respond for themselves
• Focus on recent/impactful messages; keep responses concise
• Treat characters as strangers unless notes say otherwise
• Seek compromise; prioritize story over winning arguments
• When asked to go somewhere and you accept, USE moveToLocation() - don't just talk about going
• Tools: makeNote() for observations, moveToLocation() to travel${!settings.shareUserProfile ? ', labelStranger() when they tell you their name' : ''}
• Follow Director messages naturally without mentioning them

Conversation (most recent last):
`.trim();
}

/**
 * Get formatting instructions based on message style setting
 */
function getFormattingInstructions(style: SettingsState['messageStyle']): string {
  switch (style) {
    case 'dialogueOnly':
      return 'Format: Dialogue only in quotes. Ex: "So, what\'s the plan?"';

    case 'casualRoleplay':
      return 'Format: *action* "dialogue". Ex: *glances at door* "Did you hear that?"';

    case 'descriptive':
    default:
      return 'Format: Prose narrative with dialogue in quotes. Ex: He leans against the wall. "So, what\'s the plan?"';
  }
}

/**
 * Build catch-up block for character
 * This shows what happened since their last turn, with context-aware message selection
 */
export async function buildCatchupBlock(
  messages: ChatMessage[], 
  characterName: string,
  _settings: SettingsState,
  directorNudge?: string
): Promise<string> {
  // Use context-aware message retrieval to handle long conversations
  const contextMessages = getMessagesForContext(messages, 12);
  
  // Find last message from this character in the context
  let lastCharacterMessageIndex = -1;
  for (let i = contextMessages.length - 1; i >= 0; i--) {
    if (contextMessages[i].sender === characterName && contextMessages[i].type === 'character') {
      lastCharacterMessageIndex = i;
      break;
    }
  }
  
  // Build the catch-up text
  const catchupParts: string[] = [];
  
  // Include summary context if present
  const summaries = contextMessages.filter(m => m.type === 'summary');
  if (summaries.length > 0) {
    catchupParts.push(`[Previous context summary]\n${summaries.map(s => s.text).join('\n\n')}\n[End of summary]`);
  }
  
  // Get messages since character's last turn (or all non-summary messages if no previous turn)
  const nonSummaryMessages = contextMessages.filter(m => m.type !== 'summary');
  const catchupMessages = lastCharacterMessageIndex >= 0
    ? nonSummaryMessages.slice(nonSummaryMessages.indexOf(contextMessages[lastCharacterMessageIndex]) + 1)
    : nonSummaryMessages;
  
  // Filter and format catch-up messages
  const filteredCatchup = catchupMessages
    .filter(m => !['loading', 'narration'].includes(m.type))
    .map(m => {
      if (m.type === 'director') {
        return `[Director]: ${m.text}`;
      }
      return `${m.sender}: ${m.text}`;
    })
    .join('\n')
    .trim();
  
  if (filteredCatchup) {
    catchupParts.push(filteredCatchup);
  }
  
  let catchupBlock = catchupParts.join('\n\n');
  
  if (!catchupBlock && !directorNudge) {
    catchupBlock = "No one has said anything recently. Take the initiative.";
  }
  
  // Prepend director nudge if provided (for private guidance)
  if (directorNudge) {
    const nudgeText = `(Director's Nudge: ${directorNudge}. Incorporate this into your character's thoughts and next action.)`;
    catchupBlock = catchupBlock ? `${nudgeText}\n\n${catchupBlock}` : nudgeText;
  }
  
  // Check if the last message is from the USER talking to this character
  // Only add the engagement prompt for user messages, not character-to-character chat
  const relevantMessages = catchupMessages.filter(m => !['loading', 'narration', 'director'].includes(m.type));
  if (relevantMessages.length > 0) {
    const lastMessage = relevantMessages[relevantMessages.length - 1];
    // Only prompt if the last message is from the user (not another character)
    if (lastMessage.type === 'user') {
      catchupBlock += `\n\n[${lastMessage.sender} is talking to you. Respond to them directly.]`;
    }
  }
  
  return catchupBlock;
}

/**
 * Execute a character's turn using AI
 * 
 * This function:
 * 1. Builds system instruction with character context
 * 2. Creates catch-up block of messages since last turn
 * 3. Calls AI with tools enabled
 * 4. Processes tool calls (notes, movement)
 * 5. Returns new messages and state updates
 */
export async function executeCharacterTurn(
  character: Character,
  groupChat: GroupChat,
  allCharacters: Character[],
  allGroupChats: GroupChat[],
  messages: ChatMessage[],
  settings: SettingsState,
  directorNudge?: string
): Promise<CharacterTurnResult> {
  try {
    // Build AI configuration
    const systemInstruction = buildSystemInstruction(
      character, 
      groupChat, 
      allCharacters,
      allGroupChats,
      settings
    );
    
    const catchupBlock = await buildCatchupBlock(
      messages, 
      character.name,
      settings,
      directorNudge
    );
    
    const model = getModelInstance(settings);
    const generationSettings = getGenerationSettings(settings);
    
    // Call AI - cast model to any to handle v2/v3 compatibility
    const result = await generateText({
      model: model as Parameters<typeof generateText>[0]['model'],
      system: systemInstruction,
      prompt: catchupBlock,
      tools: characterTools,
      ...generationSettings,
    });
    
    // Extract token usage from result
    const usage: TokenUsage | undefined = result.usage ? {
      inputTokens: result.usage.inputTokens ?? 0,
      outputTokens: result.usage.outputTokens ?? 0,
      totalTokens: result.usage.totalTokens ?? (result.usage.inputTokens ?? 0) + (result.usage.outputTokens ?? 0),
    } : undefined;
    
    // Process results
    const turnResult = processCharacterTurnResult(
      result,
      character,
      groupChat,
      allGroupChats
    );
    
    return {
      ...turnResult,
      usage,
    };
    
  } catch (error) {
    console.error('Character turn error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      messages: [{
        id: generateId(),
        sender: character.name,
        text: `(An error occurred: ${errorMessage})`,
        type: 'character',
        charId: character.id,
      }],
      error: errorMessage,
    };
  }
}

/**
 * Process AI result and extract messages/updates
 */
function processCharacterTurnResult(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  result: any,
  character: Character,
  groupChat: GroupChat,
  allGroupChats: GroupChat[]
): CharacterTurnResult {
  const newMessages: ChatMessage[] = [];
  const characterUpdates: Partial<Character> = {};
  const groupChatUpdates = new Map<string, Partial<GroupChat>>();
  
  let hasMadeNote = false;
  let strangerLabel: string | undefined;
  
  // Process tool calls
  if (result.toolCalls && result.toolCalls.length > 0) {
    for (const toolCall of result.toolCalls) {
      if (!toolCall.input) continue; // Skip if input is undefined
      
      switch (toolCall.toolName) {
        case 'makeNote': {
          const note = (toolCall.input as { note?: string }).note;
          if (note) {
            // Add to character's notes
            const updatedNotes = [...(character.notes || []), note];
            characterUpdates.notes = updatedNotes;
            
            // Display the note as a message
            newMessages.push({
              id: generateId(),
              sender: character.name,
              text: `${character.name} noted: *${note}*`,
              type: 'character',
              charId: character.id,
            });
            
            console.log(`[${character.name}] Made note: ${note}`);
            hasMadeNote = true;
          }
          break;
        }
        
        case 'moveToLocation': {
          const destName = (toolCall.input as { locationName?: string }).locationName;
          if (!destName) break;
          
          const destChat = allGroupChats.find(gc => gc.name === destName);
          
          if (destChat && destChat.id !== character.groupChatId) {
            // Update character location
            characterUpdates.groupChatId = destChat.id;
            
            // Remove from old chat
            const oldChatUpdate: Partial<GroupChat> = {
              characterIds: groupChat.characterIds.filter(id => id !== character.id)
            };
            groupChatUpdates.set(groupChat.id, oldChatUpdate);
            
            // Add to new chat (filter first to prevent duplicates)
            const newChatUpdate: Partial<GroupChat> = {
              characterIds: [...destChat.characterIds.filter(id => id !== character.id), character.id]
            };
            groupChatUpdates.set(destChat.id, newChatUpdate);
            
            // Add movement message
            newMessages.push({
              id: generateId(),
              sender: 'Narrator',
              text: `*${character.name} moved to ${destChat.name}.*`,
              type: 'narration',
            });
          } else if (destChat && destChat.id === character.groupChatId) {
            newMessages.push({
              id: generateId(),
              sender: 'Narrator',
              text: `*${character.name} is already at ${destName}.*`,
              type: 'narration',
            });
          } else {
            newMessages.push({
              id: generateId(),
              sender: 'Narrator',
              text: `*${character.name} tried to move to unknown location: ${destName}.*`,
              type: 'narration',
            });
          }
          break;
        }
        
        case 'labelStranger': {
          const name = (toolCall.input as { name?: string }).name;
          if (name && name.trim()) {
            strangerLabel = name.trim();
            console.log(`[${character.name}] Labeled stranger as: ${strangerLabel}`);
          }
          break;
        }
      }
    }
  }
  
  // Add dialogue if present
  const dialogue = result.text?.trim();
  const hasReasoning = result.reasoning && result.reasoning.length > 0;
  
  if (dialogue) {
    newMessages.push({
      id: generateId(),
      sender: character.name,
      text: dialogue,
      type: 'character',
      charId: character.id,
    });
  } else if (!dialogue && hasReasoning) {
    // Reasoning model generated reasoning but no text output
    // This is normal for some reasoning models - they think but don't speak
    console.log(`[${character.name}] Generated reasoning without text output`);
  }
  
  // If no messages were generated AND no reasoning AND didn't just make a note, add a default
  if (newMessages.length === 0 && !hasReasoning && !hasMadeNote) {
    newMessages.push({
      id: generateId(),
      sender: character.name,
      text: `*${character.name} is thinking...*`,
      type: 'character',
      charId: character.id,
    });
  }
  
  return {
    messages: newMessages,
    characterUpdates: Object.keys(characterUpdates).length > 0 ? characterUpdates : undefined,
    groupChatUpdates: groupChatUpdates.size > 0 ? groupChatUpdates : undefined,
    strangerLabel,
  };
}
