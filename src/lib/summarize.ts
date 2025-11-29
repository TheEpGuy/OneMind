import { generateText } from 'ai';
import type { ChatMessage } from '../types/chat';
import type { SettingsState } from '../types/settings';
import { getModelInstance, getGenerationSettings } from './aiService';
import { generateId } from './worldData';

/**
 * Configuration for conversation summarization
 */
const SUMMARIZATION_CONFIG = {
  /** Token threshold before triggering summarization (input tokens used) */
  TOKEN_THRESHOLD: 3000,
  /** Number of recent messages to keep in full detail after summarization */
  RECENT_MESSAGES_TO_KEEP: 5,
} as const;

/**
 * Check if conversation needs summarization based on cumulative input token usage
 * @param cumulativeInputTokens - Total input tokens used in this chat so far
 */
export function needsSummarization(cumulativeInputTokens: number): boolean {
  return cumulativeInputTokens >= SUMMARIZATION_CONFIG.TOKEN_THRESHOLD;
}

/**
 * Summarize older messages to reduce context size
 * Returns updated message array with older messages replaced by a summary
 */
export async function summarizeOldMessages(
  messages: ChatMessage[],
  settings: SettingsState
): Promise<ChatMessage[]> {
  // Separate summaries, loading, and actual messages
  const existingSummaries = messages.filter(m => m.type === 'summary');
  const loadingMessages = messages.filter(m => m.type === 'loading');
  const actualMessages = messages.filter(m => 
    m.type !== 'loading' && m.type !== 'summary'
  );
  
  // Split into messages to summarize and messages to keep
  const keepCount = SUMMARIZATION_CONFIG.RECENT_MESSAGES_TO_KEEP;
  const messagesToSummarize = actualMessages.slice(0, -keepCount);
  const messagesToKeep = actualMessages.slice(-keepCount);
  
  // If nothing to summarize, return as-is
  if (messagesToSummarize.length < 5) {
    return messages;
  }
  
  // Build context from messages to summarize
  const conversationText = messagesToSummarize
    .map(m => {
      const prefix = m.type === 'director' ? '[Director]' : '';
      return `${prefix}${m.sender}: ${m.text}`;
    })
    .join('\n');
  
  // Include previous summaries in the new summary
  const previousSummaryText = existingSummaries.length > 0
    ? `Previous summary:\n${existingSummaries.map(s => s.text).join('\n\n')}\n\nContinued conversation:\n`
    : '';
  
  const prompt = `
You are summarizing a roleplay conversation to preserve context while reducing length.
Create a concise summary that captures:
- Key events and actions that occurred
- Important character interactions and relationships established
- Any significant plot developments or decisions made
- Notable emotional beats or character moments

Keep the summary factual and in past tense. Focus on information that would be relevant for continuing the story.
Maximum 3-4 paragraphs.

${previousSummaryText}${conversationText}
`.trim();

  try {
    const model = getModelInstance(settings, 'summarization');
    const generationSettings = getGenerationSettings(settings);
    
    const result = await generateText({
      model: model as Parameters<typeof generateText>[0]['model'],
      prompt,
      ...generationSettings
    });
    
    const summaryText = result.text.trim();
    
    // Create new summary message
    const summaryMessage: ChatMessage = {
      id: generateId(),
      type: 'summary',
      sender: 'Summary',
      text: summaryText,
    };
    
    // Return: new summary + kept messages + loading messages
    return [summaryMessage, ...messagesToKeep, ...loadingMessages];
    
  } catch (error) {
    console.error('Summarization error:', error);
    // On error, just return original messages
    return messages;
  }
}

/**
 * Get messages prepared for AI context
 * Includes summarization if needed and formats for the catch-up block
 */
export function getMessagesForContext(
  messages: ChatMessage[],
  maxRecentMessages: number = 15
): ChatMessage[] {
  // Filter out loading messages
  const filtered = messages.filter(m => m.type !== 'loading');
  
  // Get summaries and recent messages
  const summaries = filtered.filter(m => m.type === 'summary');
  const nonSummaries = filtered.filter(m => m.type !== 'summary');
  
  // Keep only recent non-summary messages
  const recentMessages = nonSummaries.slice(-maxRecentMessages);
  
  // Return summaries (if any) followed by recent messages
  return [...summaries, ...recentMessages];
}
