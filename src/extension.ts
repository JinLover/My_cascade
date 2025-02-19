import * as vscode from 'vscode';
import { UIManager } from './ui/uiManager';
import { CodeAnalyzer } from './core/codeAnalyzer';
import { ConfigManager } from './utils/configManager';
import { AIServiceFactory } from './ai/AIServiceFactory';
import { IAIService, AIProvider } from './ai/IAIService';
import { CompletionManager } from './core/CompletionProvider';

let aiService: IAIService;
let uiManager: UIManager;
let codeAnalyzer: CodeAnalyzer;
let completionManager: CompletionManager;
let statusBarItem: vscode.StatusBarItem;
let configManager: ConfigManager;

export function activate(context: vscode.ExtensionContext) {
    console.log('Cascade extension is now active!');

    let isDisposed = false;
    
    try {
        // Initialize core services
        configManager = ConfigManager.getInstance(context);
        const provider = configManager.getActiveProvider();
        const apiKey = configManager.getApiKey(provider);
        
        aiService = AIServiceFactory.createService(provider, { apiKey, context });
        uiManager = new UIManager(context);
        codeAnalyzer = new CodeAnalyzer();
        completionManager = new CompletionManager(aiService);

        // Create status bar item
        statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        statusBarItem.command = 'my-cascade.switchAIProvider';
        context.subscriptions.push(statusBarItem);
        updateStatusBarItem(provider);
    } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to initialize Cascade: ${error?.message || 'Unknown error'}`);
        return;
    }

    // Register commands
    let startSession = vscode.commands.registerCommand('my-cascade.startSession', () => {
        uiManager.showCascadePanel(context, aiService);
    });

    let stopSession = vscode.commands.registerCommand('my-cascade.stopSession', () => {
        if (uiManager) {
            uiManager.dispose();
        }
    });

    let switchProvider = vscode.commands.registerCommand('my-cascade.switchAIProvider', async () => {
        const providers = [AIProvider.OpenAI, AIProvider.Gemini];
        const currentProvider = configManager.getActiveProvider();
        const items = providers.map(p => ({
            label: p,
            description: p === currentProvider ? '(current)' : ''
        }));

        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: 'Select AI Provider'
        });

        if (selected) {
            await configManager.updateConfig('activeProvider', selected.label);
            
            // Recreate AI service with new provider
            if (aiService) {
                aiService.dispose();
            }
            const newApiKey = configManager.getApiKey(selected.label as AIProvider);
            aiService = AIServiceFactory.createService(selected.label as AIProvider, { 
                apiKey: newApiKey,
                context 
            });
            
            // Update UI components
            updateStatusBarItem(selected.label as AIProvider);
            if (uiManager) {
                uiManager.updateAIService(aiService);
            }
            if (completionManager) {
                completionManager.updateAIService(aiService);
            }
            vscode.window.showInformationMessage(`Switched to ${selected.label} provider`);
        }
    });

    // Subscribe to document changes
    let changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument(
        async (event: vscode.TextDocumentChangeEvent) => {
            if (event.document === vscode.window.activeTextEditor?.document) {
                const analysis = await codeAnalyzer.analyzeChanges(event);
                if (analysis) {
                    aiService.processCodeChanges(JSON.stringify(analysis));
                }
            }
        }
    );

    // Subscribe to selection changes
    let selectionChangeSubscription = vscode.window.onDidChangeTextEditorSelection(
        async (event: vscode.TextEditorSelectionChangeEvent) => {
            const analysis = await codeAnalyzer.analyzeSelection(event);
            if (analysis) {
                const editor = event.textEditor;
                const selection = editor.selection;
                aiService.processSelection(editor.document.getText(selection));
            }
        }
    );

    // Subscribe to configuration changes
    let configurationChangeSubscription = vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('my-cascade.activeProvider')) {
            const newProvider = configManager.getActiveProvider();
            updateStatusBarItem(newProvider);
        }
    });

    // Add cleanup on window closed
    context.subscriptions.push(
        vscode.window.onDidChangeWindowState(e => {
            if (!e.focused && !isDisposed) {
                deactivate();
                isDisposed = true;
            }
        })
    );

    // Add subscriptions to context
    context.subscriptions.push(
        startSession,
        stopSession,
        switchProvider,
        changeDocumentSubscription,
        selectionChangeSubscription,
        configurationChangeSubscription,
        completionManager
    );
}

function updateStatusBarItem(provider: AIProvider) {
    statusBarItem.text = `$(symbol-misc) AI: ${provider}`;
    statusBarItem.tooltip = `Click to switch AI provider (current: ${provider})`;
    statusBarItem.show();
}

export function deactivate() {
    if (uiManager) {
        uiManager.dispose();
    }
    if (aiService) {
        aiService.dispose();
    }
    if (statusBarItem) {
        statusBarItem.dispose();
    }
    if (completionManager) {
        completionManager.dispose();
    }
}
