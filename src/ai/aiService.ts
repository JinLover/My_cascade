import OpenAI from 'openai';
import * as vscode from 'vscode';

export class AIService {
    private openai: OpenAI;
    private outputChannel: vscode.OutputChannel;
    private disposables: vscode.Disposable[] = [];

    constructor(apiKey: string) {
        this.openai = new OpenAI({
            apiKey: apiKey
        });
        this.outputChannel = vscode.window.createOutputChannel('My Cascade');
        this.disposables.push(this.outputChannel);
    }

    public dispose() {
        this.disposables.forEach(d => d.dispose());
    }

    private log(message: string) {
        this.outputChannel.appendLine(`[${new Date().toISOString()}] ${message}`);
    }

    public async processImage(base64Image: string) {
        try {
            this.log('Processing image...');
            const completion = await this.openai.chat.completions.create({
                model: "gpt-3.5-turbo",
                messages: [
                    {
                        role: "user",
                        content: [
                            { type: "text", text: "이 이미지에 대해 설명해주세요." },
                            { type: "image_url", image_url: { url: base64Image } }
                        ]
                    }
                ],
                max_tokens: 500
            });

            const response = completion.choices[0].message?.content || '이미지를 분석할 수 없습니다.';
            this.log(`Image processing response: ${response}`);
            return response;
        } catch (error) {
            this.log(`Error processing image: ${error instanceof Error ? error.message : 'Unknown error'}`);
            this.log(`Error details: ${JSON.stringify(error, null, 2)}`);
            console.error('Error processing image:', error);
            throw new Error('이미지 처리 중 오류가 발생했습니다.');
        }
    }

    public async processCodeChanges(message: string) {
        try {
            this.log(`Processing message: ${message}`);
            const completion = await this.openai.chat.completions.create({
                model: "gpt-3.5-turbo",
                messages: [
                    { 
                        role: "system", 
                        content: "당신은 코딩 조수입니다. 한국어로 대화하며, 사용자의 코딩 관련 질문에 답변해주세요." 
                    },
                    { 
                        role: "user", 
                        content: message 
                    }
                ]
            });

            const response = completion.choices[0].message?.content || '응답을 생성할 수 없습니다.';
            this.log(`Message processing response: ${response}`);
            return response;
        } catch (error) {
            this.log(`Error processing message: ${error instanceof Error ? error.message : 'Unknown error'}`);
            this.log(`Error details: ${JSON.stringify(error, null, 2)}`);
            console.error('Error processing message:', error);
            throw new Error('메시지 처리 중 오류가 발생했습니다.');
        }
    }

    public async processSelection(selection: string) {
        try {
            this.log(`Processing selection: ${selection}`);
            const completion = await this.openai.chat.completions.create({
                model: "gpt-3.5-turbo",
                messages: [
                    { 
                        role: "system", 
                        content: "당신은 코딩 조수입니다. 선택된 코드를 분석하고 한국어로 설명해주세요." 
                    },
                    { 
                        role: "user", 
                        content: `다음 코드를 분석해주세요:\n\n${selection}` 
                    }
                ]
            });

            const response = completion.choices[0].message?.content || '코드 분석을 생성할 수 없습니다.';
            this.log(`Selection processing response: ${response}`);
            return response;
        } catch (error) {
            this.log(`Error processing selection: ${error instanceof Error ? error.message : 'Unknown error'}`);
            this.log(`Error details: ${JSON.stringify(error, null, 2)}`);
            console.error('Error processing selection:', error);
            throw new Error('코드 분석 중 오류가 발생했습니다.');
        }
    }
}
