import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated, isAdmin } from "./replitAuth";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import OpenAI from "openai";
import { insertDocumentSchema, insertCategorySchema, insertChatConversationSchema, insertChatMessageSchema } from "@shared/schema";
import { fromZodError } from "zod-validation-error";
import { registerHrApiRoutes } from "./hrApi";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Configure multer for file uploads
const upload = multer({
  dest: "uploads/",
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
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

  // Categories routes
  app.get("/api/categories", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const categories = await storage.getCategories(userId);
      res.json(categories);
    } catch (error) {
      console.error("Error fetching categories:", error);
      res.status(500).json({ message: "Failed to fetch categories" });
    }
  });

  app.post("/api/categories", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const result = insertCategorySchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: fromZodError(result.error).message });
      }

      const category = await storage.createCategory({
        ...result.data,
        userId,
      });
      res.status(201).json(category);
    } catch (error) {
      console.error("Error creating category:", error);
      res.status(500).json({ message: "Failed to create category" });
    }
  });

  // Documents routes
  app.get("/api/documents", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const categoryId = req.query.categoryId ? parseInt(req.query.categoryId) : undefined;
      const limit = req.query.limit ? parseInt(req.query.limit) : undefined;
      const offset = req.query.offset ? parseInt(req.query.offset) : undefined;
      
      const documents = await storage.getDocuments(userId, { categoryId, limit, offset });
      res.json(documents);
    } catch (error) {
      console.error("Error fetching documents:", error);
      res.status(500).json({ message: "Failed to fetch documents" });
    }
  });

  // AI Feedback routes
  app.get("/api/ai-feedback/export", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const feedbackData = await storage.exportAiFeedbackData(userId);
      res.json(feedbackData);
    } catch (error) {
      console.error("Error exporting AI feedback data:", error);
      res.status(500).json({ message: "Failed to export feedback data" });
    }
  });

  app.get("/api/documents/:id/feedback", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const documentId = parseInt(req.params.id);
      const feedbackData = await storage.getDocumentFeedback(documentId, userId);
      res.json(feedbackData);
    } catch (error) {
      console.error("Error fetching document feedback:", error);
      res.status(500).json({ message: "Failed to fetch document feedback" });
    }
  });

  // Chat routes
  app.post("/api/chat/conversations", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      console.log("Creating conversation with data:", req.body);
      console.log("User ID:", userId);
      
      const result = insertChatConversationSchema.safeParse(req.body);
      if (!result.success) {
        console.error("Validation error:", result.error);
        return res.status(400).json({ message: fromZodError(result.error).message });
      }

      const conversation = await storage.createChatConversation({
        ...result.data,
        userId,
      });
      res.status(201).json(conversation);
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

  app.post("/api/chat/messages", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const result = insertChatMessageSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: fromZodError(result.error).message });
      }

      const message = await storage.createChatMessage({
        ...result.data,
        role: "user",
      });

      // Generate AI response
      if (req.body.documentId) {
        const document = await storage.getDocument(req.body.documentId, userId);
        if (document) {
          try {
            const prompt = `Based on the following document content, please answer the user's question.

Document: "${document.name}"
Content: ${document.content}

User Question: ${req.body.content}

Please provide a helpful and accurate response based only on the document content.`;

            const completion = await openai.chat.completions.create({
              model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
              messages: [{ role: "user", content: prompt }],
              max_tokens: 1000,
            });

            const assistantResponse = completion.choices[0].message.content || "I couldn't generate a response.";

            // Save assistant response
            await storage.createChatMessage({
              conversationId: result.data.conversationId,
              content: assistantResponse,
              role: "assistant",
            });
          } catch (aiError) {
            console.error("Error generating AI response:", aiError);
            await storage.createChatMessage({
              conversationId: result.data.conversationId,
              content: "Sorry, I encountered an error while processing your request.",
              role: "assistant",
            });
          }
        }
      }

      res.status(201).json(message);
    } catch (error) {
      console.error("Error creating message:", error);
      res.status(500).json({ message: "Failed to create message" });
    }
  });

  // Register HR API routes
  registerHrApiRoutes(app);

  const httpServer = createServer(app);
  return httpServer;
}