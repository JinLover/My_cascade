import * as vscode from 'vscode';

export interface IAIService {
    processCodeChanges(changes: string, isCompletion?: boolean): Promise<string | void>;
    processSelection(selection: string): Promise<void>;
    dispose(): void;
    setWebviewPanel(panel: vscode.WebviewPanel): void;
    stop(): void;
}

export interface AIServiceConfig {
    apiKey: string;
    context?: vscode.ExtensionContext;
}

export enum AIProvider {
    OpenAI = 'openai',
    Gemini = 'gemini'
} 