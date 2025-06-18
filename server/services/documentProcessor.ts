import { storage } from "../storage";
import { openaiService } from "./openai";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Document processing utilities
import mammoth from "mammoth";

export class DocumentProcessor {
  async processDocument(documentId: number): Promise<void> {
    try {
      const document = await storage.getDocument(documentId);
      if (!document) {
        throw new Error("Document not found");
      }

      // Update status to processing
      await storage.updateDocument(documentId, { status: "processing" });

      // Extract text content
      const content = await this.extractTextFromFile(document.filePath, document.fileType);
      
      // Classify document using AI
      const classification = await openaiService.classifyDocument(content, document.originalName);
      
      // Find or create category
      const categories = await storage.getCategories();
      let category = categories.find(c => c.name.toLowerCase() === classification.category.toLowerCase());
      
      if (!category) {
        category = await storage.createCategory({
          name: classification.category,
          description: `Auto-created category for ${classification.category} documents`,
          color: this.getCategoryColor(classification.category),
          icon: this.getCategoryIcon(classification.category),
        });
      }

      // Update document with extracted content and classification
      await storage.updateDocument(documentId, {
        content,
        summary: classification.summary,
        categoryId: category.id,
        tags: classification.tags,
        status: "processed",
        processedAt: new Date(),
        metadata: {
          classification,
          processingDate: new Date().toISOString(),
        },
      });

      console.log(`Document ${documentId} processed successfully`);
    } catch (error) {
      console.error(`Error processing document ${documentId}:`, error);
      
      // Update status to failed
      await storage.updateDocument(documentId, { 
        status: "failed",
        metadata: {
          error: error instanceof Error ? error.message : "Unknown error",
          failedAt: new Date().toISOString(),
        },
      });
    }
  }

  private async extractTextFromFile(filePath: string, fileType: string): Promise<string> {
    try {
      const buffer = fs.readFileSync(filePath);

      switch (fileType) {
        case "application/pdf":
          // For now, return a placeholder for PDF processing
          // In production, you would use a proper PDF parser
          return "PDF content extraction - requires implementation";

        case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
          const docxResult = await mammoth.extractRawText({ buffer });
          return docxResult.value;

        case "text/plain":
        case "text/csv":
        case "application/json":
          return buffer.toString("utf-8");

        default:
          // For other file types, try to read as text
          try {
            return buffer.toString("utf-8");
          } catch {
            return "Content extraction not supported for this file type";
          }
      }
    } catch (error) {
      console.error("Error extracting text from file:", error);
      return "Failed to extract text content";
    }
  }

  private getCategoryColor(category: string): string {
    const colorMap: Record<string, string> = {
      financial: "#3b82f6",
      legal: "#10b981",
      technical: "#f59e0b",
      hr: "#8b5cf6",
      marketing: "#ef4444",
      operations: "#06b6d4",
      research: "#84cc16",
      other: "#6b7280",
    };

    return colorMap[category.toLowerCase()] || "#6b7280";
  }

  private getCategoryIcon(category: string): string {
    const iconMap: Record<string, string> = {
      financial: "chart-line",
      legal: "file-contract",
      technical: "cogs",
      hr: "users",
      marketing: "bullhorn",
      operations: "clipboard-list",
      research: "flask",
      other: "file",
    };

    return iconMap[category.toLowerCase()] || "file";
  }
}

export const documentProcessor = new DocumentProcessor();
