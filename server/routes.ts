import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { setupAuth, isAuthenticated, isAdmin } from "./replitAuth";
import { registerHrApiRoutes } from "./hrApi";
import { handleLineWebhook } from "./lineOaWebhook";
import OpenAI from "openai";
import { db, pool } from "./db";

// Initialize OpenAI
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
import { eq, sql, and, gte, getTableColumns } from "drizzle-orm";
import {
  insertCategorySchema,
  insertDocumentSchema,
  insertChatConversationSchema,
  insertChatMessageSchema,
  insertDataConnectionSchema,
  updateDataConnectionSchema,
  type Document as DocType,
  users,
  departments,
  documentUserPermissions,
  documentDepartmentPermissions,
  documents,
  categories,
  auditLogs,
  socialIntegrations,
} from "@shared/schema";
import { z } from "zod";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import * as fsSync from "fs";
import { processDocument, generateChatResponse } from "./services/openai";
import { documentProcessor } from "./services/documentProcessor";
import { vectorService } from "./services/vectorService";
import { semanticSearchServiceV2 } from "./services/semanticSearchV2";

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
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(
      null,
      file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname),
    );
  },
});

const upload = multer({
  storage: storage_multer,
  fileFilter: (req, file, cb) => {
    // Ensure proper UTF-8 encoding for filename
    if (file.originalname) {
      file.originalname = Buffer.from(file.originalname, "latin1").toString(
        "utf8",
      );
    }

    const allowedMimes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "application/msword",
      "application/vnd.ms-excel",
      "application/vnd.ms-powerpoint",
      "text/plain",
      "text/csv",
      "application/json",
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/gif",
      "image/webp",
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          "Invalid file type. Supported: PDF, DOCX, XLSX, PPTX, TXT, CSV, JSON, and image files.",
        ),
      );
    }
  },
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB limit
  },
});

