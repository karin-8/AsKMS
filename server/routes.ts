import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { insertCategorySchema, insertDocumentSchema, insertChatConversationSchema, insertChatMessageSchema, type Document as DocType } from "@shared/schema";
import { z } from "zod";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import { processDocument, generateChatResponse } from "./services/openai";
import { documentProcessor } from "./services/documentProcessor";
import { vectorService } from "./services/vectorService";

// File upload configuration
const uploadDir = path.join(process.cwd(), "uploads");

// Ensure upload directory exists
const ensureUploadDir = async () => {
  try {
    await fs.access(uploadDir);
  } catch {
    await fs.mkdir(uploadDir, { recursive: true });
  }
};

const storage_multer = multer.diskStorage({
  destination: async (req, file, cb) => {
    await ensureUploadDir();
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage_multer,
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/msword',
      'application/vnd.ms-excel',
      'application/vnd.ms-powerpoint',
      'text/plain',
      'text/csv',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp'
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Supported: PDF, DOCX, XLSX, PPTX, TXT, CSV, and image files.'));
    }
  },
  limits: {
    fileSize: 25 * 1024 * 1024 // 25MB limit
  }
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // User stats
  app.get('/api/stats', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const stats = await storage.getUserStats(userId);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching stats:", error);
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  // Category routes
  app.get('/api/categories', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const categories = await storage.getCategories(userId);
      res.json(categories);
    } catch (error) {
      console.error("Error fetching categories:", error);
      res.status(500).json({ message: "Failed to fetch categories" });
    }
  });

  app.post('/api/categories', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const categoryData = insertCategorySchema.parse({ ...req.body, userId });
      const category = await storage.createCategory(categoryData);
      res.json(category);
    } catch (error) {
      console.error("Error creating category:", error);
      res.status(500).json({ message: "Failed to create category" });
    }
  });

  app.put('/api/categories/:id', isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const categoryData = insertCategorySchema.partial().parse(req.body);
      const category = await storage.updateCategory(id, categoryData);
      res.json(category);
    } catch (error) {
      console.error("Error updating category:", error);
      res.status(500).json({ message: "Failed to update category" });
    }
  });

  app.delete('/api/categories/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const id = parseInt(req.params.id);
      await storage.deleteCategory(id, userId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting category:", error);
      res.status(500).json({ message: "Failed to delete category" });
    }
  });

  // Document routes
  app.get('/api/documents', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const categoryId = req.query.categoryId ? parseInt(req.query.categoryId as string) : undefined;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
      const offset = req.query.offset ? parseInt(req.query.offset as string) : undefined;
      
      const documents = await storage.getDocuments(userId, { categoryId, limit, offset });
      res.json(documents);
    } catch (error) {
      console.error("Error fetching documents:", error);
      res.status(500).json({ message: "Failed to fetch documents" });
    }
  });

  app.get('/api/documents/search', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const query = req.query.q as string;
      const type = req.query.type as string || 'keyword'; // 'keyword' or 'semantic'
      
      if (!query) {
        return res.status(400).json({ message: "Search query is required" });
      }
      
      let documents: DocType[];
      
      if (type === 'semantic') {
        // Use vector search for semantic similarity
        const vectorResults = await vectorService.searchDocuments(query, userId, 10);
        const documentIds = vectorResults.map(result => parseInt(result.document.id));
        
        if (documentIds.length > 0) {
          const allDocuments = await storage.getDocuments(userId, { limit: 50 });
          documents = allDocuments.filter(doc => documentIds.includes(doc.id))
            .sort((a, b) => {
              const aIndex = documentIds.indexOf(a.id);
              const bIndex = documentIds.indexOf(b.id);
              return aIndex - bIndex;
            }) as DocType[];
        } else {
          documents = [] as DocType[];
        }
      } else {
        // Use keyword search
        documents = await storage.searchDocuments(userId, query);
      }
      
      res.json(documents);
    } catch (error) {
      console.error("Error searching documents:", error);
      res.status(500).json({ message: "Failed to search documents" });
    }
  });

  app.get('/api/documents/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const id = parseInt(req.params.id);
      const document = await storage.getDocument(id, userId);
      
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }
      
      // Log access
      await storage.logDocumentAccess(id, userId, 'view');
      res.json(document);
    } catch (error) {
      console.error("Error fetching document:", error);
      res.status(500).json({ message: "Failed to fetch document" });
    }
  });

  app.get('/api/documents/:id/summary', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const id = parseInt(req.params.id);
      const document = await storage.getDocument(id, userId);
      
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }
      
      // Return existing summary or content excerpt
      const summary = document.summary || (document.content ? 
        document.content.substring(0, 500) + "..." : 
        "No content summary available for this document.");
      
      res.json({ summary });
    } catch (error) {
      console.error("Error fetching document summary:", error);
      res.status(500).json({ message: "Failed to fetch document summary" });
    }
  });

  app.post('/api/documents/upload', isAuthenticated, upload.array('files', 10), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const files = req.files as Express.Multer.File[];
      
      console.log('Upload request received:', {
        userId,
        filesCount: files?.length || 0,
        bodyKeys: Object.keys(req.body || {}),
        hasFiles: !!files
      });
      
      if (!files || files.length === 0) {
        console.log('No files in request, body:', req.body);
        return res.status(400).json({ message: "No files uploaded" });
      }

      const uploadedDocuments = [];

      for (const file of files) {
        try {
          // Process the document with enhanced AI classification
          const { content, summary, tags, category, categoryColor } = await processDocument(file.path, file.mimetype);
          
          const documentData = {
            name: file.originalname,
            fileName: file.filename,
            filePath: file.path,
            fileSize: file.size,
            mimeType: file.mimetype,
            content,
            summary,
            tags,
            aiCategory: category,
            aiCategoryColor: categoryColor,
            userId,
            processedAt: new Date(),
          };

          const document = await storage.createDocument(documentData);
          uploadedDocuments.push(document);
          
          console.log(`Document processed: ${file.originalname} -> Category: ${category}, Tags: ${tags?.join(', ')}`);
        } catch (error) {
          console.error(`Error processing file ${file.originalname}:`, error);
          // Still create document without AI processing
          const documentData = {
            name: file.originalname,
            fileName: file.filename,
            filePath: file.path,
            fileSize: file.size,
            mimeType: file.mimetype,
            aiCategory: "Uncategorized",
            aiCategoryColor: "#6B7280",
            userId,
          };
          const document = await storage.createDocument(documentData);
          uploadedDocuments.push(document);
        }
      }

      res.json(uploadedDocuments);
    } catch (error) {
      console.error("Error uploading documents:", error);
      res.status(500).json({ message: "Failed to upload documents" });
    }
  });

  app.put('/api/documents/:id/favorite', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const id = parseInt(req.params.id);
      const document = await storage.toggleDocumentFavorite(id, userId);
      res.json(document);
    } catch (error) {
      console.error("Error toggling favorite:", error);
      res.status(500).json({ message: "Failed to toggle favorite" });
    }
  });

  app.delete('/api/documents/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const id = parseInt(req.params.id);
      
      // Get document to delete file
      const document = await storage.getDocument(id, userId);
      if (document) {
        try {
          await fs.unlink(document.filePath);
        } catch (error) {
          console.error("Error deleting file:", error);
        }
      }
      
      await storage.deleteDocument(id, userId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting document:", error);
      res.status(500).json({ message: "Failed to delete document" });
    }
  });

  // Chat routes
  app.get('/api/chat/conversations', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const conversations = await storage.getChatConversations(userId);
      res.json(conversations);
    } catch (error) {
      console.error("Error fetching conversations:", error);
      res.status(500).json({ message: "Failed to fetch conversations" });
    }
  });

  app.post('/api/chat/conversations', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const conversationData = insertChatConversationSchema.parse({ ...req.body, userId });
      const conversation = await storage.createChatConversation(conversationData);
      res.json(conversation);
    } catch (error) {
      console.error("Error creating conversation:", error);
      res.status(500).json({ message: "Failed to create conversation" });
    }
  });

  app.get('/api/chat/conversations/:id/messages', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const conversationId = parseInt(req.params.id);
      const messages = await storage.getChatMessages(conversationId, userId);
      res.json(messages);
    } catch (error) {
      console.error("Error fetching messages:", error);
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });

  app.post('/api/chat/messages', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { conversationId, content } = req.body;
      
      // Create user message
      const userMessage = await storage.createChatMessage({
        conversationId,
        role: 'user',
        content,
      });

      // Get user's documents for context
      const documents = await storage.getDocuments(userId, { limit: 100 });
      
      // Generate AI response
      const aiResponse = await generateChatResponse(content, documents);
      
      // Create assistant message
      const assistantMessage = await storage.createChatMessage({
        conversationId,
        role: 'assistant',
        content: aiResponse,
      });

      res.json([userMessage, assistantMessage]);
    } catch (error) {
      console.error("Error processing chat message:", error);
      res.status(500).json({ message: "Failed to process chat message" });
    }
  });

  // Vector database management routes
  app.get('/api/vector/stats', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const userDocuments = vectorService.getDocumentsByUser(userId);
      const totalDocuments = vectorService.getDocumentCount();
      
      res.json({
        userDocuments: userDocuments.length,
        totalDocuments,
        vectorized: userDocuments.map(doc => ({
          id: doc.id,
          name: doc.metadata.documentName,
          type: doc.metadata.mimeType
        }))
      });
    } catch (error) {
      console.error("Error getting vector stats:", error);
      res.status(500).json({ message: "Failed to get vector database stats" });
    }
  });

  app.post('/api/documents/:id/reprocess', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const documentId = parseInt(req.params.id);
      
      const document = await storage.getDocument(documentId, userId);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }
      
      // Remove from vector database first
      await vectorService.removeDocument(documentId.toString());
      
      // Reprocess document
      await documentProcessor.processDocument(documentId);
      
      res.json({ message: "Document reprocessed successfully" });
    } catch (error) {
      console.error("Error reprocessing document:", error);
      res.status(500).json({ message: "Failed to reprocess document" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
