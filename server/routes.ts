import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { insertDocumentSchema, insertCategorySchema, insertConversationSchema, insertMessageSchema, type Document as DocType } from "@shared/schema";
import { openaiService } from "./services/openai";
import { documentProcessor } from "./services/documentProcessor";
import { vectorService } from "./services/vectorService";
import multer from "multer";
import path from "path";
import fs from "fs";

// File upload configuration
const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({
  dest: uploadDir,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain',
      'text/csv',
      'application/json',
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file type'));
    }
  },
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

  // Dashboard stats
  app.get('/api/dashboard/stats', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const stats = await storage.getDocumentStats(userId);
      const searchStats = await storage.getSearchStats(userId);
      
      res.json({
        ...stats,
        aiQueries: searchStats.totalQueries,
        activeUsers: 1, // Current user
      });
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      res.status(500).json({ message: "Failed to fetch dashboard stats" });
    }
  });

  // Document routes
  app.get('/api/documents', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      
      const documents = await storage.getDocuments(userId, limit, offset);
      res.json(documents);
    } catch (error) {
      console.error("Error fetching documents:", error);
      res.status(500).json({ message: "Failed to fetch documents" });
    }
  });

  app.get('/api/documents/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const documentId = parseInt(req.params.id);
      
      const document = await storage.getDocument(documentId);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }

      // Check access
      if (document.uploadedBy !== userId) {
        const access = await storage.checkDocumentAccess(documentId, userId);
        if (!access) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      res.json(document);
    } catch (error) {
      console.error("Error fetching document:", error);
      res.status(500).json({ message: "Failed to fetch document" });
    }
  });

  app.post('/api/documents/upload', isAuthenticated, upload.array('files', 10), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const files = req.files as Express.Multer.File[];
      
      if (!files || files.length === 0) {
        return res.status(400).json({ message: "No files uploaded" });
      }

      const uploadedDocuments = [];

      for (const file of files) {
        const documentData = {
          filename: file.filename,
          originalName: file.originalname,
          fileType: file.mimetype,
          fileSize: file.size,
          filePath: file.path,
          uploadedBy: userId,
          status: 'pending' as const,
        };

        const document = await storage.createDocument(documentData);
        uploadedDocuments.push(document);

        // Process document asynchronously
        documentProcessor.processDocument(document.id).catch(error => {
          console.error(`Error processing document ${document.id}:`, error);
        });
      }

      res.json({ documents: uploadedDocuments });
    } catch (error) {
      console.error("Error uploading documents:", error);
      res.status(500).json({ message: "Failed to upload documents" });
    }
  });

  app.put('/api/documents/:id/vector', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const documentId = parseInt(req.params.id);
      
      const document = await storage.getDocument(documentId);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }

      // Check access
      if (document.uploadedBy !== userId) {
        const access = await storage.checkDocumentAccess(documentId, userId);
        if (!access) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      if (!document.content) {
        return res.status(400).json({ message: "Document content not available" });
      }

      // Add to vector database
      const vectorId = await vectorService.addDocument(document.id.toString(), document.content, {
        title: document.originalName,
        category: document.categoryId?.toString() || 'uncategorized',
        uploadedBy: document.uploadedBy,
      });

      await storage.updateDocument(documentId, {
        isInVectorDb: true,
        vectorId,
      });

      res.json({ message: "Document added to vector database", vectorId });
    } catch (error) {
      console.error("Error adding document to vector database:", error);
      res.status(500).json({ message: "Failed to add document to vector database" });
    }
  });

  app.delete('/api/documents/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const documentId = parseInt(req.params.id);
      
      const document = await storage.getDocument(documentId);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }

      // Check if user owns the document
      if (document.uploadedBy !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Remove from vector database if present
      if (document.isInVectorDb && document.vectorId) {
        await vectorService.removeDocument(document.vectorId);
      }

      // Remove file from disk
      if (fs.existsSync(document.filePath)) {
        fs.unlinkSync(document.filePath);
      }

      await storage.deleteDocument(documentId);
      res.json({ message: "Document deleted successfully" });
    } catch (error) {
      console.error("Error deleting document:", error);
      res.status(500).json({ message: "Failed to delete document" });
    }
  });

  // Search routes
  app.get('/api/search', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const query = req.query.q as string;
      const type = req.query.type as string || 'keyword';
      
      if (!query) {
        return res.status(400).json({ message: "Query parameter is required" });
      }

      let results: DocType[] = [];
      
      if (type === 'semantic') {
        // Semantic search using vector database
        const vectorResults = await vectorService.searchDocuments(query, {
          userId,
          limit: 20,
        });
        
        // Get document details
        const documentIds = vectorResults.map(r => parseInt(r.id));
        if (documentIds.length > 0) {
          const documents = await Promise.all(
            documentIds.map(id => storage.getDocument(id))
          );
          results = documents.filter(doc => doc !== undefined) as DocType[];
        }
      } else {
        // Keyword search
        results = await storage.searchDocuments(query, userId);
      }

      // Log search query
      await storage.logSearchQuery(userId, query, type, results.length);

      res.json({ results, query, type, count: results.length });
    } catch (error) {
      console.error("Error searching documents:", error);
      res.status(500).json({ message: "Failed to search documents" });
    }
  });

  // Category routes
  app.get('/api/categories', async (req, res) => {
    try {
      const categories = await storage.getCategories();
      res.json(categories);
    } catch (error) {
      console.error("Error fetching categories:", error);
      res.status(500).json({ message: "Failed to fetch categories" });
    }
  });

  app.post('/api/categories', isAuthenticated, async (req: any, res) => {
    try {
      const categoryData = insertCategorySchema.parse(req.body);
      const category = await storage.createCategory(categoryData);
      res.json(category);
    } catch (error) {
      console.error("Error creating category:", error);
      res.status(500).json({ message: "Failed to create category" });
    }
  });

  // Conversation routes
  app.get('/api/conversations', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const conversations = await storage.getConversations(userId);
      res.json(conversations);
    } catch (error) {
      console.error("Error fetching conversations:", error);
      res.status(500).json({ message: "Failed to fetch conversations" });
    }
  });

  app.post('/api/conversations', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const conversationData = insertConversationSchema.parse({
        ...req.body,
        userId,
      });
      const conversation = await storage.createConversation(conversationData);
      res.json(conversation);
    } catch (error) {
      console.error("Error creating conversation:", error);
      res.status(500).json({ message: "Failed to create conversation" });
    }
  });

  app.get('/api/conversations/:id/messages', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const conversationId = parseInt(req.params.id);
      
      const conversation = await storage.getConversation(conversationId);
      if (!conversation) {
        return res.status(404).json({ message: "Conversation not found" });
      }

      if (conversation.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const messages = await storage.getMessages(conversationId);
      res.json(messages);
    } catch (error) {
      console.error("Error fetching messages:", error);
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });

  app.post('/api/conversations/:id/messages', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const conversationId = parseInt(req.params.id);
      
      const conversation = await storage.getConversation(conversationId);
      if (!conversation) {
        return res.status(404).json({ message: "Conversation not found" });
      }

      if (conversation.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const messageData = insertMessageSchema.parse({
        ...req.body,
        conversationId,
      });

      // Save user message
      const userMessage = await storage.createMessage(messageData);

      // Generate AI response
      const query = messageData.content;
      const contextResults = await vectorService.searchDocuments(query, {
        userId,
        limit: 5,
      });

      const context = await Promise.all(
        contextResults.map(async (result) => {
          const doc = await storage.getDocument(parseInt(result.id));
          return doc ? {
            title: doc.originalName,
            content: result.content,
            id: doc.id,
          } : null;
        })
      );

      const validContext = context.filter(c => c !== null);
      
      const aiResponse = await openaiService.generateChatResponse(query, validContext);
      
      // Save AI response
      const aiMessage = await storage.createMessage({
        conversationId,
        role: 'assistant',
        content: aiResponse.content,
        sources: aiResponse.sources,
      });

      res.json({
        userMessage,
        aiMessage,
        sources: aiResponse.sources,
      });
    } catch (error) {
      console.error("Error creating message:", error);
      res.status(500).json({ message: "Failed to create message" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
