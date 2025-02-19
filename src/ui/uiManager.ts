import * as vscode from 'vscode';
import { IAIService } from '../ai/IAIService';
import * as path from 'path';

export class UIManager {
    private panel: vscode.WebviewPanel | undefined;
    private context: vscode.ExtensionContext;
    private disposables: vscode.Disposable[] = [];
    private currentAIService: IAIService | undefined;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
    }

    public dispose() {
        if (this.panel) {
            this.panel.dispose();
            this.panel = undefined;
        }

        this.disposables.forEach(d => d.dispose());
        this.disposables = [];
    }

    private getNonce() {
        let text = '';
        const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        for (let i = 0; i < 32; i++) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return text;
    }

    public showCascadePanel(context: vscode.ExtensionContext, aiService: IAIService) {
        this.currentAIService = aiService;

        if (this.panel) {
            this.panel.reveal(vscode.ViewColumn.Two);
            return;
        }

        this.panel = vscode.window.createWebviewPanel(
            'cascadeAssistant',
            'Cascade Assistant',
            vscode.ViewColumn.Two,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'media')]
            }
        );

        // Set webview panel to AI service
        this.currentAIService.setWebviewPanel(this.panel);

        this.panel.webview.html = this.getWebviewContent();

        // Handle messages from the webview
        this.panel.webview.onDidReceiveMessage(
            async message => {
                try {
                    switch (message.command) {
                        case 'askAI':
                            if (!this.currentAIService) {
                                throw new Error('AI service is not initialized');
                            }
                            
                            try {
                                // Add user message to the chat
                                if (this.panel) {
                                    this.panel.webview.postMessage({
                                        command: 'aiResponse',
                                        text: message.text,
                                        isUser: true
                                    });
                                }
                                
                                // Process with AI
                                await this.currentAIService.processCodeChanges(message.text);
                            } catch (error: any) {
                                console.error('Error processing request:', error);
                                if (error.message === 'STOP_REQUESTED') {
                                    this.currentAIService?.stop();
                                } else {
                                    throw new Error(`오류가 발생했습니다: ${error.message}`);
                                }
                            }
                            break;
                        case 'getFileLink':
                            const fileUri = await vscode.window.showOpenDialog({
                                canSelectFiles: true,
                                canSelectFolders: false,
                                canSelectMany: false,
                                title: '파일 첨부'
                            });
                            if (fileUri && fileUri[0]) {
                                const filePath = fileUri[0].fsPath;
                                const fileName = path.basename(filePath);
                                
                                if (this.panel) {
                                    // Send file info to webview
                                    this.panel.webview.postMessage({
                                        command: 'insertText',
                                        text: fileName,
                                        filePath: filePath
                                    });
                                }
                            }
                            break;
                        case 'stopAI':
                            if (this.currentAIService) {
                                // Notify the AI service to stop processing
                                this.currentAIService.stop();
                            }
                            break;
                        case 'readAndSendFile':
                            if (!this.currentAIService) {
                                throw new Error('AI service is not initialized');
                            }

                            try {
                                const document = await vscode.workspace.openTextDocument(vscode.Uri.file(message.filePath));
                                const fileContent = document.getText();
                                const processText = `파일 내용:\n\`\`\`\n${fileContent}\n\`\`\`\n\n사용자 메시지: ${message.message}`;

                                // Add user message to the chat first
                                if (this.panel) {
                                    this.panel.webview.postMessage({
                                        command: 'aiResponse',
                                        text: message.message,
                                        isUser: true
                                    });
                                }

                                // Process with AI
                                await this.currentAIService.processCodeChanges(processText);
                            } catch (error: any) {
                                console.error('Error processing request:', error);
                                if (error.message === 'STOP_REQUESTED') {
                                    this.currentAIService?.stop();
                                } else {
                                    if (this.panel) {
                                        this.panel.webview.postMessage({
                                            command: 'aiResponse',
                                            text: `Error: 파일을 처리하는 중 오류가 발생했습니다: ${error.message}`,
                                            isError: true
                                        });
                                    }
                                }
                                if (this.panel) {
                                    this.panel.webview.postMessage({
                                        command: 'setProcessingState',
                                        isProcessing: false
                                    });
                                }
                            }
                            break;
                        case 'insertText':
                            if (this.panel) {
                                this.panel.webview.postMessage({
                                    command: 'insertText',
                                    text: message.text,
                                    filePath: message.filePath
                                });
                            }
                            break;
                    }
                } catch (error: any) {
                    if (this.panel) {
                        this.panel.webview.postMessage({ 
                            command: 'aiResponse', 
                            text: `Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`,
                            isError: true
                        });
                    }
                }
            },
            undefined,
            context.subscriptions
        );

        this.panel.onDidDispose(
            () => {
                this.panel = undefined;
            },
            null,
            context.subscriptions
        );
    }

    public updateAIService(aiService: IAIService) {
        this.currentAIService = aiService;
    }

    private getWebviewContent() {
        const nonce = this.getNonce();
        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https: data: vscode-resource: ${this.panel?.webview.cspSource}; script-src 'nonce-${nonce}'; style-src 'unsafe-inline';">
            <title>Cascade Assistant</title>
            <style>
                body {
                    margin: 0;
                    padding: 15px;
                    color: var(--vscode-editor-foreground);
                    font-family: var(--vscode-font-family);
                    background-color: var(--vscode-editor-background);
                    overflow: hidden;
                }
                .container {
                    display: flex;
                    flex-direction: column;
                    height: calc(100vh - 30px);
                    max-width: 800px;
                    margin: 0 auto;
                    background-color: var(--vscode-editor-background);
                    position: relative;
                }
                .messages {
                    flex-grow: 1;
                    overflow-y: auto;
                    padding: 10px;
                    margin-bottom: 120px;
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }
                .messages::-webkit-scrollbar {
                    width: 8px;
                }
                .messages::-webkit-scrollbar-track {
                    background: transparent;
                }
                .messages::-webkit-scrollbar-thumb {
                    background-color: var(--vscode-scrollbarSlider-background);
                    border-radius: 4px;
                }
                .messages::-webkit-scrollbar-thumb:hover {
                    background-color: var(--vscode-scrollbarSlider-hoverBackground);
                }
                .message {
                    position: relative;
                    padding: 12px 16px;
                    border-radius: 8px;
                    max-width: 85%;
                    white-space: pre-wrap;
                    word-wrap: break-word;
                    font-size: 14px;
                    line-height: 1.5;
                    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
                }
                .message pre {
                    background-color: var(--vscode-textCodeBlock-background);
                    padding: 12px;
                    border-radius: 4px;
                    overflow-x: auto;
                    margin: 8px 0;
                }
                .message code {
                    font-family: var(--vscode-editor-font-family);
                    font-size: 13px;
                }
                .user-message {
                    background-color: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    margin-left: auto;
                    border-bottom-right-radius: 4px;
                }
                .assistant-message {
                    background-color: var(--vscode-textBlockQuote-background);
                    color: var(--vscode-editor-foreground);
                    margin-right: auto;
                    border-bottom-left-radius: 4px;
                    border-left: 3px solid var(--vscode-textBlockQuote-border);
                }
                .input-container {
                    position: fixed;
                    bottom: 15px;
                    left: 50%;
                    transform: translateX(-50%);
                    width: calc(100% - 30px);
                    max-width: 770px;
                    background-color: var(--vscode-editor-background);
                    border: 1px solid var(--vscode-input-border);
                    border-radius: 8px;
                    padding: 15px;
                    box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.1);
                }
                .input-row {
                    display: flex;
                    gap: 12px;
                    align-items: flex-end;
                }
                .input-wrapper {
                    position: relative;
                    flex-grow: 1;
                    background-color: var(--vscode-input-background);
                    border-radius: 8px;
                    border: 1px solid var(--vscode-input-border);
                    transition: all 0.2s ease;
                }
                .input-wrapper:focus-within {
                    border-color: var(--vscode-focusBorder);
                    box-shadow: 0 0 0 2px var(--vscode-focusBorder);
                }
                .input-area {
                    width: 100%;
                    min-height: 40px;
                    max-height: 150px;
                    padding: 10px 12px;
                    border: none;
                    background: transparent;
                    color: var(--vscode-input-foreground);
                    resize: none;
                    font-family: inherit;
                    font-size: 14px;
                    line-height: 1.4;
                    overflow-y: auto;
                }
                .input-area:focus {
                    outline: none;
                }
                .button-group {
                    display: flex;
                    gap: 8px;
                    align-items: flex-end;
                }
                button {
                    padding: 8px 16px;
                    height: 40px;
                    background-color: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    border-radius: 6px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 6px;
                    font-size: 13px;
                    font-weight: 500;
                    transition: all 0.2s ease;
                    min-width: 80px;
                }
                button:disabled {
                    opacity: 0.7;
                    cursor: not-allowed;
                }
                button:hover:not(:disabled) {
                    background-color: var(--vscode-button-hoverBackground);
                }
                .tool-button {
                    padding: 8px;
                    width: 40px;
                    height: 40px;
                    min-width: unset;
                    background-color: var(--vscode-button-secondaryBackground);
                    border-radius: 8px;
                }
                .tool-button:hover:not(:disabled) {
                    background-color: var(--vscode-button-secondaryHoverBackground);
                }
                .stop-button {
                    background-color: var(--vscode-errorForeground);
                }
                .stop-button:hover:not(:disabled) {
                    opacity: 0.9;
                }
                .loading-dots::after {
                    content: '';
                    animation: dots 1.5s infinite;
                }
                @keyframes dots {
                    0%, 20% { content: ''; }
                    40% { content: '.'; }
                    60% { content: '..'; }
                    80%, 100% { content: '...'; }
                }
                .file-preview {
                    margin-bottom: 8px;
                    background-color: var(--vscode-textBlockQuote-background);
                    border: 1px solid var(--vscode-textBlockQuote-border);
                    border-radius: 6px;
                    padding: 8px 12px;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-size: 13px;
                    animation: slideDown 0.2s ease;
                }
                @keyframes slideDown {
                    from {
                        opacity: 0;
                        transform: translateY(-10px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
                .file-preview-remove {
                    margin-left: auto;
                    cursor: pointer;
                    opacity: 0.7;
                    padding: 4px;
                    border-radius: 4px;
                    transition: all 0.2s ease;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .file-preview-remove:hover {
                    opacity: 1;
                    background-color: var(--vscode-textBlockQuote-border);
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div id="messages" class="messages"></div>
                <div class="input-container">
                    <div id="filePreview" style="display: none;" class="file-preview">
                        <span class="file-preview-icon">📎</span>
                        <span id="filePreviewName"></span>
                        <span class="file-preview-remove" onclick="removeFilePreview()">✕</span>
                    </div>
                    <div class="input-row">
                        <div class="input-wrapper">
                            <textarea id="userInput" class="input-area" rows="1" placeholder="채팅 입력..."></textarea>
                        </div>
                        <div class="button-group">
                            <button class="tool-button" id="attachButton" title="파일 첨부">📎</button>
                            <button id="sendButton">Send</button>
                            <button id="stopButton" class="stop-button" style="display: none">Stop</button>
                        </div>
                    </div>
                </div>
            </div>
            <script nonce="${nonce}">
                const vscode = acquireVsCodeApi();
                const messagesDiv = document.getElementById('messages');
                const userInput = document.getElementById('userInput');
                const sendButton = document.getElementById('sendButton');
                const stopButton = document.getElementById('stopButton');
                const attachButton = document.getElementById('attachButton');
                const filePreview = document.getElementById('filePreview');
                const filePreviewName = document.getElementById('filePreviewName');
                
                let isProcessing = false;
                let attachedFiles = new Map();

                function setProcessingState(processing) {
                    isProcessing = processing;
                    userInput.disabled = processing;
                    sendButton.disabled = processing;
                    attachButton.disabled = processing;
                    sendButton.innerHTML = processing ? "Processing<span class='loading-dots'></span>" : "Send";
                    stopButton.style.display = processing ? "block" : "none";
                    sendButton.style.display = processing ? "none" : "block";
                }

                function adjustTextareaHeight() {
                    userInput.style.height = 'auto';
                    userInput.style.height = Math.min(userInput.scrollHeight, 150) + 'px';
                }

                function removeFilePreview() {
                    filePreview.style.display = 'none';
                    attachedFiles.clear();
                }

                function handleFileAttachment() {
                    if (isProcessing) return;
                    vscode.postMessage({
                        command: 'getFileLink'
                    });
                }

                function sendMessage() {
                    const text = userInput.value.trim();
                    if (!text || isProcessing) return;
                    
                    if (attachedFiles.size > 0) {
                        setProcessingState(true);
                        
                        // 첨부된 파일이 있으면 파일 내용을 포함하여 전송
                        for (const [fileName, filePath] of attachedFiles) {
                            vscode.postMessage({
                                command: "readAndSendFile",
                                filePath: filePath,
                                fileName: fileName,
                                message: text
                            });
                            break; // 첫 번째 파일만 처리
                        }
                    } else {
                        setProcessingState(true);
                        // 일반 메시지 전송
                        vscode.postMessage({
                            command: "askAI",
                            text: text
                        });
                    }

                    // Clear input and reset UI
                    userInput.value = "";
                    filePreview.style.display = 'none';
                    attachedFiles.clear();
                    adjustTextareaHeight();
                }

                function addMessage(text, type) {
                    const messageDiv = document.createElement("div");
                    messageDiv.className = "message " + type + "-message";
                    
                    // Convert markdown code blocks
                    const formattedText = text.replace(/\`\`\`([\s\S]*?)\`\`\`/g, function(match, code) {
                        return "<pre><code>" + code.trim() + "</code></pre>";
                    });
                    
                    // Convert inline code
                    const finalText = formattedText.replace(/\`([^\`]+)\`/g, "<code>$1</code>");
                    
                    messageDiv.innerHTML = finalText;
                    messagesDiv.appendChild(messageDiv);
                    messageDiv.scrollIntoView({ behavior: "smooth", block: "end" });
                }

                function stopProcessing() {
                    vscode.postMessage({
                        command: 'stopAI'
                    });
                    setProcessingState(false);
                }

                // Event Listeners
                sendButton.addEventListener('click', sendMessage);
                stopButton.addEventListener('click', stopProcessing);
                attachButton.addEventListener('click', handleFileAttachment);
                userInput.addEventListener('input', () => {
                    adjustTextareaHeight();
                });

                userInput.addEventListener('keypress', event => {
                    if (event.key === 'Enter' && !event.shiftKey && !isProcessing) {
                        event.preventDefault();
                        sendMessage();
                    }
                });

                window.addEventListener("message", event => {
                    const message = event.data;
                    switch (message.command) {
                        case "aiResponse":
                            if (message.isError) {
                                console.error(message.text);
                                addMessage(message.text, "error");
                                setProcessingState(false);
                            } else if (message.isUser) {
                                addMessage(message.text, "user");
                            } else {
                                addMessage(message.text, "assistant");
                                setProcessingState(false);
                            }
                            break;
                        case "insertText":
                            const fileName = message.text;
                            attachedFiles.set(fileName, message.filePath);
                            filePreview.style.display = 'flex';
                            filePreviewName.textContent = fileName;
                            userInput.focus();
                            adjustTextareaHeight();
                            break;
                        case "setProcessingState":
                            setProcessingState(message.isProcessing);
                            break;
                    }
                });

                // Focus input on load
                userInput.focus();
                adjustTextareaHeight();
            </script>
        </body>
        </html>`;
    }
}