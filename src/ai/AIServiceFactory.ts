import * as vscode from 'vscode';
import { IAIService, AIProvider, AIServiceConfig } from './IAIService';
import { OpenAIService } from './OpenAIService';
import { GeminiService } from './GeminiService';

export class AIServiceFactory {
    static createService(provider: AIProvider, config: AIServiceConfig): IAIService {
        switch (provider) {
            case AIProvider.OpenAI:
                return new OpenAIService(config);
            case AIProvider.Gemini:
                return new GeminiService(config);
            default:
                throw new Error(`Unsupported AI provider: ${provider}`);
        }
    }

    static getActiveProvider(): AIProvider {
        const config = vscode.workspace.getConfiguration('my-cascade');
        return config.get('activeProvider') as AIProvider || AIProvider.OpenAI;
    }

    static getApiKey(provider: AIProvider): string {
        const config = vscode.workspace.getConfiguration('my-cascade');
        let apiKey = '';
        
        switch (provider) {
            case AIProvider.OpenAI:
                apiKey = config.get('apiKey') || '';
                break;
            case AIProvider.Gemini:
                apiKey = config.get('geminiApiKey') || '';
                break;
            default:
                throw new Error(`Unsupported AI provider: ${provider}`);
        }

        if (!apiKey) {
            throw new Error(`API key not found for ${provider}. Please set the API key in settings.`);
        }

        return apiKey;
    }
} 