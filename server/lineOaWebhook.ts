import { Request, Response } from "express";
import OpenAI from "openai";
import { storage } from "./storage";
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

// Get AI response using OpenAI
async function getAiResponse(userMessage: string, agentId: number): Promise<string> {
  try {
    // Get agent configuration
    const agent = await storage.getAgentChatbot(agentId, "system"); // Use system access for webhook
    if (!agent) {
      return "ขออภัย ไม่สามารถเชื่อมต่อกับระบบได้ในขณะนี้";
    }

    // Get agent's documents for context
    const agentDocs = await storage.getAgentChatbotDocuments(agentId, "system");
    let contextPrompt = "";
    
    if (agentDocs.length > 0) {
      contextPrompt = `\n\nคุณมีเอกสารอ้างอิงต่อไปนี้:\n${agentDocs.map(doc => `- Document ID: ${doc.documentId}`).join('\n')}`;
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [
        {
          role: "system",
          content: `${agent.systemPrompt}${contextPrompt}

ตอบเป็นภาษาไทยเสมอ เว้นแต่ผู้ใช้จะสื่อสารเป็นภาษาอื่น
ตอบอย่างเป็นมิตรและช่วยเหลือ ให้ข้อมูลที่ถูกต้องและเป็นประโยชน์`
        },
        {
          role: "user", 
          content: userMessage
        }
      ],
      max_tokens: 1000,
      temperature: 0.7
    });

    return response.choices[0].message.content || "ขออภัย ไม่สามารถประมวลผลคำถามได้ในขณะนี้";
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
    
    const lineIntegration = allIntegrations.find(integration => 
      integration.type === 'lineoa' && 
      integration.isActive && 
      integration.channelId === destination
    );

    if (!lineIntegration) {
      console.log('❌ No active Line OA integration found for destination:', destination);
      return res.status(404).json({ error: 'No active Line OA integration found' });
    }
    
    console.log('✅ Found matching Line OA integration for user:', lineIntegration.userId);

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
        
        // Get AI response
        if (lineIntegration.agentId) {
          const aiResponse = await getAiResponse(userMessage, lineIntegration.agentId);
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