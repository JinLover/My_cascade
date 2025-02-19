import * as vscode from 'vscode';
import OpenAI from 'openai';
import { IAIService, AIServiceConfig } from './IAIService';

export class OpenAIService implements IAIService {
    private openai: OpenAI;
    private disposables: vscode.Disposable[] = [];
    private webviewPanel: vscode.WebviewPanel | undefined;
    private requestQueue: Promise<any> = Promise.resolve();
    private isStopped: boolean = false;

    constructor(config: AIServiceConfig) {
        this.openai = new OpenAI({
            apiKey: config.apiKey
        });
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
                const messages = isCompletion ? [
                    {
                        role: "system" as const,
                        content: "You are a code completion assistant. Only provide the code completion, no explanations."
                    },
                    {
                        role: "user" as const,
                        content: `Complete the following code:\n${changes}`
                    }
                ] : [
                    {
                        role: "system" as const,
                        content: "You are a helpful coding assistant. Please analyze code changes and provide detailed suggestions. If the user's input is in Korean, please respond in Korean."
                    },
                    {
                        role: "user" as const,
                        content: `Analyze these code changes and provide suggestions: ${changes}`
                    }
                ];

                const completion = await this.openai.chat.completions.create({
                    model: "gpt-3.5-turbo",
                    messages: messages
                });

                // Handle the response
                if (completion.choices[0]?.message?.content) {
                    if (isCompletion) {
                        return completion.choices[0].message.content;
                    } else if (this.webviewPanel) {
                        this.webviewPanel.webview.postMessage({
                            command: 'aiResponse',
                            text: completion.choices[0].message.content,
                            isCode: changes.includes('{') || changes.includes('(') || changes.includes(';') || changes.includes('\n')
                        });
                    }
                }
            } catch (error: any) {
                const errorMessage = error.message || 'Unknown error occurred';
                console.error(`OpenAI Error: ${errorMessage}`);
                if (!isCompletion && this.webviewPanel) {
                    this.webviewPanel.webview.postMessage({
                        command: 'aiResponse',
                        text: `Error: ${errorMessage}`,
                        isError: true
                    });
                }
            }
        });
    }

    async processSelection(selection: string): Promise<void> {
        return this.enqueueRequest(async () => {
            try {
                const completion = await this.openai.chat.completions.create({
                    model: "gpt-3.5-turbo",
                    messages: [
                        {
                            role: "system" as const,
                            content: "You are a helpful coding assistant that analyzes selected code and provides insights. If the user's input is in Korean, please respond in Korean."
                        },
                        {
                            role: "user" as const,
                            content: `Analyze this code selection: ${selection}`
                        }
                    ]
                });

                if (completion.choices[0]?.message?.content && this.webviewPanel) {
                    this.webviewPanel.webview.postMessage({
                        command: 'aiResponse',
                        text: completion.choices[0].message.content,
                        isCode: selection.includes('{') || selection.includes('(') || selection.includes(';') || selection.includes('\n')
                    });
                }
            } catch (error: any) {
                const errorMessage = error.message || 'Unknown error occurred';
                console.error(`OpenAI Error: ${errorMessage}`);
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