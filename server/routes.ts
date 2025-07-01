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

  // Register HR API routes
  registerHrApiRoutes(app);

  const httpServer = createServer(app);
  return httpServer;
}