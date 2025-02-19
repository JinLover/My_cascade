import * as vscode from 'vscode';
import { AIProvider } from '../ai/IAIService';

interface CascadeConfig {
    apiKey: string;
    geminiApiKey: string;
    activeProvider: AIProvider;
    contextLines: number;
    debounceDelay: number;
}

export class ConfigManager {
    private context: vscode.ExtensionContext;
    private static instance: ConfigManager;
    private config: CascadeConfig = {
        apiKey: '',
        geminiApiKey: '',
        activeProvider: AIProvider.OpenAI,
        contextLines: 5,
        debounceDelay: 500
    };

    private constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.loadConfig();
    }

    public static getInstance(context?: vscode.ExtensionContext): ConfigManager {
        if (!ConfigManager.instance) {
            if (!context) {
                throw new Error('Context must be provided when creating ConfigManager instance');
            }
            ConfigManager.instance = new ConfigManager(context);
        }
        return ConfigManager.instance;
    }

    private loadConfig() {
        const config = vscode.workspace.getConfiguration('my-cascade');
        this.config = {
            apiKey: config.get<string>('apiKey') || '',
            geminiApiKey: config.get<string>('geminiApiKey') || '',
            activeProvider: config.get<AIProvider>('activeProvider') || AIProvider.OpenAI,
            contextLines: config.get<number>('contextLines') || 5,
            debounceDelay: config.get<number>('debounceDelay') || 500
        };
    }

    public getConfig(): CascadeConfig {
        return { ...this.config };
    }

    public async updateConfig(key: keyof CascadeConfig, value: any) {
        const config = vscode.workspace.getConfiguration('my-cascade');
        await config.update(key, value, true);
        this.loadConfig();
    }

    public getApiKey(provider: AIProvider): string {
        const key = provider === AIProvider.OpenAI ? this.config.apiKey : this.config.geminiApiKey;
        if (!key) {
            throw new Error(`${provider} API key is not set. Please configure it in VSCode settings.`);
        }
        return key;
    }

    public getActiveProvider(): AIProvider {
        return this.config.activeProvider;
    }

    public getContextLines(): number {
        return this.config.contextLines;
    }

    public getDebounceDelay(): number {
        return this.config.debounceDelay;
    }
}
