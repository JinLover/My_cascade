import * as vscode from 'vscode';

export class CodeAnalyzer {
    private debounceTimer: NodeJS.Timeout | null = null;
    private readonly DEBOUNCE_DELAY = 500; // ms
    private lastAnalysis: any = null;
    
    public async analyzeChanges(event: vscode.TextDocumentChangeEvent) {
        return new Promise((resolve) => {
            if (this.debounceTimer) {
                clearTimeout(this.debounceTimer);
            }

            this.debounceTimer = setTimeout(async () => {
                const analysis = await this.performAnalysis(event);
                // Only return analysis if it's different from the last one
                if (JSON.stringify(analysis) !== JSON.stringify(this.lastAnalysis)) {
                    this.lastAnalysis = analysis;
                    resolve(analysis);
                } else {
                    resolve(null);
                }
            }, this.DEBOUNCE_DELAY);
        });
    }

    private async performAnalysis(event: vscode.TextDocumentChangeEvent) {
        const document = event.document;
        const changes = event.contentChanges;

        if (changes.length === 0) {
            return null;
        }

        return {
            fileName: document.fileName,
            languageId: document.languageId,
            changes: changes.map(change => ({
                range: {
                    start: {
                        line: change.range.start.line,
                        character: change.range.start.character
                    },
                    end: {
                        line: change.range.end.line,
                        character: change.range.end.character
                    }
                },
                text: change.text
            })),
            context: await this.getContextAroundChanges(document, changes)
        };
    }

    public async analyzeSelection(event: vscode.TextEditorSelectionChangeEvent) {
        const editor = event.textEditor;
        const document = editor.document;
        const selection = event.selections[0]; // Using primary selection

        if (!selection) {
            return null;
        }

        const selectedText = document.getText(selection);
        if (!selectedText) {
            return null;
        }

        const analysis = {
            fileName: document.fileName,
            languageId: document.languageId,
            selection: {
                start: {
                    line: selection.start.line,
                    character: selection.start.character
                },
                end: {
                    line: selection.end.line,
                    character: selection.end.character
                }
            },
            selectedText: selectedText,
            context: await this.getContextAroundSelection(document, selection)
        };

        return analysis;
    }

    private async getContextAroundChanges(
        document: vscode.TextDocument,
        changes: readonly vscode.TextDocumentContentChangeEvent[]
    ) {
        // Get the range that encompasses all changes
        let startLine = Number.MAX_VALUE;
        let endLine = 0;

        changes.forEach(change => {
            startLine = Math.min(startLine, change.range.start.line);
            endLine = Math.max(endLine, change.range.end.line);
        });

        // Add context lines before and after
        startLine = Math.max(0, startLine - 5);
        endLine = Math.min(document.lineCount - 1, endLine + 5);

        return document.getText(new vscode.Range(
            new vscode.Position(startLine, 0),
            new vscode.Position(endLine, document.lineAt(endLine).text.length)
        ));
    }

    private async getContextAroundSelection(
        document: vscode.TextDocument,
        selection: vscode.Selection
    ) {
        const startLine = Math.max(0, selection.start.line - 5);
        const endLine = Math.min(document.lineCount - 1, selection.end.line + 5);

        return document.getText(new vscode.Range(
            new vscode.Position(startLine, 0),
            new vscode.Position(endLine, document.lineAt(endLine).text.length)
        ));
    }
}
