import { Request, Response } from "express";
import OpenAI from "openai";
import { storage } from "./storage";
import { db } from "./db";
import { sql } from "drizzle-orm";
import crypto from "crypto";
import { LineImageService } from "./lineImageService";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface LineMessage {
  type: string;
  id: string;
  text?: string;
  // Image message
  contentProvider?: {
    type: string;
  };
  // Sticker message
  packageId?: string;
  stickerId?: string;
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
function verifyLineSignature(
  body: string,
  signature: string,
  channelSecret: string,
): boolean {
  const hash = crypto
    .createHmac("sha256", channelSecret)
    .update(body)
    .digest("base64");

  return hash === signature;
}

// Send reply message to Line
async function sendLineReply(
  replyToken: string,
  message: string,
  channelAccessToken: string,
) {
  try {
    const response = await fetch("https://api.line.me/v2/bot/message/reply", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${channelAccessToken}`,
      },
      body: JSON.stringify({
        replyToken,
        messages: [
          {
            type: "text",
            text: message,
          },
        ],
      }),
    });

    if (!response.ok) {
      console.error("❌ Line API Error:", await response.text());
      return false;
    }

    console.log("✅ Line reply sent successfully");
    return true;
  } catch (error) {
    console.error("💥 Error sending Line reply:", error);
    return false;
  }
}

// Send push message to Line user (for Human Agent messages)
export async function sendLinePushMessage(
  userId: string,
  message: string,
  channelAccessToken: string,
) {
  try {
    const response = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${channelAccessToken}`,
      },
      body: JSON.stringify({
        to: userId,
        messages: [
          {
            type: "text",
            text: message,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ Line Push API Error:", errorText);
      return false;
    }

    console.log("✅ Line push message sent successfully to:", userId);
    return true;
  } catch (error) {
    console.error("💥 Error sending Line push message:", error);
    return false;
  }
}

// Get AI response using OpenAI with chat history
/**
 * Detect if user message is asking about image content
 */
function isImageRelatedQuery(message: string): boolean {
  const imageKeywords = [
    "รูป",
    "รูปอะไรครับ",
    "ภาพ",
    "รูปภาพ",
    "ภาพถ่าย",
    "image",
    "picture",
    "photo",
    "เห็นอะไร",
    "ในรูป",
    "ในภาพ",
    "อธิบาย",
    "บรรยาย",
    "ดูเหมือน",
    "รูปนี้",
    "ภาพนี้",
    "รูปที่ส่ง",
    "ภาพที่ส่ง",
    "รูปที่แนบ",
    "what's in",
    "describe",
    "tell me about",
    "show",
    "picture",
    "ข้อมูล",
    "รายละเอียด",
    "เนื้อหา",
    "สิ่งที่เห็น",
  ];

  const lowerMessage = message.toLowerCase();
  return imageKeywords.some((keyword) =>
    lowerMessage.includes(keyword.toLowerCase()),
  );
}

/**
 * Extract image analysis from system messages
 */
function extractImageAnalysis(messages: any[]): string {
  const systemMessages = messages.filter(
    (msg) =>
      msg.messageType === "system" &&
      msg.metadata?.messageType === "image_analysis",
  );

  if (systemMessages.length === 0) {
    return "";
  }

  let imageContext = "\n=== การวิเคราะห์รูปภาพที่ส่งมาก่อนหน้า ===\n";

  // Get the most recent image analyses (last 3)
  const recentAnalyses = systemMessages.slice(-3);

  recentAnalyses.forEach((msg, index) => {
    const analysisContent = msg.content.replace("[การวิเคราะห์รูปภาพ] ", "");
    imageContext += `\n--- รูปภาพที่ ${index + 1} ---\n${analysisContent}\n`;
  });

  return imageContext;
}

// New function to get AI response without saving chat history (to prevent duplicates)
async function getAiResponseDirectly(
  userMessage: string,
  agentId: number,
  userId: string,
  channelType: string,
  channelId: string,
): Promise<string> {
  try {
    console.log(`🔍 Debug: Getting agent ${agentId} for user ${userId}`);

    // Get agent configuration
    const agent = await storage.getAgentChatbot(agentId, userId);
    if (!agent) {
      console.log(`❌ Agent ${agentId} not found for user ${userId}`);
      return "ขออภัย ไม่สามารถเชื่อมต่อกับระบบได้ในขณะนี้";
    }

    console.log(`✅ Found agent: ${agent.name}`);

    // Check if this is an image-related query
    const isImageQuery = isImageRelatedQuery(userMessage);
    console.log(`🖼️ Image-related query detected: ${isImageQuery}`);
    console.log(`🔍 User message for analysis: "${userMessage}"`);

    // Get chat history if memory is enabled using new memory strategy
    let chatHistory: any[] = [];
    if (agent.memoryEnabled) {
      const memoryLimit = agent.memoryLimit || 10;
      console.log(
        `📚 Fetching chat history with memory strategy (limit: ${memoryLimit})`,
      );

      try {
        // Use new memory strategy that includes ALL message types
        chatHistory = await storage.getChatHistoryWithMemoryStrategy(
          userId,
          channelType,
          channelId,
          agentId,
          memoryLimit,
        );
        console.log(
          `📝 Found ${chatHistory.length} previous messages (all types included)`,
        );
      } catch (error) {
        console.error("⚠️ Error fetching chat history:", error);
        // Fallback to original method if new method fails
        try {
          chatHistory = await storage.getChatHistory(
            userId,
            channelType,
            channelId,
            agentId,
            memoryLimit,
          );
          console.log(
            `📝 Fallback: Found ${chatHistory.length} previous messages`,
          );
        } catch (fallbackError) {
          console.error("⚠️ Fallback error:", fallbackError);
        }
      }
    }

    // Get agent's documents for context with actual content
    const agentDocs = await storage.getAgentChatbotDocuments(agentId, userId);
    let contextPrompt = "";

    if (agentDocs.length > 0) {
      console.log(`📚 Found ${agentDocs.length} documents for agent`);

      // Get actual document content for each linked document
      const documentContents: string[] = [];
      for (const agentDoc of agentDocs) {
        try {
          const document = await storage.getDocument(
            agentDoc.documentId,
            userId,
          );
          if (document && document.content) {
            // Limit content to first 2000 characters to avoid token limits
            const truncatedContent =
              document.content.length > 2000
                ? document.content.substring(0, 2000) + "..."
                : document.content;

            documentContents.push(
              `=== เอกสาร: ${document.name} ===\n${truncatedContent}\n`,
            );
            console.log(
              `📄 Added document: ${document.name} (${document.content.length} chars)`,
            );
          }
        } catch (error) {
          console.error(
            `❌ Error fetching document ${agentDoc.documentId}:`,
            error,
          );
        }
      }

      if (documentContents.length > 0) {
        contextPrompt = `\n\nเอกสารอ้างอิงสำหรับการตอบคำถาม:\n${documentContents.join("\n")}
        
กรุณาใช้ข้อมูลจากเอกสารข้างต้นเป็นหลักในการตอบคำถาม และระบุแหล่งที่มาของข้อมูลด้วย`;
        console.log(
          `✅ Built context with ${documentContents.length} documents`,
        );
        console.log(
          `📄 Context prompt length: ${contextPrompt.length} characters`,
        );
      } else {
        console.log(`⚠️ No documents found or no content available`);
      }
    }

    // Always extract image analysis from recent chat history to maintain context
    let imageContext = "";
    if (chatHistory.length > 0) {
      imageContext = extractImageAnalysis(chatHistory);
      console.log(
        `📸 Image context extracted: ${imageContext.length} characters`,
      );
      if (imageContext) {
        console.log(
          `✅ Image analysis found: ${imageContext.substring(0, 100)}...`,
        );
      } else {
        console.log(`ℹ️ No recent image analysis found in chat history`);
      }
    }

    // Build conversation messages including history
    const messages: any[] = [
      {
        role: "system",
        content: `${agent.systemPrompt}${contextPrompt}

ตอบเป็นภาษาไทยเสมอ เว้นแต่ผู้ใช้จะสื่อสารเป็นภาษาอื่น
ตอบอย่างเป็นมิตรและช่วยเหลือ ให้ข้อมูลที่ถูกต้องและเป็นประโยชน์

คุณสามารถอ้างอิงบทสนทนาก่อนหน้านี้เพื่อให้คำตอบที่ต่อเนื่องและเหมาะสม`,
      },
    ];

    // Add chat history (exclude system messages from conversation flow)
    const userBotMessages = chatHistory.filter(
      (msg) => msg.messageType === "user" || msg.messageType === "assistant",
    );

    userBotMessages.forEach((msg) => {
      messages.push({
        role: msg.messageType === "user" ? "user" : "assistant",
        content: msg.content,
      });
    });

    // Add current user message with image context attached if available
    let enhancedUserMessage = userMessage;
    if (imageContext) {
      enhancedUserMessage = `${userMessage}

${imageContext}`;
      console.log(
        `🖼️ Enhanced user message with image context (${imageContext.length} chars)`,
      );
    }

    messages.push({
      role: "user",
      content: enhancedUserMessage,
    });

    console.log(
      `🤖 Sending ${messages.length} messages to OpenAI (including ${chatHistory.length} history messages)`,
    );

    // Debug: Log the complete system prompt for verification
    console.log("\n=== 🔍 DEBUG: Complete System Prompt ===");
    console.log(messages[0].content);
    console.log("=== End System Prompt ===\n");

    // Debug: Log user message
    console.log(`📝 User Message: "${userMessage}"`);

    // Debug: Log total prompt length
    const totalTokens = messages.reduce(
      (sum, msg) => sum + msg.content.length,
      0,
    );
    console.log(`📊 Total prompt length: ${totalTokens} characters`);

    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: messages,
      max_tokens: 1000,
      temperature: 0.7,
    });

    const aiResponse =
      response.choices[0].message.content ||
      "ขออภัย ไม่สามารถประมวลผลคำถามได้ในขณะนี้";

    // NOTE: Chat history saving is now handled by the calling function to prevent duplicates
    console.log(
      `🤖 Generated AI response for user ${userId} (${aiResponse.length} characters)`,
    );

    return aiResponse;
  } catch (error) {
    console.error("💥 Error getting AI response:", error);
    return "ขออภัย เกิดข้อผิดพลาดในการประมวลผลคำถาม กรุณาลองใหม่อีกครั้ง";
  }
}

// Store processed message IDs to prevent duplicates with timestamp for cleanup
const processedMessageIds = new Map<string, number>();

// Clean up old processed message IDs (older than 1 hour)
const cleanupProcessedMessages = () => {
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  for (const [messageId, timestamp] of processedMessageIds.entries()) {
    if (timestamp < oneHourAgo) {
      processedMessageIds.delete(messageId);
    }
  }
};

// Schedule cleanup every 30 minutes
setInterval(cleanupProcessedMessages, 30 * 60 * 1000);

// Main webhook handler
export async function handleLineWebhook(req: Request, res: Response) {
  try {
    const signature = req.headers["x-line-signature"] as string;
    const webhookBody: LineWebhookBody = req.body;
    const body = JSON.stringify(webhookBody);

    console.log("🔔 Line webhook received");
    console.log("📝 Body:", body);

    // Find the Line OA integration by matching the destination (Channel ID)
    const destination = webhookBody.destination;
    console.log(
      "🔍 Debug: Looking for integration with destination:",
      destination,
    );

    // Get all Line OA integrations to find the matching one
    const allIntegrations = await storage.getAllSocialIntegrations();
    console.log(
      "✅ Found",
      allIntegrations.length,
      "total social integrations",
    );

    // In Line webhooks, the destination is the Bot's User ID, not Channel ID
    // First try to match by Bot User ID, then fall back to any active integration
    let lineIntegration = allIntegrations.find(
      (integration) =>
        integration.type === "lineoa" &&
        integration.isActive &&
        integration.botUserId === destination,
    );

    // If no exact match found by Bot User ID, try fallback to any active Line OA integration
    if (!lineIntegration) {
      lineIntegration = allIntegrations.find(
        (integration) => integration.type === "lineoa" && integration.isActive,
      );
      if (lineIntegration) {
        console.log(
          "🔧 Using fallback matching - found active Line OA integration",
        );
        // Update the Bot User ID for future webhook calls using raw SQL
        try {
          await db.execute(sql`
            UPDATE social_integrations 
            SET bot_user_id = ${destination}, updated_at = NOW() 
            WHERE id = ${lineIntegration.id}
          `);
          console.log("✅ Updated Bot User ID for future webhook calls");
        } catch (error) {
          console.log("⚠️ Could not update Bot User ID:", error);
        }
      }
    }

    if (!lineIntegration) {
      console.log(
        "❌ No active Line OA integration found for destination:",
        destination,
      );
      return res
        .status(404)
        .json({ error: "No active Line OA integration found" });
    }

    console.log(
      "✅ Found matching Line OA integration for user:",
      lineIntegration.userId,
    );
    console.log(
      "🔑 Debug: Channel Access Token available:",
      !!lineIntegration.channelAccessToken,
    );
    console.log(
      "🔍 Debug: Integration object keys:",
      Object.keys(lineIntegration),
    );

    // Verify signature
    if (!verifyLineSignature(body, signature, lineIntegration.channelSecret!)) {
      console.log("❌ Invalid Line signature");
      return res.status(401).json({ error: "Invalid signature" });
    }

    // Process each event
    for (const event of webhookBody.events) {
      if (event.type === "message" && event.message) {
        const message = event.message;
        const replyToken = event.replyToken!;
        let userMessage = "";
        let messageMetadata: any = {};

        console.log("📱 Message type:", message.type);
        console.log("👤 User ID:", event.source.userId);

        // Handle different message types
        if (message.type === "text") {
          userMessage = message.text!;
          console.log("💬 Text message:", userMessage);
        } else if (message.type === "image") {
          userMessage = "[รูปภาพ]";

          // For Line images, construct content URLs using messageId and Channel Access Token
          const originalContentUrl = `https://api-data.line.me/v2/bot/message/${message.id}/content`;
          const previewImageUrl = `https://api-data.line.me/v2/bot/message/${message.id}/content/preview`;

          messageMetadata = {
            messageType: "image",
            messageId: message.id,
            contentProvider: message.contentProvider,
            originalContentUrl,
            previewImageUrl,
          };
          console.log("🖼️ Image message received, ID:", message.id);
          console.log("🔗 Image URLs:", {
            originalContentUrl,
            previewImageUrl,
          });
        } else if (message.type === "sticker") {
          userMessage = "[สติ๊กเกอร์]";
          messageMetadata = {
            messageType: "sticker",
            packageId: message.packageId,
            stickerId: message.stickerId,
          };
          console.log(
            "😀 Sticker message received, Package:",
            message.packageId,
            "Sticker:",
            message.stickerId,
          );
        } else {
          // Handle other message types (video, audio, location, etc.)
          userMessage = `[${message.type}]`;
          messageMetadata = {
            messageType: message.type,
            messageId: message.id,
          };
          console.log("📎 Other message type:", message.type);
        }

        // Check if this message has already been processed
        const messageId = message.id;
        if (processedMessageIds.has(messageId)) {
          console.log(`⚠️ Message ${messageId} already processed, skipping...`);
          continue;
        }

        // Mark message as processed with timestamp
        processedMessageIds.set(messageId, Date.now());
        console.log(`✅ Processing new message ${messageId}`);

        // Save user message with metadata
        let chatHistoryId: number | null = null;
        try {
          const savedChatHistory = await storage.createChatHistory({
            userId: lineIntegration.userId,
            channelType: "lineoa",
            channelId: event.source.userId,
            agentId: lineIntegration.agentId!,
            messageType: "user",
            content: userMessage,
            metadata: messageMetadata,
          });
          chatHistoryId = savedChatHistory.id;
          console.log(
            "💾 Saved user message with metadata, ID:",
            chatHistoryId,
          );
        } catch (error) {
          console.error("⚠️ Error saving user message:", error);
        }

        // Get AI response with chat history (only for text messages or provide context for multimedia)
        if (lineIntegration.agentId) {
          let contextMessage = userMessage;
          let imageAnalysisResult = "";
          
          // Process image download and analysis SYNCHRONOUSLY if it's an image message
          if (
            message.type === "image" &&
            chatHistoryId &&
            lineIntegration.channelAccessToken
          ) {
            console.log("🖼️ Starting synchronous image processing...");
            const imageService = LineImageService.getInstance();

            try {
              // Wait for image processing to complete before proceeding
              await imageService.processImageMessage(
                message.id,
                lineIntegration.channelAccessToken,
                lineIntegration.userId,
                "lineoa",
                event.source.userId,
                lineIntegration.agentId!,
                chatHistoryId,
              );
              console.log("✅ Image processing completed successfully");
              
              // Get the image analysis from the updated chat history
              const updatedChatHistory = await storage.getChatHistory(
                lineIntegration.userId,
                "lineoa",
                event.source.userId,
                lineIntegration.agentId!,
                5 // Get last 5 messages to find the image analysis
              );
              
              // Find the most recent image analysis
              const imageAnalysisMessage = updatedChatHistory.find(msg => 
                msg.messageType === 'system' && 
                msg.metadata?.messageType === 'image_analysis'
              );
              
              if (imageAnalysisMessage) {
                imageAnalysisResult = imageAnalysisMessage.content.replace('[การวิเคราะห์รูปภาพ] ', '');
                console.log(`🔍 Found image analysis: ${imageAnalysisResult.substring(0, 100)}...`);
                
                // Use image analysis as context for AI response
                contextMessage = `ผู้ใช้ส่งรูปภาพมา นี่คือผลการวิเคราะห์รูปภาพ:

${imageAnalysisResult}

กรุณาตอบรับรูปภาพและให้ข้อมูลเกี่ยวกับสิ่งที่เห็นในรูป พร้อมถามว่ามีอะไรให้ช่วยเหลือ`;
              } else {
                contextMessage = "ผู้ใช้ส่งรูปภาพมา แต่ไม่สามารถวิเคราะห์รูปภาพได้ กรุณาตอบรับรูปภาพและสอบถามว่า user มีอะไรให้ช่วย";
              }
            } catch (error) {
              console.error("⚠️ Error processing image message:", error);
              contextMessage = "ผู้ใช้ส่งรูปภาพมา แต่เกิดข้อผิดพลาดในการประมวลผล กรุณาขออภัยและถามว่ามีอะไรให้ช่วย";
            }
          } else if (message.type === "sticker") {
            contextMessage = "ผู้ใช้ส่งสติ๊กเกอร์มา กรุณาตอบอย่างเป็นมิตรและถามว่ามีอะไรให้ช่วย";
          }

          // Get AI response WITHOUT saving history (it's already handled in getAiResponse)
          const aiResponse = await getAiResponseDirectly(
            contextMessage,
            lineIntegration.agentId,
            lineIntegration.userId,
            "lineoa",
            event.source.userId, // Use Line user ID as channel identifier
          );
          console.log("🤖 AI response:", aiResponse);

          // Save only the assistant response (user message already saved above)
          try {
            await storage.createChatHistory({
              userId: lineIntegration.userId,
              channelType: "lineoa",
              channelId: event.source.userId,
              agentId: lineIntegration.agentId,
              messageType: "assistant",
              content: aiResponse,
              metadata: {},
            });
            console.log("💾 Saved AI response to chat history");

            // Broadcast new message to Agent Console via WebSocket
            if (typeof (global as any).broadcastToAgentConsole === "function") {
              (global as any).broadcastToAgentConsole({
                type: "new_message",
                data: {
                  userId: lineIntegration.userId,
                  channelType: "lineoa",
                  channelId: event.source.userId,
                  agentId: lineIntegration.agentId,
                  userMessage: contextMessage,
                  aiResponse,
                  timestamp: new Date().toISOString(),
                },
              });
              console.log("📡 Broadcasted new message to Agent Console");
            }
          } catch (error) {
            console.error("⚠️ Error saving AI response:", error);
          }

          // Send reply to Line using stored access token
          if (lineIntegration.channelAccessToken) {
            await sendLineReply(
              replyToken,
              aiResponse,
              lineIntegration.channelAccessToken,
            );
          } else {
            console.log(
              "❌ No channel access token available for Line integration",
            );
            await sendLineReply(
              replyToken,
              "ขออภัย ระบบยังไม่ได้ตั้งค่า access token กรุณาติดต่อผู้ดูแลระบบ",
              lineIntegration.channelSecret!,
            );
          }
        } else {
          await sendLineReply(
            replyToken,
            "ขออภัย ระบบยังไม่ได้เชื่อมต่อกับ AI Agent กรุณาติดต่อผู้ดูแลระบบ",
            lineIntegration.channelSecret!,
          );
        }
      }
    }

    res.status(200).json({ status: "ok" });
  } catch (error) {
    console.error("💥 Line webhook error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}
