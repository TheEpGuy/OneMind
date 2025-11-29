import { tool } from 'ai';
import { z } from 'zod';

/**
 * Tools available to character AI during conversations
 * 
 * These tools allow characters to:
 * - Take notes about other characters (character growth/memory)
 * - Move between locations (group chats)
 * - Label the stranger with a name they've learned
 */

export const characterTools = {
  /**
   * Create a note about another character or situation
   * Characters can review these notes later in their system instruction
   */
  makeNote: tool({
    description: 'Create a note about another character or situation. You can review notes later. You can still speak after making a note.',
    inputSchema: z.object({
      note: z.string().describe(
        'Significant observation about another person, written in your unique voice. Do not mention making the note.'
      ),
    }),
  }),
  
  /**
   * Move to another location (group chat)
   * Character can speak in the same turn before/after moving
   */
  moveToLocation: tool({
    description: 'Physically travel to another location. Use this when someone asks you to go somewhere or you decide to leave. You can speak before or after moving.',
    inputSchema: z.object({
      locationName: z.string().describe('Exact name of the destination location'),
    }),
  }),
  
  /**
   * Label the stranger with a name they've introduced themselves as
   * Only available when the user hasn't shared their profile
   */
  labelStranger: tool({
    description: 'When the Stranger tells you their name, use this to remember it. Only use when they explicitly introduce themselves.',
    inputSchema: z.object({
      name: z.string().describe('The name the Stranger introduced themselves as'),
    }),
  }),
};
