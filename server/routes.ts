import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { registerHrApiRoutes } from "./hrApi";
import { db } from "./db";
import { eq } from "drizzle-orm";
import { insertCategorySchema, insertDocumentSchema, insertChatConversationSchema, insertChatMessageSchema, insertDataConnectionSchema, updateDataConnectionSchema, type Document as DocType } from "@shared/schema";
import { z } from "zod";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import * as fsSync from "fs";
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

  // Register public HR API routes (no authentication required)
  registerHrApiRoutes(app);

  // Serve widget embed script
  app.get('/widget/:widgetKey/embed.js', async (req, res) => {
    try {
      const { widgetKey } = req.params;
      const { chatWidgets } = await import('@shared/schema');
      
      // Verify widget exists and is active
      const [widget] = await db.select().from(chatWidgets).where(eq(chatWidgets.widgetKey, widgetKey)).limit(1);
      
      if (!widget || !widget.isActive) {
        return res.status(404).send('// Widget not found or inactive');
      }

      // Read and serve the embed script
      const fs = await import('fs');
      const path = await import('path');
      const embedScript = fs.readFileSync(path.join(process.cwd(), 'public', 'widget', 'embed.js'), 'utf8');
      
      res.setHeader('Content-Type', 'application/javascript');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.send(embedScript);
    } catch (error) {
      console.error('Error serving widget embed script:', error);
      res.status(500).send('// Error loading widget script');
    }
  });

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

  app.get('/api/documents/:id/download', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const id = parseInt(req.params.id);
      const document = await storage.getDocument(id, userId);
      
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }
      
      const filePath = path.join(process.cwd(), 'uploads', document.fileName);
      
      if (!fsSync.existsSync(filePath)) {
        return res.status(404).json({ message: "File not found" });
      }
      
      // Log access
      await storage.logDocumentAccess(id, userId, 'download');
      
      // Set proper headers to prevent corruption
      res.setHeader('Content-Type', document.mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(document.name)}"`);
      res.setHeader('Content-Length', fsSync.statSync(filePath).size);
      
      const fileStream = fsSync.createReadStream(filePath);
      fileStream.pipe(res);
    } catch (error) {
      console.error("Error downloading document:", error);
      res.status(500).json({ message: "Failed to download document" });
    }
  });

  app.post('/api/documents/:id/favorite', isAuthenticated, async (req: any, res) => {
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

  app.post('/api/documents/:id/vectorize', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const id = parseInt(req.params.id);
      const document = await storage.getDocument(id, userId);
      
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }
      
      if (document.content && document.content.trim().length > 0) {
        await vectorService.addDocument(
          id.toString(),
          document.content,
          {
            userId,
            documentName: document.name,
            mimeType: document.mimeType,
            tags: document.tags || [],
          }
        );
        
        // Update document to mark as in vector DB
        await storage.updateDocument(id, { isInVectorDb: true }, userId);
        
        res.json({ success: true, message: "Document added to vector database" });
      } else {
        res.status(400).json({ message: "Document has no extractable content for vectorization" });
      }
    } catch (error) {
      console.error("Error adding document to vector database:", error);
      res.status(500).json({ message: "Failed to add document to vector database" });
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

  // Chat conversation endpoints
  app.get("/api/chat/conversations", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const conversations = await storage.getChatConversations(userId);
      res.json(conversations);
    } catch (error) {
      console.error("Error fetching conversations:", error);
      res.status(500).json({ message: "Failed to fetch conversations" });
    }
  });

  app.post("/api/chat/conversations", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { title } = req.body;
      
      const conversation = await storage.createChatConversation({
        userId,
        title: title || "New Conversation",
      });
      
      res.json(conversation);
    } catch (error) {
      console.error("Error creating conversation:", error);
      res.status(500).json({ message: "Failed to create conversation" });
    }
  });

  app.get("/api/chat/conversations/:id/messages", isAuthenticated, async (req: any, res) => {
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

  app.post("/api/chat/conversations/:id/message", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const conversationId = parseInt(req.params.id);
      const { content } = req.body;
      
      // Store user message
      const userMessage = await storage.createChatMessage({
        conversationId,
        role: 'user',
        content,
      });
      
      // Get user's documents for context
      const documents = await storage.getDocuments(userId);
      
      // Generate AI response using OpenAI
      const aiResponse = await generateChatResponse(content, documents);
      
      // Store AI message
      const aiMessage = await storage.createChatMessage({
        conversationId,
        role: 'assistant',
        content: aiResponse,
      });
      
      res.json({ userMessage, aiMessage });
    } catch (error) {
      console.error("Error sending message:", error);
      res.status(500).json({ message: "Failed to send message" });
    }
  });

  // Data connection management routes
  app.get('/api/data-connections', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const connections = await storage.getDataConnections(userId);
      res.json(connections);
    } catch (error) {
      console.error("Error fetching data connections:", error);
      res.status(500).json({ message: "Failed to fetch data connections" });
    }
  });

  app.post('/api/data-connections', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const connectionData = insertDataConnectionSchema.parse({ ...req.body, userId });
      const connection = await storage.createDataConnection(connectionData);
      res.json(connection);
    } catch (error) {
      console.error("Error creating data connection:", error);
      res.status(500).json({ message: "Failed to create data connection" });
    }
  });

  app.get('/api/data-connections/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const connectionId = parseInt(req.params.id);
      const connection = await storage.getDataConnection(connectionId, userId);
      
      if (!connection) {
        return res.status(404).json({ message: "Data connection not found" });
      }
      
      res.json(connection);
    } catch (error) {
      console.error("Error fetching data connection:", error);
      res.status(500).json({ message: "Failed to fetch data connection" });
    }
  });

  app.put('/api/data-connections/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const connectionId = parseInt(req.params.id);
      const connectionData = updateDataConnectionSchema.parse(req.body);
      
      const connection = await storage.updateDataConnection(connectionId, connectionData, userId);
      res.json(connection);
    } catch (error) {
      console.error("Error updating data connection:", error);
      res.status(500).json({ message: "Failed to update data connection" });
    }
  });

  app.delete('/api/data-connections/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const connectionId = parseInt(req.params.id);
      
      await storage.deleteDataConnection(connectionId, userId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting data connection:", error);
      res.status(500).json({ message: "Failed to delete data connection" });
    }
  });

  app.post('/api/data-connections/:id/test', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const connectionId = parseInt(req.params.id);
      const connection = await storage.getDataConnection(connectionId, userId);
      
      if (!connection) {
        return res.status(404).json({ message: "Connection not found" });
      }

      // Import database connector
      const { databaseConnector } = await import('./services/databaseConnector');
      
      // Transform connection data for connector
      const connectorData = {
        id: connection.id,
        type: connection.type as 'database' | 'api' | 'enterprise',
        dbType: connection.dbType || undefined,
        host: connection.host || undefined,
        port: connection.port || undefined,
        database: connection.database || undefined,
        username: connection.username || undefined,
        password: connection.password || undefined,
        apiUrl: connection.apiUrl || undefined,
        authType: connection.authType || undefined,
        apiKey: connection.authConfig?.apiKey || undefined,
        bearerToken: connection.authConfig?.bearerToken || undefined,
        enterpriseType: connection.enterpriseType || undefined,
      };

      const result = await databaseConnector.testConnection(connectorData);
      
      // Update connection test status
      await storage.updateDataConnection(connectionId, {
        lastTested: new Date(),
        testStatus: result.success ? 'success' : 'failed',
        testMessage: result.message,
      }, userId);

      res.json(result);
    } catch (error) {
      console.error("Error testing data connection:", error);
      res.status(500).json({ message: "Failed to test data connection" });
    }
  });

  // Database query endpoints
  app.post('/api/data-connections/:id/query', isAuthenticated, async (req: any, res) => {
    try {
      const connectionId = parseInt(req.params.id);
      const userId = req.user.claims.sub;
      const { query } = req.body;

      if (!query) {
        return res.status(400).json({ message: "SQL query is required" });
      }

      const { databaseQueryService } = await import('./services/databaseQueryService');
      const result = await databaseQueryService.executeQuery(connectionId, query, userId);
      
      res.json(result);
    } catch (error) {
      console.error("Error executing database query:", error);
      res.status(500).json({ message: "Failed to execute query" });
    }
  });

  app.get('/api/data-connections/:id/schema', isAuthenticated, async (req: any, res) => {
    try {
      const connectionId = parseInt(req.params.id);
      const userId = req.user.claims.sub;

      const { databaseQueryService } = await import('./services/databaseQueryService');
      const schema = await databaseQueryService.getDatabaseSchema(connectionId, userId);
      
      if (!schema) {
        return res.status(404).json({ message: "Database schema not found" });
      }

      res.json(schema);
    } catch (error) {
      console.error("Error fetching database schema:", error);
      res.status(500).json({ message: "Failed to fetch database schema" });
    }
  });

  app.post('/api/chat/database', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { message, connectionId } = req.body;

      if (!message || !connectionId) {
        return res.status(400).json({ message: "Message and connection ID are required" });
      }

      // Get database schema for context
      const { databaseQueryService } = await import('./services/databaseQueryService');
      const schema = await databaseQueryService.getDatabaseSchema(connectionId, userId);
      
      if (!schema) {
        return res.status(404).json({ message: "Database connection not found" });
      }

      // Generate SQL query suggestions based on user question
      const suggestions = await databaseQueryService.suggestQueries(connectionId, userId, message);

      // Use OpenAI to generate a response and SQL query
      const { generateDatabaseResponse } = await import('./services/openai');
      const response = await generateDatabaseResponse(message, schema, suggestions);

      res.json({
        response,
        schema,
        suggestions
      });
    } catch (error) {
      console.error("Error processing database chat:", error);
      res.status(500).json({ message: "Failed to process database chat" });
    }
  });

  // Chat Widget API endpoints
  app.get('/api/chat-widgets', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { chatWidgets } = await import('@shared/schema');
      
      const widgets = await db.select().from(chatWidgets).where(eq(chatWidgets.userId, userId));
      res.json(widgets);
    } catch (error) {
      console.error("Error fetching chat widgets:", error);
      res.status(500).json({ message: "Failed to fetch chat widgets" });
    }
  });

  app.post('/api/chat-widgets', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { nanoid } = await import('nanoid');
      const { chatWidgets } = await import('@shared/schema');
      const { name, primaryColor, textColor, position, welcomeMessage, offlineMessage, enableHrLookup, hrApiEndpoint } = req.body;

      if (!name) {
        return res.status(400).json({ message: "Widget name is required" });
      }

      const widgetKey = nanoid(16);
      
      const [widget] = await db.insert(chatWidgets).values({
        userId,
        name,
        widgetKey,
        primaryColor: primaryColor || "#2563eb",
        textColor: textColor || "#ffffff", 
        position: position || "bottom-right",
        welcomeMessage: welcomeMessage || "Hi! How can I help you today?",
        offlineMessage: offlineMessage || "We're currently offline. Please leave a message.",
        enableHrLookup: enableHrLookup || false,
        hrApiEndpoint: hrApiEndpoint || null
      }).returning();

      res.status(201).json(widget);
    } catch (error) {
      console.error("Error creating chat widget:", error);
      res.status(500).json({ message: "Failed to create chat widget" });
    }
  });

  // HR Employee management endpoints
  app.get('/api/hr-employees', isAuthenticated, async (req: any, res) => {
    try {
      const { hrEmployees } = await import('@shared/schema');
      const employees = await db.select().from(hrEmployees).where(eq(hrEmployees.isActive, true));
      res.json(employees);
    } catch (error) {
      console.error("Error fetching HR employees:", error);
      res.status(500).json({ message: "Failed to fetch HR employees" });
    }
  });

  app.post('/api/hr-employees', isAuthenticated, async (req: any, res) => {
    try {
      const { hrEmployees } = await import('@shared/schema');
      const { employeeId, citizenId, firstName, lastName, email, phone, department, position, startDate } = req.body;

      if (!employeeId || !citizenId || !firstName || !lastName || !department) {
        return res.status(400).json({ message: "Required fields: employeeId, citizenId, firstName, lastName, department" });
      }

      // Validate Thai Citizen ID format
      if (!/^\d{13}$/.test(citizenId)) {
        return res.status(400).json({ message: "Invalid Thai Citizen ID format. Must be 13 digits." });
      }

      const [employee] = await db.insert(hrEmployees).values({
        employeeId,
        citizenId,
        firstName,
        lastName,
        email,
        phone,
        department,
        position,
        startDate: startDate ? new Date(startDate) : null
      }).returning();

      res.status(201).json(employee);
    } catch (error) {
      console.error("Error creating HR employee:", error);
      if (error.code === '23505') { // Unique constraint violation
        res.status(409).json({ message: "Employee ID or Citizen ID already exists" });
      } else {
        res.status(500).json({ message: "Failed to create HR employee" });
      }
    }
  });

  // Widget chat endpoints for public use
  app.post('/api/widget/:widgetKey/chat', async (req, res) => {
    try {
      const { widgetKey } = req.params;
      const { sessionId, message, visitorInfo } = req.body;
      const { chatWidgets, widgetChatSessions, widgetChatMessages, hrEmployees } = await import('@shared/schema');
      const { eq } = await import('drizzle-orm');
      const { nanoid } = await import('nanoid');

      // Find widget
      const [widget] = await db.select().from(chatWidgets).where(eq(chatWidgets.widgetKey, widgetKey)).limit(1);
      
      if (!widget || !widget.isActive) {
        return res.status(404).json({ message: "Widget not found or inactive" });
      }

      // Create or get session
      let session;
      if (sessionId) {
        [session] = await db.select().from(widgetChatSessions).where(eq(widgetChatSessions.sessionId, sessionId)).limit(1);
      }
      
      if (!session) {
        const newSessionId = sessionId || nanoid(16);
        [session] = await db.insert(widgetChatSessions).values({
          widgetId: widget.id,
          sessionId: newSessionId,
          visitorName: visitorInfo?.name,
          visitorEmail: visitorInfo?.email,
          visitorPhone: visitorInfo?.phone
        }).returning();
      }

      // Add user message
      await db.insert(widgetChatMessages).values({
        sessionId: session.sessionId,
        role: 'user',
        content: message
      });

      // Check if this is an HR lookup request
      let response = "Thank you for your message. How can I help you today?";
      let messageType = "text";
      let metadata = null;

      if (widget.enableHrLookup && message) {
        // Check if message contains Thai Citizen ID pattern
        const citizenIdMatch = message.match(/\b\d{13}\b/);
        if (citizenIdMatch) {
          const citizenId = citizenIdMatch[0];
          
          const [employee] = await db
            .select({
              employeeId: hrEmployees.employeeId,
              firstName: hrEmployees.firstName,
              lastName: hrEmployees.lastName,
              department: hrEmployees.department,
              position: hrEmployees.position,
              isActive: hrEmployees.isActive
            })
            .from(hrEmployees)
            .where(eq(hrEmployees.citizenId, citizenId))
            .limit(1);

          if (employee && employee.isActive) {
            response = `Yes, ${employee.employeeId} ${employee.firstName} ${employee.lastName} is working in ${employee.department}`;
            if (employee.position) {
              response += ` as ${employee.position}`;
            }
            messageType = "hr_lookup";
            metadata = { 
              citizenId, 
              found: true, 
              employee: {
                employeeId: employee.employeeId,
                name: `${employee.firstName} ${employee.lastName}`,
                department: employee.department,
                position: employee.position
              }
            };
          } else {
            response = "No active employee found with the provided Thai Citizen ID.";
            messageType = "hr_lookup";
            metadata = { citizenId, found: false };
          }
        } else {
          response = widget.welcomeMessage + " You can also check employee status by providing a Thai Citizen ID (13 digits).";
        }
      }

      // Add assistant response
      await db.insert(widgetChatMessages).values({
        sessionId: session.sessionId,
        role: 'assistant',
        content: response,
        messageType,
        metadata
      });

      res.json({
        sessionId: session.sessionId,
        response,
        messageType,
        metadata
      });

    } catch (error) {
      console.error("Widget chat error:", error);
      res.status(500).json({ message: "Chat service error" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
