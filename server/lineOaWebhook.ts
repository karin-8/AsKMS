import { Request, Response } from "express";
import OpenAI from "openai";
import { storage } from "./storage";
import { db } from "./db";
import { sql } from "drizzle-orm";
import crypto from "crypto";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface LineMessage {
  type: string;
  id: string;
  text?: string;
}

interface LineEvent {
  type: string;
  message?: LineMessage;
  replyToken?: string;
  source: {
    userId: string;
    type: string;
  };
}

interface LineWebhookBody {
  destination: string;
  events: LineEvent[];
}

// Verify Line signature
function verifyLineSignature(body: string, signature: string, channelSecret: string): boolean {
  const hash = crypto
    .createHmac('sha256', channelSecret)
    .update(body)
    .digest('base64');
  
  return hash === signature;
}

// Send reply message to Line
async function sendLineReply(replyToken: string, message: string, channelAccessToken: string) {
  try {
    const response = await fetch('https://api.line.me/v2/bot/message/reply', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${channelAccessToken}`
      },
      body: JSON.stringify({
        replyToken,
        messages: [{
          type: 'text',
          text: message
        }]
      })
    });

    if (!response.ok) {
      console.error('❌ Line API Error:', await response.text());
      return false;
    }

    console.log('✅ Line reply sent successfully');
    return true;
  } catch (error) {
    console.error('💥 Error sending Line reply:', error);
    return false;
  }
}

// Get AI response using OpenAI with chat history
async function getAiResponse(userMessage: string, agentId: number, userId: string, channelType: string, channelId: string, replyToken: string, channelAccessToken: string): Promise<string> {
  try {
    console.log(`🔍 Debug: Getting agent ${agentId} for user ${userId}`);
    
    // Get agent configuration
    const agent = await storage.getAgentChatbot(agentId, userId);
    if (!agent) {
      console.log(`❌ Agent ${agentId} not found for user ${userId}`);
      return "ขออภัย ไม่สามารถเชื่อมต่อกับระบบได้ในขณะนี้";
    }

    console.log(`✅ Found agent: ${agent.name}`);

    // Get chat history if memory is enabled
    let chatHistory: any[] = [];
    if (agent.memoryEnabled) {
      const memoryLimit = agent.memoryLimit || 10;
      console.log(`📚 Fetching chat history (limit: ${memoryLimit})`);
      
      try {
        chatHistory = await storage.getChatHistory(userId, channelType, channelId, agentId, memoryLimit);
        console.log(`📝 Found ${chatHistory.length} previous messages`);
      } catch (error) {
        console.error('⚠️ Error fetching chat history:', error);
        // Continue without history if there's an error
      }
    }

    // Get agent's documents for context
    const agentDocs = await storage.getAgentChatbotDocuments(agentId, userId);
    let documentContext = "";
    
    if (agentDocs.length > 0) {
      console.log(`📚 Agent has ${agentDocs.length} configured documents`);
      
      // Get full document details
      const documentIds = agentDocs.map(doc => doc.documentId);
      const fullDocuments = await storage.getDocumentsByIds(documentIds);
      
      console.log(`📄 Retrieved ${fullDocuments.length} full documents`);
      
      // Use the generateChatResponse function with document context like DocumentChatModal
      try {
        const openaiService = await import('./services/openai');
        console.log(`🔍 Using vector search with ${fullDocuments.length} documents`);
        
        const aiResponse = await openaiService.generateChatResponse(
          userMessage,
          fullDocuments,
          undefined // No specific document ID for general RAG
        );
        
        console.log(`🤖 AI response: ${aiResponse}`);
        
        // Save chat history
        try {
          await storage.createChatHistory({
            userId,
            channelType,
            channelId,
            agentId,
            messageType: 'user',
            content: userMessage,
            metadata: { replyToken }
          });
          
          await storage.createChatHistory({
            userId,
            channelType,
            channelId,
            agentId,
            messageType: 'assistant',
            content: aiResponse,
            metadata: { modelUsed: 'gpt-4o' }
          });
          
          console.log('💾 Saved chat history for user', userId);
        } catch (historyError) {
          console.error('⚠️ Error saving chat history:', historyError);
        }

        // Send reply to Line
        await sendLineReply(replyToken, aiResponse, channelAccessToken);
        
        return aiResponse;
        
      } catch (vectorError) {
        console.error('⚠️ Vector search failed, falling back to basic context:', vectorError);
        
        // Fallback to basic document context
        documentContext = `\n\nคุณมีเอกสารอ้างอิงต่อไปนี้:\n${fullDocuments.map(doc => 
          `- ${doc.name}: ${doc.summary || doc.content?.substring(0, 500) || 'ไม่มีเนื้อหา'}`
        ).join('\n\n')}`;
      }
    }

    // Build conversation messages including history
    const messages: any[] = [
      {
        role: "system",
        content: `${agent.systemPrompt}${documentContext}

ตอบเป็นภาษาไทยเสมอ เว้นแต่ผู้ใช้จะสื่อสารเป็นภาษาอื่น
ตอบอย่างเป็นมิตรและช่วยเหลือ ให้ข้อมูลที่ถูกต้องและเป็นประโยชน์

คุณสามารถอ้างอิงบทสนทนาก่อนหน้านี้เพื่อให้คำตอบที่ต่อเนื่องและเหมาะสม`
      }
    ];

    // Add chat history
    chatHistory.forEach(msg => {
      messages.push({
        role: msg.messageType === 'user' ? 'user' : 'assistant',
        content: msg.content
      });
    });

    // Add current user message
    messages.push({
      role: "user", 
      content: userMessage
    });

    console.log(`🤖 Sending ${messages.length} messages to OpenAI (including ${chatHistory.length} history messages)`);

    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: messages,
      max_tokens: 1000,
      temperature: 0.7
    });

    const aiResponse = response.choices[0].message.content || "ขออภัย ไม่สามารถประมวลผลคำถามได้ในขณะนี้";

    // Save chat history
    try {
      // Save user message
      await storage.createChatHistory({
        userId,
        channelType,
        channelId,
        agentId,
        messageType: 'user',
        content: userMessage,
        metadata: {}
      });

      // Save assistant response
      await storage.createChatHistory({
        userId,
        channelType,
        channelId,
        agentId,
        messageType: 'assistant',
        content: aiResponse,
        metadata: {}
      });

      console.log(`💾 Saved chat history for user ${userId}`);
    } catch (error) {
      console.error('⚠️ Error saving chat history:', error);
      // Continue even if saving history fails
    }

    return aiResponse;
  } catch (error) {
    console.error('💥 Error getting AI response:', error);
    return "ขออภัย เกิดข้อผิดพลาดในการประมวลผลคำถาม กรุณาลองใหม่อีกครั้ง";
  }
}

// Main webhook handler
export async function handleLineWebhook(req: Request, res: Response) {
  try {
    const signature = req.headers['x-line-signature'] as string;
    const webhookBody: LineWebhookBody = req.body;
    const body = JSON.stringify(webhookBody);
    
    console.log('🔔 Line webhook received');
    console.log('📝 Body:', body);
    
    // Find the Line OA integration by matching the destination (Channel ID)
    const destination = webhookBody.destination;
    console.log('🔍 Debug: Looking for integration with destination:', destination);
    
    // Get all Line OA integrations to find the matching one
    const allIntegrations = await storage.getAllSocialIntegrations();
    console.log('✅ Found', allIntegrations.length, 'total social integrations');
    
    // In Line webhooks, the destination is the Bot's User ID, not Channel ID
    // First try to match by Bot User ID, then fall back to any active integration
    let lineIntegration = allIntegrations.find(integration => 
      integration.type === 'lineoa' && 
      integration.isActive && 
      integration.botUserId === destination
    );
    
    // If no exact match found by Bot User ID, try fallback to any active Line OA integration
    if (!lineIntegration) {
      lineIntegration = allIntegrations.find(integration => 
        integration.type === 'lineoa' && 
        integration.isActive
      );
      if (lineIntegration) {
        console.log('🔧 Using fallback matching - found active Line OA integration');
        // Update the Bot User ID for future webhook calls using raw SQL
        try {
          await db.execute(sql`
            UPDATE social_integrations 
            SET bot_user_id = ${destination}, updated_at = NOW() 
            WHERE id = ${lineIntegration.id}
          `);
          console.log('✅ Updated Bot User ID for future webhook calls');
        } catch (error) {
          console.log('⚠️ Could not update Bot User ID:', error);
        }
      }
    }

    if (!lineIntegration) {
      console.log('❌ No active Line OA integration found for destination:', destination);
      return res.status(404).json({ error: 'No active Line OA integration found' });
    }
    
    console.log('✅ Found matching Line OA integration for user:', lineIntegration.userId);
    console.log('🔑 Debug: Channel Access Token available:', !!lineIntegration.channelAccessToken);
    console.log('🔍 Debug: Integration object keys:', Object.keys(lineIntegration));

    // Verify signature
    if (!verifyLineSignature(body, signature, lineIntegration.channelSecret!)) {
      console.log('❌ Invalid Line signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }
    
    // Process each event
    for (const event of webhookBody.events) {
      if (event.type === 'message' && event.message?.type === 'text') {
        const userMessage = event.message.text!;
        const replyToken = event.replyToken!;
        
        console.log('💬 User message:', userMessage);
        console.log('👤 User ID:', event.source.userId);
        
        // Get AI response with chat history
        if (lineIntegration.agentId) {
          const aiResponse = await getAiResponse(
            userMessage, 
            lineIntegration.agentId, 
            lineIntegration.userId,
            'lineoa',
            event.source.userId, // Use Line user ID as channel identifier
            replyToken,
            lineIntegration.channelAccessToken!
          );
          console.log('🤖 AI response:', aiResponse);
          
          // Send reply to Line using stored access token
          if (lineIntegration.channelAccessToken) {
            await sendLineReply(replyToken, aiResponse, lineIntegration.channelAccessToken);
          } else {
            console.log('❌ No channel access token available for Line integration');
            // Send a basic reply using channel secret as fallback (this won't work in production)
            await sendLineReply(replyToken, "ขออภัย ระบบยังไม่ได้ตั้งค่า access token กรุณาติดต่อผู้ดูแลระบบ", lineIntegration.channelSecret!);
          }
        } else {
          await sendLineReply(replyToken, "ขออภัย ระบบยังไม่ได้เชื่อมต่อกับ AI Agent กรุณาติดต่อผู้ดูแลระบบ", lineIntegration.channelSecret!);
        }
      }
    }
    
    res.status(200).json({ status: 'ok' });
  } catch (error) {
    console.error('💥 Line webhook error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}