import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createTogetherAI } from '@ai-sdk/togetherai';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { createXai } from '@ai-sdk/xai';
import type { SettingsState } from '../types/settings';

export type ModelPurpose = 'character' | 'summarization' | 'worldbuilder';

/**
 * Get the model name for a specific purpose
 * Falls back to the main character model if a purpose-specific model is not set
 */
export function getModelForPurpose(settings: SettingsState, purpose: ModelPurpose): string {
  switch (purpose) {
    case 'summarization':
      return settings.summarizationModel?.trim() || settings.model;
    case 'worldbuilder':
      return settings.worldbuilderModel?.trim() || settings.model;
    case 'character':
    default:
      return settings.model;
  }
}

/**
 * Get the configured AI model based on user settings
 * 
 * Uses the create* functions to configure providers with API keys,
 * then returns a model instance by calling the configured provider.
 */
export function getModelInstance(settings: SettingsState, purpose: ModelPurpose = 'character') {
  const { aiProvider, apiKey } = settings;
  const model = getModelForPurpose(settings, purpose);
  
  if (!apiKey) {
    throw new Error(`API key required for provider: ${aiProvider}`);
  }
  
  switch (aiProvider) {
    case 'openai': {
      const provider = createOpenAI({ apiKey });
      return provider(model);
    }
    
    case 'anthropic': {
      const provider = createAnthropic({ apiKey });
      return provider(model);
    }
    
    case 'google': {
      const provider = createGoogleGenerativeAI({ apiKey });
      return provider(model);
    }
    
    case 'together': {
      const provider = createTogetherAI({ apiKey });
      return provider(model);
    }
    
    case 'openrouter': {
      const provider = createOpenRouter({ apiKey });
      return provider(model);
    }
    
    case 'xai': {
      const provider = createXai({ apiKey });
      return provider(model);
    }
    
    default:
      throw new Error(`Unsupported AI provider: ${aiProvider}`);
  }
}

/**
 * Get common generation settings from user preferences
 */
export function getGenerationSettings(settings: SettingsState) {
  return {
    temperature: settings.temperature,
    topK: settings.topK,
    topP: settings.topP,
    maxRetries: 2,
  };
}

/**
 * Validate basic model format (provider-specific rules if needed)
 * Returns error message if invalid, undefined if valid
 */
export function validateModelFormat(
  provider: SettingsState['aiProvider'],
  model: string
): string | undefined {
  if (!model || model.trim().length === 0) {
    return 'Model name cannot be empty';
  }
  
  // Provider-specific format checks (not exhaustive lists)
  if (provider === 'openrouter' && !model.includes('/')) {
    return 'OpenRouter models should be in format: provider/model-name';
  }
  
  // Let the provider SDK handle actual model existence validation
  return undefined;
}