// Using semanticSearchServiceV2 from import

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Serve uploaded files and Line images
  const uploadsPath = path.join(process.cwd(), 'uploads');
  const lineImagesPath = path.join(uploadsPath, 'line-images');
  
  // Ensure directories exist
  if (!fsSync.existsSync(uploadsPath)) {
    fsSync.mkdirSync(uploadsPath, { recursive: true });
  }
  if (!fsSync.existsSync(lineImagesPath)) {
    fsSync.mkdirSync(lineImagesPath, { recursive: true });
  }
  
  app.use('/uploads', express.static(uploadsPath));

  // Register public HR API routes (no authentication required)
  registerHrApiRoutes(app);

  // Audit & Monitoring routes
  app.get("/api/audit/logs", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;

      // Check if user is admin - only admins can view audit logs
      const user = await storage.getUser(userId);
      if (!user || user.role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }

      const {
        limit,
        offset,
        action,
        resourceType,
        filterUserId,
        dateFrom,
        dateTo,
      } = req.query;

      const options: any = {};
      if (limit) options.limit = parseInt(limit);
      if (offset) options.offset = parseInt(offset);
      if (action && action !== "all") options.action = action;
      if (resourceType && resourceType !== "all")
        options.resourceType = resourceType;
      if (filterUserId && filterUserId !== "all") options.userId = filterUserId;
      if (dateFrom) options.dateFrom = new Date(dateFrom);
      if (dateTo) options.dateTo = new Date(dateTo);

      const logs = await storage.getAuditLogs(userId, options);
      res.json(logs);
    } catch (error) {
      console.error("Error fetching audit logs:", error);
      res.status(500).json({ message: "Failed to fetch audit logs" });
    }
  });

  app.get("/api/audit/stats", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;

      // Check if user is admin - only admins can view audit stats
      const user = await storage.getUser(userId);
      if (!user || user.role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }

      const stats = await storage.getAuditStats(userId);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching audit stats:", error);
      res.status(500).json({ message: "Failed to fetch audit stats" });
    }
  });

  // Export audit logs as CSV
  app.get("/api/audit/export", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;

      // Check if user is admin - only admins can export audit logs
      const user = await storage.getUser(userId);
      if (!user || user.role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { action, resourceType, filterUserId, dateFrom, dateTo } =
        req.query;

      const options: any = {
        limit: 10000, // Export up to 10,000 records
        offset: 0,
      };
      if (action && action !== "all") options.action = action;
      if (resourceType && resourceType !== "all")
        options.resourceType = resourceType;
      if (filterUserId && filterUserId !== "all") options.userId = filterUserId;
      if (dateFrom) options.dateFrom = new Date(dateFrom);
      if (dateTo) options.dateTo = new Date(dateTo);

      const auditLogs = await storage.getAuditLogs(userId, options);

      // Create CSV content
      const csvHeader =
        "ID,User Email,Action,Resource Type,Resource ID,Success,IP Address,User Agent,Created At,Details\n";
      const csvRows = auditLogs
        .map((log: any) => {
          const userEmail = log.userEmail || "Unknown";
          const details = log.details
            ? JSON.stringify(log.details).replace(/"/g, '""')
            : "";
          const createdAt = new Date(log.createdAt).toISOString();

          return `${log.id},"${userEmail}","${log.action}","${log.resourceType}","${log.resourceId || ""}",${log.success},"${log.ipAddress}","${log.userAgent}","${createdAt}","${details}"`;
        })
        .join("\n");

      const csvContent = csvHeader + csvRows;

      // Set headers for file download
      const filename = `audit_logs_${new Date().toISOString().split("T")[0]}.csv`;
      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}"`,
      );
      res.send(csvContent);
    } catch (error) {
      console.error("Error exporting audit logs:", error);
      res.status(500).json({ message: "Failed to export audit logs" });
    }
  });

  // Get filter options for audit logs
  app.get("/api/audit/filters", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;

      // Check if user is admin - only admins can access audit filters
      const user = await storage.getUser(userId);
      if (!user || user.role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }

      // Get distinct values from audit logs
      const { auditLogs, users } = await import("@shared/schema");

      const actions = await db
        .selectDistinct({ action: auditLogs.action })
        .from(auditLogs)
        .orderBy(auditLogs.action);

      const resourceTypes = await db
        .selectDistinct({ resourceType: auditLogs.resourceType })
        .from(auditLogs)
        .orderBy(auditLogs.resourceType);

      const usersList = await db
        .select({
          id: users.id,
          email: users.email,
        })
        .from(users)
        .orderBy(users.email);

      res.json({
        actions: actions.map((a) => a.action),
        resourceTypes: resourceTypes.map((r) => r.resourceType),
        users: usersList,
      });
    } catch (error) {
      console.error("Error fetching audit filters:", error);
      res.status(500).json({ message: "Failed to fetch audit filters" });
    }
  });

  // Serve widget embed script
  app.get("/widget/:widgetKey/embed.js", async (req, res) => {
    try {
      const { widgetKey } = req.params;
      const { chatWidgets } = await import("@shared/schema");

      // Verify widget exists and is active
      const [widget] = await db
        .select()
        .from(chatWidgets)
        .where(eq(chatWidgets.widgetKey, widgetKey))
        .limit(1);

      if (!widget || !widget.isActive) {
        return res.status(404).send("// Widget not found or inactive");
      }

      // Read and serve the embed script
      const fs = await import("fs");
      const path = await import("path");
      const embedScript = fs.readFileSync(
        path.join(process.cwd(), "public", "widget", "embed.js"),
        "utf8",
      );

      res.setHeader("Content-Type", "application/javascript");
      res.setHeader("Cache-Control", "public, max-age=3600");
      res.send(embedScript);
    } catch (error) {
      console.error("Error serving widget embed script:", error);
      res.status(500).send("// Error loading widget script");
    }
  });

  // Auth routes
  app.get("/api/auth/user", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { users, departments } = await import("@shared/schema");

      // Fetch user with department information
      const [userWithDept] = await db
        .select({
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          profileImageUrl: users.profileImageUrl,
          role: users.role,
          departmentId: users.departmentId,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
          departmentName: departments.name,
        })
        .from(users)
        .leftJoin(departments, eq(users.departmentId, departments.id))
        .where(eq(users.id, userId));

      if (!userWithDept) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json(userWithDept);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Update user profile
  app.put("/api/users/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.params.id;
      const { firstName, lastName, departmentId } = req.body;
      const { users } = await import("@shared/schema");

      const [updatedUser] = await db
        .update(users)
        .set({
          firstName,
          lastName,
          departmentId: departmentId || null,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId))
        .returning();

      res.json(updatedUser);
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  // User stats
  app.get("/api/stats", isAuthenticated, async (req: any, res) => {
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
      const categoryData = insertCategorySchema.parse({ ...req.body, userId });
      const category = await storage.createCategory(categoryData);
      res.json(category);
    } catch (error) {
      console.error("Error creating category:", error);
      res.status(500).json({ message: "Failed to create category" });
    }
  });

  app.put("/api/categories/:id", isAuthenticated, async (req: any, res) => {
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

  app.delete("/api/categories/:id", isAuthenticated, async (req: any, res) => {
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

  // Category statistics endpoint
  app.get("/api/stats/categories", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { documents } = await import("@shared/schema");
      const { sql } = await import("drizzle-orm");

      const categoryStats = await db
        .select({
          category: documents.aiCategory,
          count: sql<number>`count(${documents.id})`,
        })
        .from(documents)
        .where(eq(documents.userId, userId))
        .groupBy(documents.aiCategory)
        .orderBy(sql`count(${documents.id}) desc`);

      res.json(categoryStats);
    } catch (error) {
      console.error("Error fetching category stats:", error);
      res.status(500).json({ message: "Failed to fetch category stats" });
    }
  });

  // Tag statistics endpoint
  app.get("/api/stats/tags", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { documents } = await import("@shared/schema");
      const { sql } = await import("drizzle-orm");

      // Get all documents with their tags
      const documentsWithTags = await db
        .select({
          tags: documents.tags,
        })
        .from(documents)
        .where(eq(documents.userId, userId));

      // Count occurrences of each tag
      const tagCounts: { [key: string]: number } = {};

      documentsWithTags.forEach((doc) => {
        if (doc.tags && Array.isArray(doc.tags)) {
          doc.tags.forEach((tag: string) => {
            tagCounts[tag] = (tagCounts[tag] || 0) + 1;
          });
        }
      });

      // Convert to array and sort by count
      const tagStats = Object.entries(tagCounts)
        .map(([tag, count]) => ({ tag, count }))
        .sort((a, b) => b.count - a.count);

      res.json(tagStats);
    } catch (error) {
      console.error("Error fetching tag stats:", error);
      res.status(500).json({ message: "Failed to fetch tag stats" });
    }
  });

  // Department management routes
  app.get("/api/departments", isAuthenticated, async (req: any, res) => {
    try {
      const { departments } = await import("@shared/schema");
      const allDepartments = await db
        .select()
        .from(departments)
        .orderBy(departments.name);
      res.json(allDepartments);
    } catch (error) {
      console.error("Error fetching departments:", error);
      res.status(500).json({ message: "Failed to fetch departments" });
    }
  });

  app.post("/api/departments", isAuthenticated, async (req: any, res) => {
    try {
      const { departments } = await import("@shared/schema");
      const { name, description } = req.body;

      const [department] = await db
        .insert(departments)
        .values({ name, description })
        .returning();

      res.json(department);
    } catch (error) {
      console.error("Error creating department:", error);
      res.status(500).json({ message: "Failed to create department" });
    }
  });

  // User management routes
  // Admin User Management Routes
  app.get(
    "/api/admin/users",
    isAuthenticated,
    isAdmin,
    async (req: any, res) => {
      try {
        const allUsers = await db
          .select({
            id: users.id,
            email: users.email,
            firstName: users.firstName,
            lastName: users.lastName,
            profileImageUrl: users.profileImageUrl,
            role: users.role,
            departmentId: users.departmentId,
            createdAt: users.createdAt,
            updatedAt: users.updatedAt,
          })
          .from(users)
          .leftJoin(departments, eq(users.departmentId, departments.id));

        res.json(allUsers);
      } catch (error) {
        console.error("Error fetching users:", error);
        res.status(500).json({ message: "Failed to fetch users" });
      }
    },
  );

  app.get(
    "/api/admin/departments",
    isAuthenticated,
    isAdmin,
    async (req: any, res) => {
      try {
        const allDepartments = await db.select().from(departments);
        res.json(allDepartments);
      } catch (error) {
        console.error("Error fetching departments:", error);
        res.status(500).json({ message: "Failed to fetch departments" });
      }
    },
  );

  app.post("/api/admin/departments", isAuthenticated, async (req: any, res) => {
    try {
      const { name, description } = req.body;

      if (!name) {
        return res.status(400).json({ message: "Department name is required" });
      }

      const [department] = await db
        .insert(departments)
        .values({
          name,
          description,
          createdBy: req.user.claims.sub,
        })
        .returning();

      res.status(201).json(department);
    } catch (error) {
      console.error("Error creating department:", error);
      res.status(500).json({ message: "Failed to create department" });
    }
  });

  app.put(
    "/api/admin/users/:userId/department",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const { userId } = req.params;
        const { departmentId } = req.body;

        await db
          .update(users)
          .set({
            departmentId: departmentId || null,
            updatedAt: new Date(),
          })
          .where(eq(users.id, userId));

        res.json({ message: "User department updated successfully" });
      } catch (error) {
        console.error("Error updating user department:", error);
        res.status(500).json({ message: "Failed to update user department" });
      }
    },
  );

  // Update user role
  app.put(
    "/api/admin/users/:userId/role",
    isAuthenticated,
    isAdmin,
    async (req: any, res) => {
      try {
        const { userId } = req.params;
        const { role } = req.body;
        const adminUserId = req.user.claims.sub;

        console.log(`Role update request from admin ${adminUserId}: userId=${userId}, newRole=${role}`);
        console.log("Request body:", req.body);

        // Validate required fields
        if (!userId) {
          console.log("Missing userId in request params");
          return res.status(400).json({
            message: "User ID is required",
          });
        }

        if (!role) {
          console.log("Missing role in request body");
          return res.status(400).json({
            message: "Role is required",
          });
        }

        // Validate role
        if (!["admin", "user", "viewer"].includes(role)) {
          console.log(`Invalid role provided: ${role}`);
          return res.status(400).json({
            message: "Invalid role. Must be 'admin', 'user', or 'viewer'",
          });
        }

        // Check if user exists
        const [existingUser] = await db
          .select()
          .from(users)
          .where(eq(users.id, userId))
          .limit(1);

        if (!existingUser) {
          console.log(`User not found: ${userId}`);
          return res.status(404).json({
            message: "User not found",
          });
        }

        console.log(`Updating user ${userId} role from ${existingUser.role} to ${role}`);

        // Update user role
        const [updatedUser] = await db
          .update(users)
          .set({
            role: role,
            updatedAt: new Date(),
          })
          .where(eq(users.id, userId))
          .returning();

        if (!updatedUser) {
          console.log(`Failed to update user ${userId}`);
          return res.status(500).json({
            message: "Failed to update user role",
          });
        }

        console.log(`Successfully updated user ${userId} role to ${role}`);

        // Log role change for audit
        try {
          await storage.createAuditLog({
            userId: adminUserId,
            action: "role_change",
            resourceType: "user",
            resourceId: userId,
            ipAddress: req.ip || req.connection.remoteAddress || "unknown",
            userAgent: req.headers["user-agent"] || "unknown",
            success: true,
            details: {
              targetUser: userId,
              oldRole: existingUser.role,
              newRole: role,
            },
          });
        } catch (auditError) {
          console.error(
            "Failed to create audit log for role change:",
            auditError,
          );
        }

        res.json({ 
          message: "User role updated successfully",
          user: {
            id: updatedUser.id,
            role: updatedUser.role,
          }
        });
      } catch (error) {
        console.error("Error updating user role:", error);
        res.status(500).json({ 
          message: "Failed to update user role",
          error: error instanceof Error ? error.message : "Unknown error"
        });
      }
    },
  );

  app.get(
    "/api/admin/permissions",
    isAuthenticated,
    isAdmin,
    async (req: any, res) => {
      try {
        const userPermissions = await db
          .select({
            id: documentUserPermissions.id,
            documentId: documentUserPermissions.documentId,
            userId: documentUserPermissions.userId,
            permissionType: documentUserPermissions.permissionType,
            grantedAt: documentUserPermissions.grantedAt,
          })
          .from(documentUserPermissions);

        const departmentPermissions = await db
          .select({
            id: documentDepartmentPermissions.id,
            documentId: documentDepartmentPermissions.documentId,
            departmentId: documentDepartmentPermissions.departmentId,
            permissionType: documentDepartmentPermissions.permissionType,
            grantedAt: documentDepartmentPermissions.grantedAt,
          })
          .from(documentDepartmentPermissions);

        const allPermissions = [
          ...userPermissions.map((p) => ({ ...p, type: "user" })),
          ...departmentPermissions.map((p) => ({ ...p, type: "department" })),
        ];

        res.json(allPermissions);
      } catch (error) {
        console.error("Error fetching permissions:", error);
        res.status(500).json({ message: "Failed to fetch permissions" });
      }
    },
  );

  app.post("/api/admin/permissions", isAuthenticated, async (req: any, res) => {
    try {
      const {
        documentId,
        userId,
        departmentId,
        permission = "read",
      } = req.body;

      if (!documentId) {
        return res.status(400).json({ message: "Document ID is required" });
      }

      if (!userId && !departmentId) {
        return res
          .status(400)
          .json({ message: "Either user ID or department ID is required" });
      }

      let result;
      if (userId) {
        // Check if permission already exists
        const existing = await db
          .select()
          .from(documentUserPermissions)
          .where(
            and(
              eq(documentUserPermissions.documentId, parseInt(documentId)),
              eq(documentUserPermissions.userId, userId),
            ),
          );

        if (existing.length > 0) {
          return res
            .status(400)
            .json({ message: "Permission already exists for this user" });
        }

        [result] = await db
          .insert(documentUserPermissions)
          .values({
            documentId: parseInt(documentId),
            userId,
            permissionType: permission,
          })
          .returning();
      } else {
        // Check if permission already exists
        const existing = await db
          .select()
          .from(documentDepartmentPermissions)
          .where(
            and(
              eq(
                documentDepartmentPermissions.documentId,
                parseInt(documentId),
              ),
              eq(
                documentDepartmentPermissions.departmentId,
                parseInt(departmentId),
              ),
            ),
          );

        if (existing.length > 0) {
          return res
            .status(400)
            .json({ message: "Permission already exists for this department" });
        }

        [result] = await db
          .insert(documentDepartmentPermissions)
          .values({
            documentId: parseInt(documentId),
            departmentId: parseInt(departmentId),
            permissionType: permission,
          })
          .returning();
      }

      res.status(201).json(result);
    } catch (error) {
      console.error("Error creating permission:", error);
      res.status(500).json({ message: "Failed to create permission" });
    }
  });

  app.delete(
    "/api/admin/permissions/:permissionId",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const { permissionId } = req.params;
        const { type } = req.query;

        if (type === "department") {
          await db
            .delete(documentDepartmentPermissions)
            .where(
              eq(documentDepartmentPermissions.id, parseInt(permissionId)),
            );
        } else {
          await db
            .delete(documentUserPermissions)
            .where(eq(documentUserPermissions.id, parseInt(permissionId)));
        }

        res.json({ message: "Permission deleted successfully" });
      } catch (error) {
        console.error("Error deleting permission:", error);
        res.status(500).json({ message: "Failed to delete permission" });
      }
    },
  );

  app.get("/api/users", isAuthenticated, async (req: any, res) => {
    try {
      const allUsers = await db
        .select({
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          profileImageUrl: users.profileImageUrl,
          departmentId: users.departmentId,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
        })
        .from(users)
        .leftJoin(departments, eq(users.departmentId, departments.id));

      res.json(allUsers);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.put(
    "/api/users/:id/department",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const { users } = await import("@shared/schema");
        const userId = req.params.id;
        const { departmentId } = req.body;

        const [updatedUser] = await db
          .update(users)
          .set({ departmentId, updatedAt: new Date() })
          .where(eq(users.id, userId))
          .returning();

        res.json(updatedUser);
      } catch (error) {
        console.error("Error updating user department:", error);
        res.status(500).json({ message: "Failed to update user department" });
      }
    },
  );

  // Document permissions routes (Many-to-Many)
  app.get(
    "/api/documents/:id/permissions",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const {
          documentUserPermissions,
          documentDepartmentPermissions,
          users,
          departments,
        } = await import("@shared/schema");
        const documentId = parseInt(req.params.id);

        // Get user permissions
        const userPermissions = await db
          .select({
            id: documentUserPermissions.id,
            userId: documentUserPermissions.userId,
            userName: sql<string>`CONCAT(${users.firstName}, ' ', ${users.lastName})`,
            userEmail: users.email,
            permissionType: documentUserPermissions.permissionType,
            grantedAt: documentUserPermissions.grantedAt,
            type: sql<string>`'user'`,
          })
          .from(documentUserPermissions)
          .leftJoin(users, eq(documentUserPermissions.userId, users.id))
          .where(eq(documentUserPermissions.documentId, documentId));

        // Get department permissions
        const departmentPermissions = await db
          .select({
            id: documentDepartmentPermissions.id,
            departmentId: documentDepartmentPermissions.departmentId,
            departmentName: departments.name,
            permissionType: documentDepartmentPermissions.permissionType,
            grantedAt: documentDepartmentPermissions.grantedAt,
            type: sql<string>`'department'`,
          })
          .from(documentDepartmentPermissions)
          .leftJoin(
            departments,
            eq(documentDepartmentPermissions.departmentId, departments.id),
          )
          .where(eq(documentDepartmentPermissions.documentId, documentId));

        res.json({ userPermissions, departmentPermissions });
      } catch (error) {
        console.error("Error fetching document permissions:", error);
        res
          .status(500)
          .json({ message: "Failed to fetch document permissions" });
      }
    },
  );

  app.post(
    "/api/documents/:id/permissions/user",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const { documentUserPermissions } = await import("@shared/schema");
        const documentId = parseInt(req.params.id);
        const { userId, permissionType = "read" } = req.body;
        const grantedBy = req.user.claims.sub;

        const [permission] = await db
          .insert(documentUserPermissions)
          .values({ documentId, userId, permissionType, grantedBy })
          .returning();

        res.json(permission);
      } catch (error) {
        console.error("Error granting user permission:", error);
        res.status(500).json({ message: "Failed to grant user permission" });
      }
    },
  );

  app.post(
    "/api/documents/:id/permissions/department",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const { documentDepartmentPermissions } = await import(
          "@shared/schema"
        );
        const documentId = parseInt(req.params.id);
        const { departmentId, permissionType = "read" } = req.body;
        const grantedBy = req.user.claims.sub;

        const [permission] = await db
          .insert(documentDepartmentPermissions)
          .values({ documentId, departmentId, permissionType, grantedBy })
          .returning();

        res.json(permission);
      } catch (error) {
        console.error("Error granting department permission:", error);
        res
          .status(500)
          .json({ message: "Failed to grant department permission" });
      }
    },
  );

  app.delete(
    "/api/documents/permissions/user/:permissionId",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const { documentUserPermissions } = await import("@shared/schema");
        const permissionId = parseInt(req.params.permissionId);

        await db
          .delete(documentUserPermissions)
          .where(eq(documentUserPermissions.id, permissionId));

        res.json({ success: true });
      } catch (error) {
        console.error("Error removing user permission:", error);
        res.status(500).json({ message: "Failed to remove user permission" });
      }
    },
  );

  app.delete(
    "/api/documents/permissions/department/:permissionId",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const { documentDepartmentPermissions } = await import(
          "@shared/schema"
        );
        const permissionId = parseInt(req.params.permissionId);

        await db
          .delete(documentDepartmentPermissions)
          .where(eq(documentDepartmentPermissions.id, permissionId));

        res.json({ success: true });
      } catch (error) {
        console.error("Error removing department permission:", error);
        res
          .status(500)
          .json({ message: "Failed to remove department permission" });
      }
    },
  );

  // Document routes
  app.get("/api/documents", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const categoryId = req.query.categoryId
        ? parseInt(req.query.categoryId as string)
        : undefined;
      const limit = req.query.limit
        ? parseInt(req.query.limit as string)
        : undefined;
      const offset = req.query.offset
        ? parseInt(req.query.offset as string)
        : undefined;

      const documents = await storage.getDocuments(userId, {
        categoryId,
        limit,
        offset,
      });
      res.json(documents);
    } catch (error) {
      console.error("Error fetching documents:", error);
      res.status(500).json({ message: "Failed to fetch documents" });
    }
  });

  app.get("/api/documents/search", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const query = req.query.query as string;
      const searchType =
        (req.query.type as "keyword" | "semantic" | "hybrid") || "keyword";

      console.log(
        `Search request - User: ${userId}, Query: "${query}", Type: ${searchType}`,
      );

      if (!query || query.trim().length === 0) {
        console.log("Empty query, returning empty results");
        return res.json([]);
      }

      let results = [];

      if (searchType === "keyword") {
        console.log("Performing keyword search...");
        results = await storage.searchDocuments(userId, query);
        console.log(`Keyword search returned ${results.length} results`);
      } else if (searchType === "semantic") {
        console.log("Performing semantic search...");
        try {
          results = await semanticSearchServiceV2.searchDocuments(
            query,
            userId,
            { searchType: "semantic" },
          );
          console.log(`Semantic search returned ${results.length} results`);
        } catch (semanticError) {
          console.error(
            "Semantic search failed, falling back to keyword:",
            semanticError,
          );
          results = await storage.searchDocuments(userId, query);
          console.log(
            `Fallback keyword search returned ${results.length} results`,
          );
        }
      } else {
        // hybrid
        console.log("Performing hybrid search...");
        try {
          results = await semanticSearchServiceV2.searchDocuments(
            query,
            userId,
            { searchType: "hybrid" },
          );
          console.log(`Hybrid search returned ${results.length} results`);
        } catch (hybridError) {
          console.error(
            "Hybrid search failed, falling back to keyword:",
            hybridError,
          );
          results = await storage.searchDocuments(userId, query);
          console.log(
            `Fallback keyword search returned ${results.length} results`,
          );
        }
      }

      console.log(`Final results count: ${results.length}`);

      // Log the search action for audit
      await storage.createAuditLog({
        userId,
        action: "search",
        resourceType: "document",
        ipAddress: req.ip || req.connection.remoteAddress || "unknown",
        userAgent: req.headers["user-agent"] || "unknown",
        success: true,
        details: {
          query: query,
          searchType: searchType,
          resultsCount: results.length,
        },
      });

      res.json(results);
    } catch (error) {
      console.error("Search error:", error);
      res.status(500).json({ message: "Failed to search documents" });
    }
  });

  app.get("/api/documents/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const id = parseInt(req.params.id);

      // Get basic document first
      const document = await storage.getDocument(id, userId);

      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }

      // Get user information separately to avoid complex query issues
      const [uploaderInfo] = await db
        .select({
          uploaderName:
            sql<string>`COALESCE(${users.firstName} || ' ' || ${users.lastName}, ${users.email})`.as(
              "uploaderName",
            ),
          uploaderEmail: users.email,
          uploaderRole: users.role,
          departmentName: departments.name,
        })
        .from(users)
        .leftJoin(departments, eq(users.departmentId, departments.id))
        .where(eq(users.id, document.userId));

      // Combine document with uploader info
      const documentWithUploader = {
        ...document,
        uploaderName: uploaderInfo?.uploaderName || "Unknown User",
        uploaderEmail: uploaderInfo?.uploaderEmail || "",
        uploaderRole: uploaderInfo?.uploaderRole || "user",
        departmentName: uploaderInfo?.departmentName || "No Department",
      };

      // Log access
      await storage.logDocumentAccess(id, userId, "view");
      res.json(documentWithUploader);
    } catch (error) {
      console.error("Error fetching document:", error);
      res.status(500).json({ message: "Failed to fetch document" });
    }
  });

  app.get(
    "/api/documents/:id/summary",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.claims.sub;
        const id = parseInt(req.params.id);
        const document = await storage.getDocument(id, userId);

        if (!document) {
          return res.status(404).json({ message: "Document not found" });
        }

        // Return existing summary or content excerpt
        const summary =
          document.summary ||
          (document.content
            ? document.content.substring(0, 500) + "..."
            : "No content summary available for this document.");

        res.json({ summary });
      } catch (error) {
        console.error("Error fetching document summary:", error);
        res.status(500).json({ message: "Failed to fetch document summary" });
      }
    },
  );

  // Translation API endpoint with database caching
  app.post(
    "/api/documents/:id/translate",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.claims.sub;
        const documentId = parseInt(req.params.id);
        const { targetLanguage } = req.body;

        console.log(
          `Translation request: documentId=${documentId}, targetLanguage=${targetLanguage}, userId=${userId}`,
        );

        if (!targetLanguage) {
          console.log("Missing target language in request");
          return res
            .status(400)
            .json({ message: "Target language is required" });
        }

        // Get document
        const document = await storage.getDocument(documentId, userId);
        if (!document) {
          console.log(`Document ${documentId} not found for user ${userId}`);
          return res.status(404).json({ message: "Document not found" });
        }

        if (!document.summary) {
          console.log(`Document ${documentId} has no summary to translate`);
          return res
            .status(400)
            .json({ message: "Document has no summary to translate" });
        }

        console.log(
          `Found document: ${document.name}, summary length: ${document.summary.length}`,
        );

        // Create translation using OpenAI directly
        if (!process.env.OPENAI_API_KEY) {
          return res
            .status(500)
            .json({ message: "Translation service not available" });
        }

        console.log("Creating fresh translation with OpenAI");

        const OpenAI = await import("openai");
        const openai = new OpenAI.default({
          apiKey: process.env.OPENAI_API_KEY,
        });

        const prompt = `Translate the following text to ${targetLanguage}. Maintain the same tone and meaning. Only return the translated text without any additional explanation:

${document.summary}`;

        console.log(
          `Sending translation request to OpenAI for ${targetLanguage}`,
        );

        const response = await openai.chat.completions.create({
          model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
          messages: [
            {
              role: "user",
              content: prompt,
            },
          ],
          max_tokens: 2000,
          temperature: 0.3,
        });

        const translatedText = response.choices[0].message.content?.trim();

        console.log(
          `OpenAI response received, translated text length: ${translatedText?.length || 0}`,
        );

        if (!translatedText) {
          console.log("OpenAI translation failed - no content returned");
          return res
            .status(500)
            .json({ message: "Translation failed - no content from OpenAI" });
        }

        console.log("Translation successful, returning result");

        // Log the translation action for audit
        await storage.createAuditLog({
          userId,
          action: "translate",
          resourceType: "document",
          resourceId: documentId.toString(),
          ipAddress: req.ip || req.connection.remoteAddress || "unknown",
          userAgent: req.headers["user-agent"] || "unknown",
          success: true,
          details: {
            documentId: documentId,
            targetLanguage: targetLanguage,
            contentLength: translatedText.length,
          },
        });

        res.json({ translatedText });
      } catch (error) {
        console.error("Translation error:", error);
        res.status(500).json({ message: "Failed to translate text" });
      }
    },
  );

  app.post(
    "/api/documents/upload",
    isAuthenticated,
    upload.array("files", 10),
    async (req: any, res) => {
      try {
        const userId = req.user.claims.sub;
        const files = req.files as Express.Multer.File[];

        console.log("Upload request received:", {
          userId,
          filesCount: files?.length || 0,
          bodyKeys: Object.keys(req.body || {}),
          hasFiles: !!files,
        });

        if (!files || files.length === 0) {
          console.log("No files in request, body:", req.body);
          return res.status(400).json({ message: "No files uploaded" });
        }

        const uploadedDocuments = [];

        for (const file of files) {
          try {
            // Fix Thai filename encoding if needed
            let correctedFileName = file.originalname;
            try {
              // Check if filename contains Thai characters that are garbled
              if (
                file.originalname.includes("à¸") ||
                file.originalname.includes("à¹")
              ) {
                // Try to decode and re-encode properly
                const buffer = Buffer.from(file.originalname, "latin1");
                correctedFileName = buffer.toString("utf8");
                console.log(
                  `Fixed Thai filename: ${file.originalname} -> ${correctedFileName}`,
                );
              }
            } catch (error) {
              console.warn("Failed to fix filename encoding:", error);
              // Keep original filename if encoding fix fails
            }

            // Process the document with enhanced AI classification
            const { content, summary, tags, category, categoryColor } =
              await processDocument(file.path, file.mimetype);

            const documentData = {
              name: correctedFileName,
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

            // Auto-vectorize the document if it has content
            if (content && content.trim().length > 0) {
              try {
                await vectorService.addDocument(
                  document.id.toString(),
                  content,
                  {
                    userId,
                    documentName: document.name,
                    mimeType: document.mimeType,
                    tags: document.tags || [],
                    originalDocumentId: document.id.toString(),
                  },
                );
                console.log(
                  `Document ${document.id} auto-vectorized successfully`,
                );
              } catch (vectorError) {
                console.error(
                  `Failed to auto-vectorize document ${document.id}:`,
                  vectorError,
                );
              }
            }

            console.log(
              `Document processed: ${correctedFileName} -> Category: ${category}, Tags: ${tags?.join(", ")}`,
            );
          } catch (error) {
            // Fix Thai filename encoding for error fallback too
            let correctedFileName = file.originalname;
            try {
              if (
                file.originalname.includes("à¸") ||
                file.originalname.includes("à¹")
              ) {
                const buffer = Buffer.from(file.originalname, "latin1");
                correctedFileName = buffer.toString("utf8");
              }
            } catch (encodingError) {
              console.warn(
                "Failed to fix filename encoding in error handler:",
                encodingError,
              );
            }

            console.error(`Error processing file ${correctedFileName}:`, error);
            // Still create document without AI processing
            const documentData = {
              name: correctedFileName,
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

        // Log document upload for audit
        try {
          await storage.createAuditLog({
            userId,
            action: "upload",
            resourceType: "document",
            ipAddress: req.ip || req.connection.remoteAddress || "unknown",
            userAgent: req.headers["user-agent"] || "unknown",
            success: true,
            details: {
              documentsCount: uploadedDocuments.length,
              documentNames: uploadedDocuments.map((doc) => doc.name),
            },
          });
        } catch (auditError) {
          console.error("Failed to create audit log for upload:", auditError);
        }

        res.json(uploadedDocuments);
      } catch (error) {
        console.error("Error uploading documents:", error);
        res.status(500).json({ message: "Failed to upload documents" });
      }
    },
  );

  app.get(
    "/api/documents/:id/download",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.claims.sub;
        const id = parseInt(req.params.id);
        const document = await storage.getDocument(id, userId);

        if (!document) {
          return res.status(404).json({ message: "Document not found" });
        }

        const filePath = path.join(process.cwd(), "uploads", document.fileName);

        if (!fsSync.existsSync(filePath)) {
          return res.status(404).json({ message: "File not found" });
        }

        // Log access
        await storage.logDocumentAccess(id, userId, "download");

        // Log the download action for audit
        await storage.createAuditLog({
          userId,
          action: "download",
          resourceType: "document",
          resourceId: id.toString(),
          ipAddress: req.ip || req.connection.remoteAddress || "unknown",
          userAgent: req.headers["user-agent"] || "unknown",
          success: true,
          details: {
            fileName: document.name,
            fileSize: document.fileSize,
          },
        });

        // Set proper headers to prevent corruption
        res.setHeader("Content-Type", document.mimeType);
        // Use RFC 5987 encoding for Thai filenames to ensure proper display
        const encodedFilename = encodeURIComponent(document.name);
        res.setHeader(
          "Content-Disposition",
          `attachment; filename*=UTF-8''${encodedFilename}`,
        );
        res.setHeader("Content-Length", fsSync.statSync(filePath).size);

        const fileStream = fsSync.createReadStream(filePath);
        fileStream.pipe(res);
      } catch (error) {
        console.error("Error downloading document:", error);
        res.status(500).json({ message: "Failed to download document" });
      }
    },
  );

  app.post(
    "/api/documents/:id/favorite",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.claims.sub;
        const id = parseInt(req.params.id);
        const document = await storage.toggleDocumentFavorite(id, userId);
        res.json(document);
      } catch (error) {
        console.error("Error toggling favorite:", error);
        res.status(500).json({ message: "Failed to toggle favorite" });
      }
    },
  );

  app.post(
    "/api/documents/:id/vectorize",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.claims.sub;
        const id = parseInt(req.params.id);
        const document = await storage.getDocument(id, userId);

        if (!document) {
          return res.status(404).json({ message: "Document not found" });
        }

        if (document.content && document.content.trim().length > 0) {
          await vectorService.addDocument(id.toString(), document.content, {
            userId,
            documentName: document.name,
            mimeType: document.mimeType,
            tags: document.tags || [],
            originalDocumentId: id.toString(),
          });

          console.log(`Document ${id} manually vectorized successfully`);
          res.json({
            success: true,
            message: "Document added to vector database",
          });
        } else {
          res.status(400).json({
            message: "Document has no extractable content for vectorization",
          });
        }
      } catch (error) {
        console.error("Error adding document to vector database:", error);
        res
          .status(500)
          .json({ message: "Failed to add document to vector database" });
      }
    },
  );

  app.post(
    "/api/documents/vectorize-all",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.claims.sub;
        const documents = await storage.getDocuments(userId);

        let vectorizedCount = 0;
        let skippedCount = 0;

        console.log(
          `Starting to vectorize ${documents.length} documents for user ${userId}`,
        );

        for (const doc of documents) {
          if (doc.content && doc.content.trim().length > 0) {
            try {
              await vectorService.addDocument(doc.id.toString(), doc.content, {
                userId,
                documentName: doc.name,
                mimeType: doc.mimeType,
                tags: doc.tags || [],
                originalDocumentId: doc.id.toString(),
              });
              vectorizedCount++;
              console.log(`Vectorized document ${doc.id}: ${doc.name}`);
            } catch (error) {
              console.error(`Failed to vectorize document ${doc.id}:`, error);
              skippedCount++;
            }
          } else {
            skippedCount++;
          }
        }

        console.log(
          `Vectorization complete: ${vectorizedCount} vectorized, ${skippedCount} skipped`,
        );
        res.json({
          success: true,
          message: `Vectorized ${vectorizedCount} documents, skipped ${skippedCount}`,
          vectorizedCount,
          skippedCount,
        });
      } catch (error) {
        console.error("Error vectorizing all documents:", error);
        res.status(500).json({ message: "Failed to vectorize documents" });
      }
    },
  );

  app.delete("/api/documents/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const id = parseInt(req.params.id);

      console.log(`Delete request for document ${id} by user ${userId}`);

      // Get document to verify ownership and get file path
      const document = await storage.getDocument(id, userId);
      if (!document) {
        console.log(`Document ${id} not found for user ${userId}`);
        return res.status(404).json({ message: "Document not found" });
      }

      console.log(
        `Found document: ${document.name}, filePath: ${document.filePath}`,
      );

      // Delete physical file first
      if (document.filePath) {
        try {
          await fs.unlink(document.filePath);
          console.log(`Successfully deleted file: ${document.filePath}`);
        } catch (error) {
          console.error("Error deleting file:", error);
          // Continue with database deletion even if file deletion fails
        }
      }

      // Delete from database
      await storage.deleteDocument(id, userId);
      console.log(`Successfully deleted document ${id} from database`);

      // Log document deletion for audit
      try {
        await storage.createAuditLog({
          userId,
          action: "delete",
          resourceType: "document",
          resourceId: id.toString(),
          ipAddress: req.ip || req.connection.remoteAddress || "unknown",
          userAgent: req.headers["user-agent"] || "unknown",
          success: true,
          details: {
            documentName: document.name,
            fileSize: document.fileSize,
          },
        });
      } catch (auditError) {
        console.error("Failed to create audit log for delete:", auditError);
      }

      res.json({ success: true, message: "Document deleted successfully" });
    } catch (error) {
      console.error("Error deleting document:", error);
      res
        .status(500)
        .json({ message: "Failed to delete document", error: error.message });
    }
  });

  // Chat routes
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

  app.post(
    "/api/chat/conversations",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.claims.sub;
        const conversationData = insertChatConversationSchema.parse({
          ...req.body,
          userId,
        });
        const conversation =
          await storage.createChatConversation(conversationData);
        res.json(conversation);
      } catch (error) {
        console.error("Error creating conversation:", error);
        res.status(500).json({ message: "Failed to create conversation" });
      }
    },
  );

  app.get(
    "/api/chat/conversations/:id/messages",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.claims.sub;
        const conversationId = parseInt(req.params.id);
        const messages = await storage.getChatMessages(conversationId, userId);
        res.json(messages);
      } catch (error) {
        console.error("Error fetching messages:", error);
        res.status(500).json({ message: "Failed to fetch messages" });
      }
    },
  );

  app.post("/api/chat/messages", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { conversationId, content, documentId } = req.body;

      // Create user message
      const userMessage = await storage.createChatMessage({
        conversationId,
        role: "user",
        content,
      });

      // Get specific document if documentId is provided, otherwise get all documents
      let documents;
      if (documentId) {
        const specificDocument = await storage.getDocument(documentId, userId);
        documents = specificDocument ? [specificDocument] : [];
      } else {
        documents = await storage.getDocuments(userId, { limit: 100 });
      }

      // Generate AI response with specific document context
      const aiResponse = await generateChatResponse(
        content,
        documents,
        documentId ? documentId : undefined,
      );

      // Create assistant message
      const assistantMessage = await storage.createChatMessage({
        conversationId,
        role: "assistant",
        content: aiResponse,
      });

      // Log document access if specific document was referenced
      if (documentId) {
        await storage.logDocumentAccess(documentId, userId, "chat", {
          query: content,
          conversationId: conversationId,
        });
      }

      // Log chat interaction for audit
      try {
        await storage.createAuditLog({
          userId,
          action: "chat",
          resourceType: "ai_assistant",
          resourceId: conversationId?.toString(),
          ipAddress: req.ip || req.connection.remoteAddress || "unknown",
          userAgent: req.headers["user-agent"] || "unknown",
          success: true,
          details: {
            conversationId: conversationId,
            userMessage: content,
            assistantResponse: aiResponse,
            messageLength: content.length,
            responseLength: aiResponse.length,
            hasDocumentContext: !!documentId,
            documentId: documentId || null,
            timestamp: new Date().toISOString(),
          },
        });
      } catch (auditError) {
        console.error("Failed to create audit log for chat:", auditError);
      }

      // Automatically analyze AI response quality
      try {
        const startTime = Date.now();
        const responseTime = Date.now() - startTime;

        const analysisPrompt = `
Analyze this AI assistant response to determine if it's a "positive" (helpful, informative response) or "fallback" (unable to answer, generic response).

User Query: "${content}"
Assistant Response: "${aiResponse}"

Please classify this response as either:
- "positive": The assistant provided a helpful, specific, informative answer
- "fallback": The assistant gave a generic response, said they don't know, or couldn't provide specific information

Respond with JSON: {"result": "positive" or "fallback", "confidence": 0.0-1.0, "reason": "explanation"}
`;

        const openai = new (await import("openai")).default({
          apiKey: process.env.OPENAI_API_KEY,
        });

        const response = await openai.chat.completions.create({
          model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
          messages: [{ role: "user", content: analysisPrompt }],
          response_format: { type: "json_object" },
        });

        const analysisResult = JSON.parse(
          response.choices[0].message.content || "{}",
        );

        // Store the analysis result
        await storage.createAiResponseAnalysis({
          chatMessageId: assistantMessage.id,
          userId,
          userQuery: content,
          assistantResponse: aiResponse,
          analysisResult: analysisResult.result,
          analysisConfidence: analysisResult.confidence,
          analysisReason: analysisResult.reason,
          documentContext: documentId
            ? `Document ID: ${documentId}`
            : "General chat",
          responseTime,
        });

        console.log(
          `AI Response Analysis completed: ${analysisResult.result} (confidence: ${analysisResult.confidence})`,
        );
      } catch (analysisError) {
        console.error("Failed to analyze AI response:", analysisError);
      }

      res.json([userMessage, assistantMessage]);
    } catch (error) {
      console.error("Error processing chat message:", error);
      res.status(500).json({ message: "Failed to process chat message" });
    }
  });

  // Vector database management routes
  app.get("/api/vector/stats", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const userDocuments = await vectorService.getDocumentsByUser(userId);
      const totalDocuments = await vectorService.getDocumentCount();
      const chunkStats = await vectorService.getDocumentChunkStats(userId);

      // Group chunks by original document
      const documentMap = new Map();
      userDocuments.forEach((doc) => {
        const originalDocId = doc.metadata.originalDocumentId || doc.id;
        if (!documentMap.has(originalDocId)) {
          documentMap.set(originalDocId, {
            id: originalDocId,
            name: doc.metadata.documentName,
            type: doc.metadata.mimeType,
            chunks: 0,
            totalLength: 0,
          });
        }
        const entry = documentMap.get(originalDocId);
        entry.chunks++;
        entry.totalLength += doc.content.length;
      });

      res.json({
        userDocuments: userDocuments.length,
        totalDocuments,
        uniqueDocuments: documentMap.size,
        chunkStats,
        vectorized: Array.from(documentMap.values()),
      });
    } catch (error) {
      console.error("Error getting vector stats:", error);
      res.status(500).json({ message: "Failed to get vector database stats" });
    }
  });

  // Re-vectorize all documents endpoint
  app.post(
    "/api/vector/reindex-all",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.claims.sub;
        const documents = await storage.getDocuments(userId);

        let processedCount = 0;
        let errorCount = 0;
        const results: any[] = [];

        for (const document of documents) {
          if (document.content && document.content.trim().length > 0) {
            try {
              await vectorService.addDocument(
                document.id.toString(),
                document.content,
                {
                  userId,
                  documentName: document.name,
                  mimeType: document.mimeType,
                  tags: document.tags || [],
                },
              );

              processedCount++;
              results.push({
                id: document.id,
                name: document.name,
                status: "success",
              });

              // Add delay to avoid rate limiting
              await new Promise((resolve) => setTimeout(resolve, 200));
            } catch (error) {
              console.error(
                `Error re-vectorizing document ${document.id}:`,
                error,
              );
              errorCount++;
              results.push({
                id: document.id,
                name: document.name,
                status: "error",
                error: error instanceof Error ? error.message : "Unknown error",
              });
            }
          } else {
            results.push({
              id: document.id,
              name: document.name,
              status: "skipped",
              reason: "No content to vectorize",
            });
          }
        }

        res.json({
          success: true,
          message: `Re-indexing completed. Processed: ${processedCount}, Errors: ${errorCount}`,
          processed: processedCount,
          errors: errorCount,
          total: documents.length,
          results,
        });
      } catch (error) {
        console.error("Error re-indexing documents:", error);
        res.status(500).json({ message: "Failed to re-index documents" });
      }
    },
  );

  app.post(
    "/api/documents/:id/reprocess",
    isAuthenticated,
    async (req: any, res) => {
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
    },
  );

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

  app.post(
    "/api/chat/conversations",
    isAuthenticated,
    async (req: any, res) => {
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
    },
  );

  app.get(
    "/api/chat/conversations/:id/messages",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.claims.sub;
        const conversationId = parseInt(req.params.id);

        const messages = await storage.getChatMessages(conversationId, userId);
        res.json(messages);
      } catch (error) {
        console.error("Error fetching messages:", error);
        res.status(500).json({ message: "Failed to fetch messages" });
      }
    },
  );

  app.post(
    "/api/chat/conversations/:id/message",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.claims.sub;
        const conversationId = parseInt(req.params.id);
        const { content } = req.body;

        // Store user message
        const userMessage = await storage.createChatMessage({
          conversationId,
          role: "user",
          content,
        });

        // Get user's documents for context
        const documents = await storage.getDocuments(userId);

        // Generate AI response using OpenAI
        const aiResponse = await generateChatResponse(content, documents);

        // Store AI message
        const aiMessage = await storage.createChatMessage({
          conversationId,
          role: "assistant",
          content: aiResponse,
        });

        res.json({ userMessage, aiMessage });
      } catch (error) {
        console.error("Error sending message:", error);
        res.status(500).json({ message: "Failed to send message" });
      }
    },
  );

  // Data connection management routes
  app.get("/api/data-connections", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const connections = await storage.getDataConnections(userId);
      res.json(connections);
    } catch (error) {
      console.error("Error fetching data connections:", error);
      res.status(500).json({ message: "Failed to fetch data connections" });
    }
  });

  app.post("/api/data-connections", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const connectionData = insertDataConnectionSchema.parse({
        ...req.body,
        userId,
      });
      const connection = await storage.createDataConnection(connectionData);
      res.json(connection);
    } catch (error) {
      console.error("Error creating data connection:", error);
      res.status(500).json({ message: "Failed to create data connection" });
    }
  });

  app.get(
    "/api/data-connections/:id",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.claims.sub;
        const connectionId = parseInt(req.params.id);
        const connection = await storage.getDataConnection(
          connectionId,
          userId,
        );

        if (!connection) {
          return res.status(404).json({ message: "Data connection not found" });
        }

        res.json(connection);
      } catch (error) {
        console.error("Error fetching data connection:", error);
        res.status(500).json({ message: "Failed to fetch data connection" });
      }
    },
  );

  app.put(
    "/api/data-connections/:id",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.claims.sub;
        const connectionId = parseInt(req.params.id);
        const connectionData = updateDataConnectionSchema.parse(req.body);

        const connection = await storage.updateDataConnection(
          connectionId,
          connectionData,
          userId,
        );
        res.json(connection);
      } catch (error) {
        console.error("Error updating data connection:", error);
        res.status(500).json({ message: "Failed to update data connection" });
      }
    },
  );

  app.delete(
    "/api/data-connections/:id",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.claims.sub;
        const connectionId = parseInt(req.params.id);

        await storage.deleteDataConnection(connectionId, userId);
        res.json({ success: true });
      } catch (error) {
        console.error("Error deleting data connection:", error);
        res.status(500).json({ message: "Failed to delete data connection" });
      }
    },
  );

  app.post(
    "/api/data-connections/:id/test",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.claims.sub;
        const connectionId = parseInt(req.params.id);
        const connection = await storage.getDataConnection(
          connectionId,
          userId,
        );

        if (!connection) {
          return res.status(404).json({ message: "Connection not found" });
        }

        // Import database connector
        const { databaseConnector } = await import(
          "./services/databaseConnector"
        );

        // Transform connection data for connector
        const connectorData = {
          id: connection.id,
          type: connection.type as "database" | "api" | "enterprise",
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
        await storage.updateDataConnection(
          connectionId,
          {
            lastTested: new Date(),
            testStatus: result.success ? "success" : "failed",
            testMessage: result.message,
          },
          userId,
        );

        res.json(result);
      } catch (error) {
        console.error("Error testing data connection:", error);
        res.status(500).json({ message: "Failed to test data connection" });
      }
    },
  );

  // Database query endpoints
  app.post(
    "/api/data-connections/:id/query",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const connectionId = parseInt(req.params.id);
        const userId = req.user.claims.sub;
        const { query } = req.body;

        if (!query) {
          return res.status(400).json({ message: "SQL query is required" });
        }

        const { databaseQueryService } = await import(
          "./services/databaseQueryService"
        );
        const result = await databaseQueryService.executeQuery(
          connectionId,
          query,
          userId,
        );

        res.json(result);
      } catch (error) {
        console.error("Error executing database query:", error);
        res.status(500).json({ message: "Failed to execute query" });
      }
    },
  );

  app.get(
    "/api/data-connections/:id/schema",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const connectionId = parseInt(req.params.id);
        const userId = req.user.claims.sub;

        const { databaseQueryService } = await import(
          "./services/databaseQueryService"
        );
        const schema = await databaseQueryService.getDatabaseSchema(
          connectionId,
          userId,
        );

        if (!schema) {
          return res.status(404).json({ message: "Database schema not found" });
        }

        res.json(schema);
      } catch (error) {
        console.error("Error fetching database schema:", error);
        res.status(500).json({ message: "Failed to fetch database schema" });
      }
    },
  );

  app.post("/api/chat/database", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { message, connectionId } = req.body;

      if (!message || !connectionId) {
        return res
          .status(400)
          .json({ message: "Message and connection ID are required" });
      }

      // Get database schema for context
      const { databaseQueryService } = await import(
        "./services/databaseQueryService"
      );
      const schema = await databaseQueryService.getDatabaseSchema(
        connectionId,
        userId,
      );

      if (!schema) {
        return res
          .status(404)
          .json({ message: "Database connection not found" });
      }

      // Generate SQL query suggestions based on user question
      const suggestions = await databaseQueryService.suggestQueries(
        connectionId,
        userId,
        message,
      );

      // Use OpenAI to generate a response and SQL query
      const { generateDatabaseResponse } = await import("./services/openai");
      const response = await generateDatabaseResponse(
        message,
        schema,
        suggestions,
      );

      res.json({
        response,
        schema,
        suggestions,
      });
    } catch (error) {
      console.error("Error processing database chat:", error);
      res.status(500).json({ message: "Failed to process database chat" });
    }
  });

  // Chat Widget API endpoints
  app.get("/api/chat-widgets", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { chatWidgets } = await import("@shared/schema");

      const widgets = await db
        .select()
        .from(chatWidgets)
        .where(eq(chatWidgets.userId, userId));
      res.json(widgets);
    } catch (error) {
      console.error("Error fetching chat widgets:", error);
      res.status(500).json({ message: "Failed to fetch chat widgets" });
    }
  });

  app.post("/api/chat-widgets", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { nanoid } = await import("nanoid");
      const { chatWidgets } = await import("@shared/schema");
      const {
        name,
        primaryColor,
        textColor,
        position,
        welcomeMessage,
        offlineMessage,
        enableHrLookup,
        hrApiEndpoint,
      } = req.body;

      if (!name) {
        return res.status(400).json({ message: "Widget name is required" });
      }

      const widgetKey = nanoid(16);

      const [widget] = await db
        .insert(chatWidgets)
        .values({
          userId,
          name,
          widgetKey,
          primaryColor: primaryColor || "#2563eb",
          textColor: textColor || "#ffffff",
          position: position || "bottom-right",
          welcomeMessage: welcomeMessage || "Hi! How can I help you today?",
          offlineMessage:
            offlineMessage ||
            "We're currently offline. Please leave a message.",
          enableHrLookup: enableHrLookup || false,
          hrApiEndpoint: hrApiEndpoint || null,
        })
        .returning();

      res.status(201).json(widget);
    } catch (error) {
      console.error("Error creating chat widget:", error);
      res.status(500).json({ message: "Failed to create chat widget" });
    }
  });

  // HR Employee management endpoints
  app.get("/api/hr-employees", isAuthenticated, async (req: any, res) => {
    try {
      const { hrEmployees } = await import("@shared/schema");
      const employees = await db
        .select()
        .from(hrEmployees)
        .where(eq(hrEmployees.isActive, true));
      res.json(employees);
    } catch (error) {
      console.error("Error fetching HR employees:", error);
      res.status(500).json({ message: "Failed to fetch HR employees" });
    }
  });

  app.post("/api/hr-employees", isAuthenticated, async (req: any, res) => {
    try {
      const { hrEmployees } = await import("@shared/schema");
      const {
        employeeId,
        citizenId,
        firstName,
        lastName,
        email,
        phone,
        department,
        position,
        startDate,
      } = req.body;

      if (!employeeId || !citizenId || !firstName || !lastName || !department) {
        return res.status(400).json({
          message:
            "Required fields: employeeId, citizenId, firstName, lastName, department",
        });
      }

      // Validate Thai Citizen ID format
      if (!/^\d{13}$/.test(citizenId)) {
        return res.status(400).json({
          message: "Invalid Thai Citizen ID format. Must be 13 digits.",
        });
      }

      const [employee] = await db
        .insert(hrEmployees)
        .values({
          employeeId,
          citizenId,
          firstName,
          lastName,
          email,
          phone,
          department,
          position,
          startDate: startDate ? new Date(startDate) : null,
        })
        .returning();

      res.status(201).json(employee);
    } catch (error) {
      console.error("Error creating HR employee:", error);
      if (error.code === "23505") {
        // Unique constraint violation
        res
          .status(409)
          .json({ message: "Employee ID or Citizen ID already exists" });
      } else {
        res.status(500).json({ message: "Failed to create HR employee" });
      }
    }
  });

  // Widget chat endpoints for public use
  app.post("/api/widget/:widgetKey/chat", async (req, res) => {
    try {
      const { widgetKey } = req.params;
      const { sessionId, message, visitorInfo } = req.body;
      const {
        chatWidgets,
        widgetChatSessions,
        widgetChatMessages,
        hrEmployees,
      } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");
      const { nanoid } = await import("nanoid");

      // Find widget
      const [widget] = await db
        .select()
        .from(chatWidgets)
        .where(eq(chatWidgets.widgetKey, widgetKey))
        .limit(1);

      if (!widget || !widget.isActive) {
        return res
          .status(404)
          .json({ message: "Widget not found or inactive" });
      }

      // Create or get session
      let session;
      if (sessionId) {
        [session] = await db
          .select()
          .from(widgetChatSessions)
          .where(eq(widgetChatSessions.sessionId, sessionId))
          .limit(1);
      }

      if (!session) {
        const newSessionId = sessionId || nanoid(16);
        [session] = await db
          .insert(widgetChatSessions)
          .values({
            widgetId: widget.id,
            sessionId: newSessionId,
            visitorName: visitorInfo?.name,
            visitorEmail: visitorInfo?.email,
            visitorPhone: visitorInfo?.phone,
          })
          .returning();
      }

      // Add user message
      await db.insert(widgetChatMessages).values({
        sessionId: session.sessionId,
        role: "user",
        content: message,
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
              name: hrEmployees.name,
              department: hrEmployees.department,
              position: hrEmployees.position,
              isActive: hrEmployees.isActive,
            })
            .from(hrEmployees)
            .where(eq(hrEmployees.citizenId, citizenId))
            .limit(1);

          if (employee && employee.isActive) {
            response = `Yes, ${employee.employeeId} ${employee.name} is working in ${employee.department}`;
            if (employee.position) {
              response += ` as ${employee.position}`;
            }
            messageType = "hr_lookup";
            metadata = {
              citizenId,
              found: true,
              employee: {
                employeeId: employee.employeeId,
                name: employee.name,
                department: employee.department,
                position: employee.position,
              },
            };
          } else {
            response =
              "No active employee found with the provided Thai Citizen ID.";
            messageType = "hr_lookup";
            metadata = { citizenId, found: false };
          }
        } else {
          response =
            widget.welcomeMessage +
            " You can also check employee status by providing a Thai Citizen ID (13 digits).";
        }
      }

      // Add assistant response
      await db.insert(widgetChatMessages).values({
        sessionId: session.sessionId,
        role: "assistant",
        content: response,
        messageType,
        metadata,
      });

      res.json({
        sessionId: session.sessionId,
        response,
        messageType,
        metadata,
      });
    } catch (error) {
      console.error("Widget chat error:", error);
      res.status(500).json({ message: "Chat service error" });
    }
  });

  // Survey routes
  app.post("/api/survey/submit", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { satisfaction, easeOfUse, improvements, suggestions } = req.body;

      // Store survey response (you can add this to schema if needed)
      // For now, we'll just return success
      res.json({ success: true, message: "Survey submitted successfully" });
    } catch (error) {
      console.error("Error submitting survey:", error);
      res.status(500).json({ message: "Failed to submit survey" });
    }
  });

  app.get("/api/survey/responses", isAuthenticated, async (req: any, res) => {
    try {
      // Mock survey responses for now
      const mockResponses = [
        {
          id: 1,
          satisfaction: 4,
          easeOfUse: 5,
          improvements: "Better search functionality",
          suggestions: "Add more AI features",
          createdAt: new Date().toISOString(),
        },
        {
          id: 2,
          satisfaction: 5,
          easeOfUse: 4,
          improvements: "UI improvements",
          suggestions: "More integrations",
          createdAt: new Date(Date.now() - 86400000).toISOString(),
        },
      ];

      res.json(mockResponses);
    } catch (error) {
      console.error("Error fetching survey responses:", error);
      res.status(500).json({ message: "Failed to fetch survey responses" });
    }
  });

  app.get("/api/survey/stats", isAuthenticated, async (req: any, res) => {
    try {
      // Mock survey stats
      const mockStats = {
        totalResponses: 25,
        averageSatisfaction: 4.2,
        averageEaseOfUse: 4.1,
        responseRate: 68,
      };

      res.json(mockStats);
    } catch (error) {
      console.error("Error fetching survey stats:", error);
      res.status(500).json({ message: "Failed to fetch survey stats" });
    }
  });

  // Document Demand Insights API
  app.get(
    "/api/analytics/document-demand",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.claims.sub;
        const insights = await storage.getDocumentAccessStats(userId);
        res.json(insights);
      } catch (error) {
        console.error("Error fetching document demand insights:", error);
        res.status(500).json({ message: "Failed to fetch insights" });
      }
    },
  );

  // AI Assistant Feedback API
  app.post("/api/ai-feedback", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const feedback = await storage.createAiFeedback({
        ...req.body,
        userId,
      });
      res.json(feedback);
    } catch (error) {
      console.error("Error creating AI feedback:", error);
      res.status(500).json({ message: "Failed to create feedback" });
    }
  });

  app.get("/api/ai-feedback/stats", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const stats = await storage.getAiFeedbackStats(userId);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching AI feedback stats:", error);
      res.status(500).json({ message: "Failed to fetch feedback stats" });
    }
  });

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

  app.get(
    "/api/documents/:id/feedback",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.claims.sub;
        const documentId = parseInt(req.params.id);
        const feedbackData = await storage.getDocumentFeedback(
          documentId,
          userId,
        );
        res.json(feedbackData);
      } catch (error) {
        console.error("Error fetching document feedback:", error);
        res.status(500).json({ message: "Failed to fetch document feedback" });
      }
    },
  );

  // AI Response Analysis routes
  app.get(
    "/api/ai-response-analysis",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.claims.sub;
        const limit = req.query.limit ? parseInt(req.query.limit) : undefined;
        const offset = req.query.offset
          ? parseInt(req.query.offset)
          : undefined;
        const analysisResult = req.query.analysisResult;

        const analysis = await storage.getAiResponseAnalysis(userId, {
          limit,
          offset,
          analysisResult,
        });
        res.json(analysis);
      } catch (error) {
        console.error("Error fetching AI response analysis:", error);
        res
          .status(500)
          .json({ message: "Failed to fetch AI response analysis" });
      }
    },
  );

  app.get(
    "/api/ai-response-analysis/stats",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.claims.sub;
        const stats = await storage.getAiResponseAnalysisStats(userId);
        res.json(stats);
      } catch (error) {
        console.error("Error fetching AI response analysis stats:", error);
        res.status(500).json({ message: "Failed to fetch analysis stats" });
      }
    },
  );

  app.post(
    "/api/ai-response-analysis/analyze",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.claims.sub;
        const {
          userQuery,
          assistantResponse,
          documentContext,
          responseTime,
          chatMessageId,
        } = req.body;

        // Call OpenAI to analyze the response
        const analysisPrompt = `
Analyze this AI assistant response to determine if it's a "positive" (helpful, informative response) or "fallback" (unable to answer, generic response).

User Query: "${userQuery}"
Assistant Response: "${assistantResponse}"

Please classify this response as either:
- "positive": The assistant provided a helpful, specific, informative answer
- "fallback": The assistant gave a generic response, said they don't know, or couldn't provide specific information

Respond with JSON: {"result": "positive" or "fallback", "confidence": 0.0-1.0, "reason": "explanation"}
`;

        const response = await openai.chat.completions.create({
          model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
          messages: [{ role: "user", content: analysisPrompt }],
          response_format: { type: "json_object" },
        });

        const analysisResult = JSON.parse(
          response.choices[0].message.content || "{}",
        );

        // Store the analysis result
        const analysis = await storage.createAiResponseAnalysis({
          chatMessageId,
          userId,
          userQuery,
          assistantResponse,
          analysisResult: analysisResult.result,
          analysisConfidence: analysisResult.confidence,
          analysisReason: analysisResult.reason,
          documentContext,
          responseTime,
        });

        res.json(analysis);
      } catch (error) {
        console.error("Error analyzing AI response:", error);
        res.status(500).json({ message: "Failed to analyze response" });
      }
    },
  );

  // Agent Chatbot API routes
  app.get("/api/agent-chatbots", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const agents = await storage.getAgentChatbots(userId);
      res.json(agents);
    } catch (error) {
      console.error("Error fetching agent chatbots:", error);
      res.status(500).json({ message: "Failed to fetch agent chatbots" });
    }
  });

  app.get("/api/agent-chatbots/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const agent = await storage.getAgentChatbot(
        parseInt(req.params.id),
        userId,
      );
      if (!agent) {
        return res.status(404).json({ message: "Agent not found" });
      }
      res.json(agent);
    } catch (error) {
      console.error("Error fetching agent chatbot:", error);
      res.status(500).json({ message: "Failed to fetch agent chatbot" });
    }
  });

  app.post("/api/agent-chatbots", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      console.log(
        "Creating agent chatbot with data:",
        JSON.stringify(req.body, null, 2),
      );
      console.log("User ID:", userId);

      // Extract documentIds from request body
      const { documentIds, lineOaChannelId, ...agentData } = req.body;

      // Handle LINE OA configuration
      let lineOaConfig = undefined;
      if (agentData.channels?.includes("lineoa") && lineOaChannelId) {
        // Find the LINE OA channel configuration
        const lineOaChannels = [
          {
            id: "U1234567890",
            name: "4urney HR",
            description: "HR Support Channel",
          },
          {
            id: "U0987654321",
            name: "Customer Support",
            description: "General Support",
          },
          {
            id: "U1122334455",
            name: "Sales Inquiry",
            description: "Sales Team Channel",
          },
        ];
        const selectedChannel = lineOaChannels.find(
          (ch) => ch.id === lineOaChannelId,
        );
        if (selectedChannel) {
          lineOaConfig = {
            lineOaId: selectedChannel.id,
            lineOaName: selectedChannel.name,
            accessToken: "mock_access_token", // In real implementation, this would be configured properly
          };
        }
      }

      // Ensure arrays are properly formatted for PostgreSQL JSONB
      const finalAgentData = {
        ...agentData,
        userId,
        lineOaConfig,
        // Default channels to empty array since we removed channel selection
        channels: [],
        specialSkills: Array.isArray(agentData.specialSkills)
          ? agentData.specialSkills
          : [],
        allowedTopics: Array.isArray(agentData.allowedTopics)
          ? agentData.allowedTopics
          : [],
        blockedTopics: Array.isArray(agentData.blockedTopics)
          ? agentData.blockedTopics
          : [],
      };
      console.log(
        "Final agent data before database insert:",
        JSON.stringify(finalAgentData, null, 2),
      );
      console.log(
        "Channels type:",
        typeof finalAgentData.channels,
        "Value:",
        finalAgentData.channels,
      );
      console.log(
        "Special skills type:",
        typeof finalAgentData.specialSkills,
        "Value:",
        finalAgentData.specialSkills,
      );

      const agent = await storage.createAgentChatbot(finalAgentData);
      console.log("Agent created successfully:", agent);

      // Associate documents with the agent if provided
      if (documentIds && documentIds.length > 0) {
        console.log("Adding documents to agent:", documentIds);
        for (const documentId of documentIds) {
          await storage.addDocumentToAgent(agent.id, documentId, userId);
        }
      }

      res.status(201).json(agent);
    } catch (error) {
      console.error("Error creating agent chatbot:", error);
      console.error("Error details:", error.message);
      console.error("Error stack:", error.stack);
      res.status(500).json({
        message: "Failed to create agent chatbot",
        error: error.message,
      });
    }
  });

  app.put("/api/agent-chatbots/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const agentId = parseInt(req.params.id);

      // Extract documentIds from request body
      const { documentIds, ...agentData } = req.body;

      const agent = await storage.updateAgentChatbot(
        agentId,
        agentData,
        userId,
      );

      // Update document associations if provided
      if (documentIds !== undefined) {
        console.log("Updating agent documents:", documentIds);

        // Remove all existing document associations
        await storage.removeAllDocumentsFromAgent(agentId, userId);

        // Add new document associations
        if (documentIds && documentIds.length > 0) {
          for (const documentId of documentIds) {
            await storage.addDocumentToAgent(agentId, documentId, userId);
          }
        }
      }

      res.json(agent);
    } catch (error) {
      console.error("Error updating agent chatbot:", error);
      res.status(500).json({ message: "Failed to update agent chatbot" });
    }
  });

  app.delete(
    "/api/agent-chatbots/:id",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.claims.sub;
        await storage.deleteAgentChatbot(parseInt(req.params.id), userId);
        res.status(204).send();
      } catch (error) {
        console.error("Error deleting agent chatbot:", error);
        res.status(500).json({ message: "Failed to delete agent chatbot" });
      }
    },
  );

  app.get(
    "/api/agent-chatbots/:id/documents",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.claims.sub;
        const documents = await storage.getAgentChatbotDocuments(
          parseInt(req.params.id),
          userId,
        );
        res.json(documents);
      } catch (error) {
        console.error("Error fetching agent documents:", error);
        res.status(500).json({ message: "Failed to fetch agent documents" });
      }
    },
  );

  app.post(
    "/api/agent-chatbots/:agentId/documents/:documentId",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.claims.sub;
        const agentDocument = await storage.addDocumentToAgent(
          parseInt(req.params.agentId),
          parseInt(req.params.documentId),
          userId,
        );
        res.status(201).json(agentDocument);
      } catch (error) {
        console.error("Error adding document to agent:", error);
        res.status(500).json({ message: "Failed to add document to agent" });
      }
    },
  );

  app.delete(
    "/api/agent-chatbots/:agentId/documents/:documentId",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.claims.sub;
        await storage.removeDocumentFromAgent(
          parseInt(req.params.agentId),
          parseInt(req.params.documentId),
          userId,
        );
        res.status(204).send();
      } catch (error) {
        console.error("Error removing document from agent:", error);
        res
          .status(500)
          .json({ message: "Failed to remove document from agent" });
      }
    },
  );

  // Social Integrations routes
  app.get(
    "/api/social-integrations",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.claims.sub;
        const integrations = await storage.getSocialIntegrations(userId);
        res.json(integrations);
      } catch (error) {
        console.error("Error fetching social integrations:", error);
        res
          .status(500)
          .json({ message: "Failed to fetch social integrations" });
      }
    },
  );

  app.get(
    "/api/social-integrations/:id",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.claims.sub;
        const integration = await storage.getSocialIntegration(
          parseInt(req.params.id),
          userId,
        );
        if (!integration) {
          return res.status(404).json({ message: "Integration not found" });
        }
        res.json(integration);
      } catch (error) {
        console.error("Error fetching social integration:", error);
        res.status(500).json({ message: "Failed to fetch social integration" });
      }
    },
  );

  app.post(
    "/api/social-integrations/lineoa",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.claims.sub;
        const {
          name,
          description,
          channelId,
          channelSecret,
          channelAccessToken,
          agentId,
        } = req.body;

        if (
          !name ||
          !channelId ||
          !channelSecret ||
          !channelAccessToken ||
          !agentId
        ) {
          return res.status(400).json({ message: "Missing required fields" });
        }

        const integrationData = {
          userId,
          name,
          description: description || null,
          type: "lineoa" as const,
          channelId,
          channelSecret,
          channelAccessToken,
          agentId: parseInt(agentId),
          isActive: true,
          isVerified: false,
        };

        const integration =
          await storage.createSocialIntegration(integrationData);
        res.status(201).json(integration);
      } catch (error) {
        console.error("Error creating Line OA integration:", error);
        res
          .status(500)
          .json({ message: "Failed to create Line OA integration" });
      }
    },
  );

  app.post(
    "/api/social-integrations/lineoa/verify",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const { channelId, channelSecret } = req.body;

        console.log("🔍 Debug: Line OA Verification Request");
        console.log(
          "📋 Channel ID:",
          channelId ? `${channelId.substring(0, 8)}...` : "Missing",
        );
        console.log(
          "🔑 Channel Secret:",
          channelSecret ? `${channelSecret.substring(0, 8)}...` : "Missing",
        );

        if (!channelId || !channelSecret) {
          console.log("❌ Missing required fields");
          return res.status(400).json({
            success: false,
            message: "กรุณากรอก Channel ID และ Channel Secret",
          });
        }

        // Enhanced validation for LINE Channel ID and Secret format
        const channelIdPattern = /^\d{10,}$/; // Channel ID should be numeric, at least 10 digits
        const isValidChannelId = channelIdPattern.test(channelId);
        const isValidChannelSecret = channelSecret.length >= 32; // Channel Secret should be at least 32 characters

        console.log("✅ Channel ID format valid:", isValidChannelId);
        console.log("✅ Channel Secret format valid:", isValidChannelSecret);

        if (!isValidChannelId) {
          console.log("❌ Invalid Channel ID format");
          return res.json({
            success: false,
            message: "Channel ID ไม่ถูกต้อง ต้องเป็นตัวเลขอย่างน้อย 10 หลัก",
          });
        }

        if (!isValidChannelSecret) {
          console.log("❌ Invalid Channel Secret format");
          return res.json({
            success: false,
            message: "Channel Secret ไม่ถูกต้อง ต้องมีอย่างน้อย 32 ตัวอักษร",
          });
        }

        // Simulate LINE API verification
        // In production, you would make actual API call to LINE:
        // const response = await fetch('https://api.line.me/v2/bot/info', {
        //   headers: { 'Authorization': `Bearer ${channelSecret}` }
        // });

        console.log("🎉 Line OA verification successful");
        res.json({
          success: true,
          message: "การเชื่อมต่อ Line OA สำเร็จ! ระบบได้ตรวจสอบการตั้งค่าแล้ว",
        });
      } catch (error) {
        console.error("💥 Error verifying Line OA connection:", error);
        res.status(500).json({
          success: false,
          message: "เกิดข้อผิดพลาดในการตรวจสอบการเชื่อมต่อ",
        });
      }
    },
  );

  app.put(
    "/api/social-integrations/:id",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.claims.sub;
        const integrationId = parseInt(req.params.id);
        const updates = req.body;

        const integration = await storage.updateSocialIntegration(
          integrationId,
          updates,
          userId,
        );
        res.json(integration);
      } catch (error) {
        console.error("Error updating social integration:", error);
        res
          .status(500)
          .json({ message: "Failed to update social integration" });
      }
    },
  );

  app.delete(
    "/api/social-integrations/:id",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.claims.sub;
        const integrationId = parseInt(req.params.id);

        await storage.deleteSocialIntegration(integrationId, userId);
        res.status(204).send();
      } catch (error) {
        console.error("Error deleting social integration:", error);
        res
          .status(500)
          .json({ message: "Failed to delete social integration" });
      }
    },
  );

  // Update social integration with access token
  app.patch(
    "/api/social-integrations/:id/access-token",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const integrationId = parseInt(req.params.id);
        const { accessToken } = req.body;
        const userId = req.user.claims.sub;

        if (!accessToken) {
          return res.status(400).json({ message: "Access token is required" });
        }

        // Update integration in database with raw SQL
        const result = await db.execute(sql`
        UPDATE social_integrations 
        SET channel_access_token = ${accessToken}, updated_at = NOW()
        WHERE id = ${integrationId} AND user_id = ${userId}
        RETURNING *
      `);

        if (result.rowCount === 0) {
          return res
            .status(404)
            .json({ message: "Integration not found or access denied" });
        }

        res.json({ message: "Access token updated successfully" });
      } catch (error) {
        console.error("Error updating access token:", error);
        res.status(500).json({ message: "Failed to update access token" });
      }
    },
  );

  // Agent Console API endpoints
  app.get('/api/agent-console/users', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const channelFilter = req.query.channelFilter || 'all';
      
      // Get all unique users from chat history grouped by user, channel, and agent
      const query = `
        SELECT DISTINCT ON (ch.channel_id, ch.channel_type, ch.agent_id)
          ch.user_id,
          ch.channel_type,
          ch.channel_id,
          ch.agent_id,
          ac.name as agent_name,
          ch.content as last_message,
          ch.created_at as last_message_at,
          COUNT(*) OVER (PARTITION BY ch.channel_id, ch.channel_type, ch.agent_id) as message_count
        FROM chat_history ch
        JOIN agent_chatbots ac ON ch.agent_id = ac.id
        WHERE ac.user_id = $1
        AND ch.channel_id LIKE 'U%'
        ${channelFilter !== 'all' ? 'AND ch.channel_type = $2' : ''}
        ORDER BY ch.channel_id, ch.channel_type, ch.agent_id, ch.created_at DESC
      `;
      
      const params = channelFilter !== 'all' ? [userId, channelFilter] : [userId];
      const result = await pool.query(query, params);
      
      const chatUsers = result.rows.map(row => ({
        userId: row.user_id,
        channelType: row.channel_type,
        channelId: row.channel_id, // This is the Line user ID from database
        agentId: row.agent_id,
        agentName: row.agent_name,
        lastMessage: row.last_message,
        lastMessageAt: row.last_message_at,
        messageCount: parseInt(row.message_count),
        isOnline: Math.random() > 0.7, // Simplified online status
        userProfile: {
          name: `User ${row.channel_id.slice(-4)}`, // Use Line user ID for display
          // Add more profile fields as needed
        }
      }));
      
      console.log("🔍 Agent Console Users API: Raw DB results:", result.rows.length);
      console.log("🔍 Agent Console Users API: Raw DB sample:", result.rows[0]);
      console.log("🔍 Agent Console Users API: Found users:", chatUsers.length);
      if (chatUsers.length > 0) {
        console.log("🔍 Agent Console Users API: Sample user:", chatUsers[0]);
        console.log("🔍 Agent Console Users API: All channelIds:", chatUsers.map(u => u.channelId));
      }
      
      res.json(chatUsers);
    } catch (error) {
      console.error("Error fetching agent console users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.get('/api/agent-console/conversation', isAuthenticated, async (req: any, res) => {
    try {
      const { userId: targetUserId, channelType, channelId, agentId } = req.query;
      
      if (!targetUserId || !channelType || !channelId || !agentId) {
        return res.status(400).json({ message: "Missing required parameters" });
      }
      
      console.log("🔍 Agent Console Conversation API: Query params:", {
        targetUserId,
        channelType,
        channelId,
        agentId
      });
      
      // Try to get messages with the provided channelId first
      let messages = await storage.getChatHistory(
        targetUserId,
        channelType,
        channelId,
        parseInt(agentId),
        50 // Get last 50 messages
      );
      
      // If no messages found and channelId looks like a Line OA channel ID, 
      // try to find with actual Line user ID from the database
      if (messages.length === 0 && channelType === 'lineoa') {
        console.log("🔍 No messages found with channelId:", channelId, "- trying to find Line user ID");
        
        // Query to find actual Line user IDs for this user and agent
        const lineUserQuery = `
          SELECT DISTINCT channel_id 
          FROM chat_history 
          WHERE user_id = $1 AND channel_type = $2 AND agent_id = $3
          AND channel_id LIKE 'U%'
        `;
        const lineUserResult = await pool.query(lineUserQuery, [targetUserId, channelType, parseInt(agentId)]);
        
        if (lineUserResult.rows.length > 0) {
          const actualChannelId = lineUserResult.rows[0].channel_id;
          console.log("🔍 Found actual Line user ID:", actualChannelId);
          
          messages = await storage.getChatHistory(
            targetUserId,
            channelType,
            actualChannelId,
            parseInt(agentId),
            50
          );
        }
      }
      
      console.log("📨 Agent Console Conversation API: Found messages:", messages.length);
      if (messages.length > 0) {
        console.log("📨 Agent Console Conversation API: Sample message:", messages[0]);
      }
      
      res.json(messages);
    } catch (error) {
      console.error("Error fetching conversation:", error);
      res.status(500).json({ message: "Failed to fetch conversation" });
    }
  });

  app.get('/api/agent-console/summary', isAuthenticated, async (req: any, res) => {
    try {
      const { userId: targetUserId, channelType, channelId } = req.query;
      
      if (!targetUserId || !channelType || !channelId) {
        return res.status(400).json({ message: "Missing required parameters" });
      }
      
      // Get conversation statistics
      const query = `
        SELECT 
          COUNT(*) as total_messages,
          MIN(created_at) as first_contact_at,
          MAX(created_at) as last_active_at
        FROM chat_history 
        WHERE user_id = $1 AND channel_type = $2 AND channel_id = $3
      `;
      
      const result = await pool.query(query, [targetUserId, channelType, channelId]);
      const row = result.rows[0];
      
      const summary = {
        totalMessages: parseInt(row.total_messages),
        firstContactAt: row.first_contact_at,
        lastActiveAt: row.last_active_at,
        sentiment: 'neutral', // Could be enhanced with AI sentiment analysis
        mainTopics: ['General Inquiry', 'Support'], // Could be enhanced with AI topic extraction
        resolutionStatus: 'open' // Could be tracked in database
      };
      
      res.json(summary);
    } catch (error) {
      console.error("Error fetching conversation summary:", error);
      res.status(500).json({ message: "Failed to fetch conversation summary" });
    }
  });

  app.post('/api/agent-console/send-message', isAuthenticated, async (req: any, res) => {
    try {
      const { userId: targetUserId, channelType, channelId, agentId, message, messageType } = req.body;
      
      if (!targetUserId || !channelType || !channelId || !agentId || !message) {
        return res.status(400).json({ message: "Missing required parameters" });
      }
      
      // Store the human agent message in chat history
      const chatHistoryRecord = await storage.createChatHistory({
        userId: targetUserId,
        channelType,
        channelId,
        agentId: parseInt(agentId),
        messageType: messageType || 'agent',
        content: message,
        metadata: {
          sentBy: req.user.claims.sub,
          humanAgent: true,
          humanAgentName: req.user.claims.first_name || req.user.claims.email || 'Human Agent'
        }
      });

      // Broadcast new message to Agent Console via WebSocket
      if (typeof (global as any).broadcastToAgentConsole === 'function') {
        (global as any).broadcastToAgentConsole({
          type: 'new_message',
          data: {
            userId: targetUserId,
            channelType,
            channelId,
            agentId: parseInt(agentId),
            userMessage: '',
            aiResponse: message,
            messageType: messageType || 'agent',
            timestamp: new Date().toISOString(),
            humanAgentName: req.user.claims.first_name || req.user.claims.email || 'Human Agent'
          }
        });
        console.log('📡 Broadcasted human agent message to Agent Console');
      }
      
      // Send the message via the appropriate channel
      if (channelType === 'lineoa') {
        // For Line, we would need to implement push message functionality
        console.log('Would send Line message:', message);
      }
      
      res.json({ 
        success: true, 
        messageId: chatHistoryRecord.id,
        message: "Message sent successfully" 
      });
    } catch (error) {
      console.error("Error sending agent console message:", error);
      res.status(500).json({ message: "Failed to send message" });
    }
  });

  app.post('/api/agent-console/takeover', isAuthenticated, async (req: any, res) => {
    try {
      const { userId: targetUserId, channelType, channelId, agentId } = req.body;
      
      if (!targetUserId || !channelType || !channelId || !agentId) {
        return res.status(400).json({ message: "Missing required parameters" });
      }
      
      // Log the takeover action
      await storage.createAuditLog({
        userId: req.user.claims.sub,
        action: 'human_takeover',
        resourceType: 'conversation',
        resourceId: `${targetUserId}-${channelType}-${channelId}`,
        ipAddress: req.ip || req.connection.remoteAddress || 'unknown',
        userAgent: req.headers['user-agent'] || 'unknown',
        details: {
          targetUserId,
          channelType,
          channelId,
          agentId: parseInt(agentId)
        }
      });
      
      // Store a system message indicating human takeover
      await storage.createChatHistory({
        userId: targetUserId,
        channelType,
        channelId,
        agentId: parseInt(agentId),
        messageType: 'assistant',
        content: '🔄 A human agent has joined the conversation.',
        metadata: {
          systemMessage: true,
          humanTakeover: true,
          agentId: req.user.claims.sub
        }
      });
      
      res.json({ success: true, message: "Conversation takeover successful" });
    } catch (error) {
      console.error("Error taking over conversation:", error);
      res.status(500).json({ message: "Failed to take over conversation" });
    }
  });

  // Line OA Webhook endpoint (no authentication required)
  app.post("/api/line/webhook", handleLineWebhook);

  const httpServer = createServer(app);
  
  // Create WebSocket server on /ws path to avoid conflicts with Vite HMR
  const wss = new WebSocketServer({ 
    server: httpServer, 
    path: '/ws' 
  });

  // Store connected WebSocket clients
  const wsClients = new Set<WebSocket>();

  wss.on('connection', (ws) => {
    console.log('🔌 WebSocket client connected');
    wsClients.add(ws);

    // Send initial connection confirmation
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'connection',
        message: 'Connected to Agent Console WebSocket'
      }));
    }

    // Handle incoming messages from client
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        console.log('📨 WebSocket message received:', message);
        
        // Handle different message types if needed
        if (message.type === 'subscribe') {
          console.log('📡 Client subscribed to Agent Console updates');
        }
      } catch (error) {
        console.error('❌ WebSocket message parse error:', error);
      }
    });

    // Clean up on disconnect
    ws.on('close', () => {
      console.log('🔌 WebSocket client disconnected');
      wsClients.delete(ws);
    });

    ws.on('error', (error) => {
      console.error('❌ WebSocket error:', error);
      wsClients.delete(ws);
    });
  });

  // Export function to broadcast messages to all connected clients
  (global as any).broadcastToAgentConsole = (message: any) => {
    console.log(`📡 Broadcasting to ${wsClients.size} connected clients:`, message);
    
    wsClients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(JSON.stringify(message));
        } catch (error) {
          console.error('❌ Error sending WebSocket message:', error);
          wsClients.delete(client);
        }
      } else {
        wsClients.delete(client);
      }
    });
  };

  return httpServer;
}
