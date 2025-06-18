import fs from "fs";
import path from "path";
import mammoth from "mammoth";
import textract from "textract";
import { processDocument as aiProcessDocument } from "./openai";
import { vectorService } from "./vectorService";
import { storage } from "../storage";

export class DocumentProcessor {
  async processDocument(documentId: number): Promise<void> {
    try {
      const document = await storage.getDocument(documentId, "");
      if (!document) {
        throw new Error("Document not found");
      }

      const content = await this.extractTextFromFile(document.filePath, document.mimeType);
      
      // Process with AI for summary and tags
      const { summary, tags } = await aiProcessDocument(document.filePath, document.mimeType);
      
      // Update document with extracted content
      await storage.updateDocument(documentId, {
        content,
        summary,
        tags,
        processedAt: new Date(),
      }, document.userId);

      // Add to vector database if content exists
      if (content && content.trim().length > 0) {
        await vectorService.addDocument(
          documentId.toString(),
          content,
          {
            userId: document.userId,
            documentName: document.name,
            mimeType: document.mimeType,
            tags: tags || [],
          }
        );
      }

      console.log(`Document ${documentId} processed successfully`);
    } catch (error) {
      console.error(`Error processing document ${documentId}:`, error);
      throw error;
    }
  }

  private async extractTextFromFile(filePath: string, fileType: string): Promise<string> {
    try {
      switch (fileType) {
        case "text/plain":
          return await fs.promises.readFile(filePath, "utf-8");

        case "application/pdf":
          return await this.extractFromPDF(filePath);

        case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
          return await this.extractFromDOCX(filePath);

        case "application/msword":
          return await this.extractWithTextract(filePath);

        case "application/vnd.openxmlformats-officedocument.presentationml.presentation":
        case "application/vnd.ms-powerpoint":
          return await this.extractWithTextract(filePath);

        case "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
        case "application/vnd.ms-excel":
          return await this.extractWithTextract(filePath);

        case "text/csv":
          return await fs.promises.readFile(filePath, "utf-8");

        default:
          if (fileType.startsWith("image/")) {
            // For images, we'll rely on AI processing for OCR
            return await this.extractWithTextract(filePath);
          }
          return await this.extractWithTextract(filePath);
      }
    } catch (error) {
      console.error("Error extracting text:", error);
      return "";
    }
  }

  private async extractFromPDF(filePath: string): Promise<string> {
    try {
      return await this.extractWithTextract(filePath);
    } catch (error) {
      console.error("PDF extraction error:", error);
      return "";
    }
  }

  private async extractFromDOCX(filePath: string): Promise<string> {
    try {
      const result = await mammoth.extractRawText({ path: filePath });
      return result.value;
    } catch (error) {
      console.error("DOCX extraction error:", error);
      throw new Error("Failed to extract text from DOCX");
    }
  }

  private async extractWithTextract(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      textract.fromFileWithPath(filePath, (error: any, text: string) => {
        if (error) {
          console.error("Textract extraction error:", error);
          reject(new Error("Failed to extract text with textract"));
        } else {
          resolve(text || "");
        }
      });
    });
  }

  private getCategoryColor(category: string): string {
    const colors = {
      "document": "#3B82F6",
      "image": "#8B5CF6",
      "text": "#10B981",
      "report": "#F59E0B",
      "contract": "#EF4444",
      "presentation": "#6366F1"
    };
    return colors[category.toLowerCase() as keyof typeof colors] || "#6B7280";
  }

  private getCategoryIcon(category: string): string {
    const icons = {
      "document": "📄",
      "image": "🖼️",
      "text": "📝",
      "report": "📊",
      "contract": "📋",
      "presentation": "📊"
    };
    return icons[category.toLowerCase() as keyof typeof icons] || "📁";
  }
}

export const documentProcessor = new DocumentProcessor();