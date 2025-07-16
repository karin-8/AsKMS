import { storage } from '../storage';
import { GuardrailsService } from './guardrails';

interface WidgetChatResponse {
  response: string;
  messageType: string;
  metadata?: any;
}

export class WidgetChatService {
  /**
   * Generate AI response for widget chat using Agent Chatbot configuration
   */
  static async generateAgentResponse(
    userMessage: string,
    agentId: number,
    userId: string,
    sessionId: string,
    conversationHistory: any[]
  ): Promise<WidgetChatResponse> {
    try {
      console.log(`🤖 Widget Chat: Getting agent ${agentId} for user ${userId}`);

      // Get agent configuration
      const agent = await storage.getAgentChatbotForWidget(agentId);
      if (!agent) {
        console.log(`❌ Widget Chat: Agent ${agentId} not found`);
        return {
          response: "ขออภัย ไม่สามารถเชื่อมต่อกับระบบได้ในขณะนี้",
          messageType: "error"
        };
      }

      console.log(`✅ Widget Chat: Found agent: ${agent.name}`);

      // Get agent's documents for context
      const agentDocs = await storage.getAgentChatbotDocumentsForWidget(agentId);
      const documentContents: string[] = [];

      if (agentDocs.length > 0) {
        console.log(`📚 Widget Chat: Found ${agentDocs.length} documents for agent`);

        for (const agentDoc of agentDocs) {
          try {
            const document = await storage.getDocumentForWidget(agentDoc.documentId);
            if (document && document.content) {
              const truncatedContent = document.content.length > 2000
                ? document.content.substring(0, 2000) + "..."
                : document.content;

              documentContents.push(
                `=== เอกสาร: ${document.name} ===\n${truncatedContent}\n`
              );
              console.log(`📄 Widget Chat: Added document: ${document.name}`);
            }
          } catch (error) {
            console.error(`❌ Widget Chat: Error fetching document ${agentDoc.documentId}:`, error);
          }
        }
      }

      let contextPrompt = "";
      if (documentContents.length > 0) {
        contextPrompt = `\n\nเอกสารที่เกี่ยวข้อง:\n${documentContents.join('\n')}`;
      }

      // Initialize guardrails service if configured
      let guardrailsService: GuardrailsService | null = null;
      if (agent.guardrailsConfig) {
        guardrailsService = new GuardrailsService(agent.guardrailsConfig);
        console.log(`🛡️ Widget Chat: Guardrails enabled for agent ${agent.name}`);

        // Validate input message
        const inputValidation = await guardrailsService.evaluateInput(userMessage);
        if (inputValidation.blocked) {
          console.log(`🚫 Widget Chat: Input blocked by guardrails: ${inputValidation.reason}`);
          return {
            response: inputValidation.modifiedContent || "ขออภัย ไม่สามารถตอบสนองคำขอนี้ได้",
            messageType: "blocked",
            metadata: { blocked: true, reason: inputValidation.reason }
          };
        }
      }

      // Build conversation messages
      const messages: any[] = [
        {
          role: "system",
          content: `${agent.systemPrompt}${contextPrompt}

สำคัญ: ตอบเป็นภาษาไทยเสมอ เว้นแต่ผู้ใช้จะสื่อสารเป็นภาษาอื่น
ตอบอย่างเป็นมิตรและช่วยเหลือ ให้ข้อมูลที่ถูกต้องและเป็นประโยชน์
คุณสามารถอ้างอิงบทสนทนาก่อนหน้านี้เพื่อให้คำตอบที่ต่อเนื่องและเหมาะสม`
        }
      ];

      // Add conversation history (only user and assistant messages)
      const memoryLimit = agent.memoryLimit || 10;
      const recentHistory = conversationHistory
        .filter(msg => msg.role === 'user' || msg.role === 'assistant')
        .slice(-memoryLimit);

      recentHistory.forEach(msg => {
        messages.push({
          role: msg.role === 'assistant' ? 'assistant' : 'user',
          content: msg.content
        });
      });

      // Add current user message
      messages.push({
        role: "user",
        content: userMessage
      });

      console.log(`🤖 Widget Chat: Sending ${messages.length} messages to OpenAI`);

      // Generate response with OpenAI
      const { OpenAI } = await import('openai');
      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });

      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: messages,
        max_tokens: 1000,
        temperature: 0.7,
      });

      let response = completion.choices[0].message.content || "ขออภัย ไม่สามารถสร้างคำตอบได้ในขณะนี้";

      // Validate output with guardrails if configured
      if (guardrailsService) {
        const outputValidation = await guardrailsService.evaluateOutput(response);
        if (outputValidation.blocked) {
          console.log(`🚫 Widget Chat: Output blocked by guardrails: ${outputValidation.reason}`);
          response = outputValidation.modifiedContent || "ขออภัย ไม่สามารถให้คำตอบนี้ได้";
        } else if (outputValidation.modifiedContent) {
          response = outputValidation.modifiedContent;
        }
      }

      console.log(`✅ Widget Chat: Generated response (${response.length} chars)`);

      return {
        response,
        messageType: "ai_response",
        metadata: {
          agentId: agent.id,
          agentName: agent.name,
          hasDocuments: agentDocs.length > 0,
          documentCount: agentDocs.length,
          guardrailsApplied: !!guardrailsService
        }
      };

    } catch (error) {
      console.error("Widget Chat Service Error:", error);
      return {
        response: "ขออภัย เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง",
        messageType: "error",
        metadata: { error: error.message }
      };
    }
  }

  /**
   * Extract JSON from OpenAI response that might be wrapped in markdown
   */
  private static extractJsonFromResponse(response: string): any {
    try {
      // First try direct JSON parsing
      return JSON.parse(response);
    } catch (e) {
      try {
        // Try to extract JSON from markdown code blocks
        const jsonMatch = response.match(/```(?:json)?\s*\n([\s\S]*?)\n\s*```/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[1]);
        }
        
        // Try to find JSON-like content between braces
        const braceMatch = response.match(/\{[\s\S]*\}/);
        if (braceMatch) {
          return JSON.parse(braceMatch[0]);
        }
        
        throw new Error("No valid JSON found");
      } catch (parseError) {
        console.error("Failed to extract JSON from response:", response);
        throw parseError;
      }
    }
  }
}