import * as vscode from 'vscode';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { IAIService, AIServiceConfig } from './IAIService';
import * as fs from 'fs';
import * as path from 'path';

export class GeminiService implements IAIService {
    private genAI: GoogleGenerativeAI;
    private model: any;
    private disposables: vscode.Disposable[] = [];
    private webviewPanel: vscode.WebviewPanel | undefined;
    private requestQueue: Promise<any> = Promise.resolve();
    private globalPrompt: any;
    private isStopped: boolean = false;

    constructor(config: AIServiceConfig) {
        this.genAI = new GoogleGenerativeAI(config.apiKey);
        this.model = this.genAI.getGenerativeModel({ model: "gemini-pro" });
        this.loadGlobalPrompt(config.context);
    }

    private loadGlobalPrompt(context: vscode.ExtensionContext | undefined) {
        try {
            const promptPath = path.join(context?.extensionPath || '', 'src', 'prompts', 'global_prompt.json');
            const promptContent = fs.readFileSync(promptPath, 'utf8');
            this.globalPrompt = JSON.parse(promptContent);
        } catch (error) {
            console.error('Failed to load global prompt:', error);
            this.globalPrompt = {
                system_prompt: {
                    ko: "한국어 지원 AI 코딩 어시스턴트입니다.",
                    en: "AI coding assistant with Korean language support."
                },
                language_preference: "ko"
            };
        }
    }

    setWebviewPanel(panel: vscode.WebviewPanel): void {
        this.webviewPanel = panel;
    }

    stop(): void {
        this.isStopped = true;
    }

    private async enqueueRequest<T>(request: () => Promise<T>): Promise<T> {
        this.requestQueue = this.requestQueue.then(async () => {
            if (this.isStopped) {
                this.isStopped = false;
                throw new Error('STOP_REQUESTED');
            }
            // Add a small delay between requests to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 500));
            return request();
        });
        return this.requestQueue;
    }

    async processCodeChanges(changes: string, isCompletion?: boolean): Promise<string | void> {
        return this.enqueueRequest(async () => {
            try {
                const lang = this.globalPrompt.language_preference;
                let prompt;
                
                if (isCompletion) {
                    prompt = `${this.globalPrompt.system_prompt[lang]}\n${this.globalPrompt.code_completion_prompt[lang]}\n${changes}`;
                } else {
                    prompt = `${this.globalPrompt.system_prompt[lang]}\n${this.globalPrompt.file_analysis_prompt[lang]}\n${changes}`;
                }

                const result = await this.model.generateContent(prompt);
                const response = await result.response;
                const text = response.text();

                if (text) {
                    if (isCompletion) {
                        let cleanedText = text.trim();
                        cleanedText = cleanedText.replace(/^```[\w]*\n/, '').replace(/\n```$/, '');
                        return cleanedText;
                    } else if (this.webviewPanel) {
                        this.webviewPanel.webview.postMessage({
                            command: 'aiResponse',
                            text: text,
                            isCode: changes.includes('{') || changes.includes('(') || changes.includes(';') || changes.includes('\n')
                        });
                    }
                }
            } catch (error: any) {
                const errorMessage = error.message || 'Unknown error occurred';
                console.error(`Gemini Error: ${errorMessage}`);
                if (!isCompletion && this.webviewPanel) {
                    this.webviewPanel.webview.postMessage({
                        command: 'aiResponse',
                        text: `Error: ${errorMessage}`,
                        isError: true
                    });
                }
                if (errorMessage.includes('429') || errorMessage.includes('rate limit')) {
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            }
        });
    }

    async processSelection(selection: string): Promise<void> {
        return this.enqueueRequest(async () => {
            try {
                const prompt = `You are a helpful coding assistant. Please analyze the following code selection and provide insights. If the input is in Korean, please respond in Korean: ${selection}`;
                const result = await this.model.generateContent(prompt);
                const response = await result.response;
                const text = response.text();

                if (text && this.webviewPanel) {
                    this.webviewPanel.webview.postMessage({
                        command: 'aiResponse',
                        text: text,
                        isCode: selection.includes('{') || selection.includes('(') || selection.includes(';') || selection.includes('\n')
                    });
                }
            } catch (error: any) {
                const errorMessage = error.message || 'Unknown error occurred';
                console.error(`Gemini Error: ${errorMessage}`);
                if (this.webviewPanel) {
                    this.webviewPanel.webview.postMessage({
                        command: 'aiResponse',
                        text: `Error: ${errorMessage}`,
                        isError: true
                    });
                }
            }
        });
    }

    dispose(): void {
        this.disposables.forEach(d => d.dispose());
        this.webviewPanel = undefined;
    }
} 