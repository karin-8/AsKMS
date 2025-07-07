import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { storage } from './storage';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export class LineImageService {
  private static instance: LineImageService;
  private uploadsDir: string;

  private constructor() {
    this.uploadsDir = path.join(process.cwd(), 'uploads', 'line-images');
    this.ensureUploadDir();
  }

  public static getInstance(): LineImageService {
    if (!LineImageService.instance) {
      LineImageService.instance = new LineImageService();
    }
    return LineImageService.instance;
  }

  private ensureUploadDir() {
    if (!fs.existsSync(this.uploadsDir)) {
      fs.mkdirSync(this.uploadsDir, { recursive: true });
      console.log('📁 Created Line images upload directory:', this.uploadsDir);
    }
  }

  /**
   * Download image from Line Content API and save to local storage
   */
  async downloadAndSaveImage(messageId: string, channelAccessToken: string): Promise<string | null> {
    try {
      console.log('🔄 Downloading image from Line Content API, Message ID:', messageId);
      
      const response = await axios.get(
        `https://api-data.line.me/v2/bot/message/${messageId}/content`,
        {
          headers: {
            'Authorization': `Bearer ${channelAccessToken}`,
          },
          responseType: 'arraybuffer', // Important for binary data
          timeout: 30000 // 30 seconds timeout
        }
      );

      if (response.status === 200) {
        // Determine file extension from content type
        const contentType = response.headers['content-type'] || '';
        let fileExtension = '.jpg'; // Default
        
        if (contentType.includes('png')) {
          fileExtension = '.png';
        } else if (contentType.includes('gif')) {
          fileExtension = '.gif';
        } else if (contentType.includes('webp')) {
          fileExtension = '.webp';
        }

        // Create filename with timestamp to avoid conflicts
        const timestamp = Date.now();
        const filename = `line_${messageId}_${timestamp}${fileExtension}`;
        const filePath = path.join(this.uploadsDir, filename);

        // Save binary data to file
        fs.writeFileSync(filePath, response.data);
        
        console.log('✅ Image saved successfully:', filename);
        console.log('📊 Image size:', response.data.length, 'bytes');
        console.log('📄 Content type:', contentType);

        // Return relative URL that can be served by Express
        return `/uploads/line-images/${filename}`;
      } else {
        console.error('❌ Failed to download image, Status:', response.status);
        return null;
      }
    } catch (error) {
      console.error('💥 Error downloading image from Line:', error);
      if (axios.isAxiosError(error)) {
        console.error('🔍 Axios error details:', {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data
        });
      }
      return null;
    }
  }

  /**
   * Analyze image with OpenAI GPT-4o Vision
   */
  async analyzeImageWithGPT4o(imageUrl: string): Promise<string | null> {
    try {
      console.log('🔍 Analyzing image with GPT-4o Vision:', imageUrl);
      
      // Convert local file path to full URL for OpenAI
      const fullImageUrl = imageUrl.startsWith('http') 
        ? imageUrl 
        : `file://${path.join(process.cwd(), imageUrl.replace('/uploads/', 'uploads/'))}`;
      
      // Read image as base64 for OpenAI
      const imagePath = path.join(process.cwd(), imageUrl.replace('/uploads/', 'uploads/'));
      const imageBuffer = fs.readFileSync(imagePath);
      const base64Image = imageBuffer.toString('base64');
      
      const response = await openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "กรุณาวิเคราะห์รูปภาพนี้อย่างละเอียด โดยบอกสิ่งที่เห็นในรูป รวมถึงข้อความ ตัวเลข หรือข้อมูลสำคัญที่อาจมีในรูป ตอบเป็นภาษาไทยและให้รายละเอียดครบถ้วน"
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${base64Image}`
                }
              }
            ]
          }
        ],
        max_tokens: 1000
      });

      const analysis = response.choices[0].message.content;
      console.log('✅ Image analysis completed:', analysis?.substring(0, 100) + '...');
      return analysis;
    } catch (error) {
      console.error('💥 Error analyzing image with GPT-4o:', error);
      return null;
    }
  }

  /**
   * Process image message and update chat history with image URL and analysis
   */
  async processImageMessage(
    messageId: string,
    channelAccessToken: string,
    userId: string,
    channelType: string,
    channelId: string,
    agentId: number,
    chatHistoryId: number
  ): Promise<void> {
    try {
      console.log('🖼️ Processing image message:', messageId);
      
      // Download and save image
      const imageUrl = await this.downloadAndSaveImage(messageId, channelAccessToken);
      
      if (imageUrl) {
        console.log('🔍 Starting image analysis with GPT-4o...');
        
        // Analyze image with GPT-4o
        const imageAnalysis = await this.analyzeImageWithGPT4o(imageUrl);
        
        // Update chat history with image URL and analysis
        const updatedMetadata = {
          messageType: 'image',
          messageId: messageId,
          contentProvider: { type: 'line' },
          originalContentUrl: imageUrl,
          previewImageUrl: imageUrl, // Use same URL for preview
          downloadedAt: new Date().toISOString(),
          imageAnalysis: imageAnalysis // Add GPT-4o analysis
        };

        await storage.updateChatHistoryMetadata(chatHistoryId, updatedMetadata);
        console.log('✅ Updated chat history with image URL and analysis');
        
        // Also save the analysis as a separate chat message for context
        if (imageAnalysis) {
          await storage.createChatHistory({
            userId: userId,
            channelType: channelType,
            channelId: channelId,
            agentId: agentId,
            messageType: 'system',
            content: `[การวิเคราะห์รูปภาพ] ${imageAnalysis}`,
            metadata: {
              messageType: 'image_analysis',
              relatedImageMessageId: messageId,
              isSystemGenerated: true
            }
          });
          console.log('📝 Saved image analysis as system message for AI context');
        }
      } else {
        console.log('❌ Failed to download image, keeping original metadata');
      }
    } catch (error) {
      console.error('💥 Error processing image message:', error);
    }
  }

  /**
   * Clean up old images (optional maintenance function)
   */
  async cleanupOldImages(daysOld: number = 30): Promise<void> {
    try {
      const files = fs.readdirSync(this.uploadsDir);
      const cutoffTime = Date.now() - (daysOld * 24 * 60 * 60 * 1000);
      
      let deletedCount = 0;
      
      for (const file of files) {
        const filePath = path.join(this.uploadsDir, file);
        const stats = fs.statSync(filePath);
        
        if (stats.mtime.getTime() < cutoffTime) {
          fs.unlinkSync(filePath);
          deletedCount++;
        }
      }
      
      console.log(`🧹 Cleaned up ${deletedCount} old Line images`);
    } catch (error) {
      console.error('⚠️ Error cleaning up old images:', error);
    }
  }
}