import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { storage } from './storage';

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
   * Process image message and update chat history with image URL
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
        // Update chat history with image URL
        const updatedMetadata = {
          messageType: 'image',
          messageId: messageId,
          contentProvider: { type: 'line' },
          originalContentUrl: imageUrl,
          previewImageUrl: imageUrl, // Use same URL for preview
          downloadedAt: new Date().toISOString()
        };

        await storage.updateChatHistoryMetadata(chatHistoryId, updatedMetadata);
        console.log('✅ Updated chat history with image URL:', imageUrl);
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