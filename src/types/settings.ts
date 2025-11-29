export type AIProvider = 'openai' | 'anthropic' | 'google' | 'together' | 'openrouter' | 'xai'

export type ProviderSettings = {
  apiKey: string
  model: string
  summarizationModel: string
  worldbuilderModel: string
  temperature: number
  topK: number
  topP: number
}

export type UserProfile = {
  displayName: string
  bio: string
}

export type SettingsState = {
  chatListStyle: 'modern' | 'classic'
  messageStyle: 'descriptive' | 'casualRoleplay' | 'dialogueOnly'
  shareUserProfile: boolean
  charactersKnowAll: boolean
  aiProvider: AIProvider
  // User profile
  userProfile: UserProfile
  // Label assigned by characters when profile isn't shared
  strangerLabel: string
  // Current provider settings (for easy access)
  apiKey: string
  model: string
  summarizationModel: string
  worldbuilderModel: string
  temperature: number
  topK: number
  topP: number
  // Saved settings per provider
  providerSettings: Partial<Record<AIProvider, ProviderSettings>>
}
