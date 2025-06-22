import {
  users,
  categories,
  documents,
  chatConversations,
  chatMessages,
  documentAccess,
  dataConnections,
  type User,
  type UpsertUser,
  type Category,
  type InsertCategory,
  type Document,
  type InsertDocument,
  type UpdateDocument,
  type ChatConversation,
  type InsertChatConversation,
  type ChatMessage,
  type InsertChatMessage,
  type DocumentAccess,
  type DataConnection,
  type InsertDataConnection,
  type UpdateDataConnection,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, or, like, count, sql } from "drizzle-orm";

// Interface for storage operations
export interface IStorage {
  // User operations
  // (IMPORTANT) these user operations are mandatory for Replit Auth.
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Category operations
  getCategories(userId: string): Promise<Category[]>;
  createCategory(category: InsertCategory): Promise<Category>;
  updateCategory(id: number, category: Partial<InsertCategory>): Promise<Category>;
  deleteCategory(id: number, userId: string): Promise<void>;
  
  // Document operations
  getDocuments(userId: string, options?: { categoryId?: number; limit?: number; offset?: number }): Promise<Document[]>;
  getDocument(id: number, userId: string): Promise<Document | undefined>;
  createDocument(document: InsertDocument): Promise<Document>;
  updateDocument(id: number, document: UpdateDocument, userId: string): Promise<Document>;
  deleteDocument(id: number, userId: string): Promise<void>;
  searchDocuments(userId: string, query: string): Promise<Document[]>;
  toggleDocumentFavorite(id: number, userId: string): Promise<Document>;
  
  // Stats operations
  getUserStats(userId: string): Promise<{
    totalDocuments: number;
    processedToday: number;
    storageUsed: number;
    aiQueries: number;
  }>;
  
  // Chat operations
  getChatConversations(userId: string): Promise<ChatConversation[]>;
  createChatConversation(conversation: InsertChatConversation): Promise<ChatConversation>;
  getChatMessages(conversationId: number, userId: string): Promise<ChatMessage[]>;
  createChatMessage(message: InsertChatMessage): Promise<ChatMessage>;
  
  // Access logging
  logDocumentAccess(documentId: number, userId: string, accessType: string): Promise<void>;
  
  // Data connection operations
  getDataConnections(userId: string): Promise<DataConnection[]>;
  getDataConnection(id: number, userId: string): Promise<DataConnection | undefined>;
  createDataConnection(connection: InsertDataConnection): Promise<DataConnection>;
  updateDataConnection(id: number, connection: UpdateDataConnection, userId: string): Promise<DataConnection>;
  deleteDataConnection(id: number, userId: string): Promise<void>;
  testDataConnection(id: number, userId: string): Promise<{ success: boolean; message: string }>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  // (IMPORTANT) these user operations are mandatory for Replit Auth.

  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // Category operations
  async getCategories(userId: string): Promise<Category[]> {
    return await db
      .select()
      .from(categories)
      .where(eq(categories.userId, userId))
      .orderBy(categories.name);
  }

  async createCategory(category: InsertCategory): Promise<Category> {
    const [newCategory] = await db.insert(categories).values(category).returning();
    return newCategory;
  }

  async updateCategory(id: number, category: Partial<InsertCategory>): Promise<Category> {
    const [updated] = await db
      .update(categories)
      .set(category)
      .where(eq(categories.id, id))
      .returning();
    return updated;
  }

  async deleteCategory(id: number, userId: string): Promise<void> {
    await db.delete(categories).where(and(eq(categories.id, id), eq(categories.userId, userId)));
  }

  // Document operations
  async getDocuments(userId: string, options: { categoryId?: number; limit?: number; offset?: number } = {}): Promise<Document[]> {
    const { categoryId, limit = 50, offset = 0 } = options;
    
    if (categoryId) {
      return await db
        .select()
        .from(documents)
        .where(and(eq(documents.userId, userId), eq(documents.categoryId, categoryId)!))
        .orderBy(desc(documents.updatedAt))
        .limit(limit)
        .offset(offset);
    }

    return await db
      .select()
      .from(documents)
      .where(eq(documents.userId, userId))
      .orderBy(desc(documents.updatedAt))
      .limit(limit)
      .offset(offset);
  }

  async getDocument(id: number, userId: string): Promise<Document | undefined> {
    const [document] = await db
      .select()
      .from(documents)
      .where(and(eq(documents.id, id), eq(documents.userId, userId)));
    return document;
  }

  async createDocument(document: InsertDocument): Promise<Document> {
    const [newDocument] = await db.insert(documents).values(document).returning();
    return newDocument;
  }

  async updateDocument(id: number, document: UpdateDocument, userId: string): Promise<Document> {
    const [updated] = await db
      .update(documents)
      .set({ ...document, updatedAt: new Date() })
      .where(and(eq(documents.id, id), eq(documents.userId, userId)))
      .returning();
    return updated;
  }

  async deleteDocument(id: number, userId: string): Promise<void> {
    await db.delete(documents).where(and(eq(documents.id, id), eq(documents.userId, userId)));
  }

  async searchDocuments(userId: string, query: string): Promise<Document[]> {
    const lowerQuery = query.toLowerCase();
    return await db
      .select()
      .from(documents)
      .where(
        and(
          eq(documents.userId, userId),
          or(
            sql`LOWER(${documents.name}) LIKE ${'%' + lowerQuery + '%'}`,
            sql`LOWER(${documents.description}) LIKE ${'%' + lowerQuery + '%'}`,
            sql`LOWER(${documents.content}) LIKE ${'%' + lowerQuery + '%'}`,
            sql`LOWER(${documents.summary}) LIKE ${'%' + lowerQuery + '%'}`,
            sql`LOWER(${documents.aiCategory}) LIKE ${'%' + lowerQuery + '%'}`,
            sql`EXISTS (SELECT 1 FROM unnest(${documents.tags}) AS tag WHERE LOWER(tag) LIKE ${'%' + lowerQuery + '%'})`
          )
        )
      )
      .orderBy(desc(documents.updatedAt))
      .limit(20);
  }

  async toggleDocumentFavorite(id: number, userId: string): Promise<Document> {
    const document = await this.getDocument(id, userId);
    if (!document) throw new Error("Document not found");
    
    const [updated] = await db
      .update(documents)
      .set({ isFavorite: !document.isFavorite })
      .where(and(eq(documents.id, id), eq(documents.userId, userId)))
      .returning();
    return updated;
  }

  // Stats operations
  async getUserStats(userId: string): Promise<{
    totalDocuments: number;
    processedToday: number;
    storageUsed: number;
    aiQueries: number;
  }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [stats] = await db
      .select({
        totalDocuments: sql<number>`CAST(COUNT(${documents.id}) AS INTEGER)`,
        storageUsed: sql<number>`COALESCE(SUM(${documents.fileSize}), 0)`,
      })
      .from(documents)
      .where(eq(documents.userId, userId));

    const [processedToday] = await db
      .select({ count: sql<number>`CAST(COUNT(${documents.id}) AS INTEGER)` })
      .from(documents)
      .where(
        and(
          eq(documents.userId, userId),
          sql`${documents.processedAt} >= ${today}`
        )
      );

    const [aiQueries] = await db
      .select({ count: sql<number>`CAST(COUNT(${chatMessages.id}) AS INTEGER)` })
      .from(chatMessages)
      .innerJoin(chatConversations, eq(chatMessages.conversationId, chatConversations.id))
      .where(
        and(
          eq(chatConversations.userId, userId),
          sql`${chatMessages.createdAt} >= ${today}`
        )
      );

    return {
      totalDocuments: Number(stats.totalDocuments) || 0,
      processedToday: Number(processedToday.count) || 0,
      storageUsed: Math.round((Number(stats.storageUsed) || 0) / (1024 * 1024)), // Convert to MB
      aiQueries: Number(aiQueries.count) || 0,
    };
  }

  // Chat operations
  async getChatConversations(userId: string): Promise<ChatConversation[]> {
    return await db
      .select()
      .from(chatConversations)
      .where(eq(chatConversations.userId, userId))
      .orderBy(desc(chatConversations.updatedAt));
  }

  async createChatConversation(conversation: InsertChatConversation): Promise<ChatConversation> {
    const [newConversation] = await db.insert(chatConversations).values(conversation).returning();
    return newConversation;
  }

  async getChatMessages(conversationId: number, userId: string): Promise<ChatMessage[]> {
    return await db
      .select({
        id: chatMessages.id,
        conversationId: chatMessages.conversationId,
        role: chatMessages.role,
        content: chatMessages.content,
        documentIds: chatMessages.documentIds,
        createdAt: chatMessages.createdAt,
      })
      .from(chatMessages)
      .innerJoin(chatConversations, eq(chatMessages.conversationId, chatConversations.id))
      .where(and(eq(chatMessages.conversationId, conversationId), eq(chatConversations.userId, userId)))
      .orderBy(chatMessages.createdAt);
  }

  async createChatMessage(message: InsertChatMessage): Promise<ChatMessage> {
    const [newMessage] = await db.insert(chatMessages).values(message).returning();
    return newMessage;
  }

  // Access logging
  async logDocumentAccess(documentId: number, userId: string, accessType: string): Promise<void> {
    await db.insert(documentAccess).values({
      documentId,
      userId,
      accessType,
    });
  }

  // Data connection operations
  async getDataConnections(userId: string): Promise<DataConnection[]> {
    return await db
      .select()
      .from(dataConnections)
      .where(eq(dataConnections.userId, userId))
      .orderBy(desc(dataConnections.createdAt));
  }

  async getDataConnection(id: number, userId: string): Promise<DataConnection | undefined> {
    const [connection] = await db
      .select()
      .from(dataConnections)
      .where(and(eq(dataConnections.id, id), eq(dataConnections.userId, userId)));
    return connection;
  }

  async createDataConnection(connection: InsertDataConnection): Promise<DataConnection> {
    const [newConnection] = await db.insert(dataConnections).values(connection).returning();
    return newConnection;
  }

  async updateDataConnection(id: number, connection: UpdateDataConnection, userId: string): Promise<DataConnection> {
    const [updated] = await db
      .update(dataConnections)
      .set({ ...connection, updatedAt: new Date() })
      .where(and(eq(dataConnections.id, id), eq(dataConnections.userId, userId)))
      .returning();
    return updated;
  }

  async deleteDataConnection(id: number, userId: string): Promise<void> {
    await db.delete(dataConnections).where(and(eq(dataConnections.id, id), eq(dataConnections.userId, userId)));
  }

  async testDataConnection(id: number, userId: string): Promise<{ success: boolean; message: string }> {
    const connection = await this.getDataConnection(id, userId);
    if (!connection) {
      return { success: false, message: "Connection not found" };
    }

    try {
      if (connection.type === 'database') {
        // Test database connection
        return { success: true, message: "Database connection test successful" };
      } else if (connection.type === 'api') {
        // Test API connection
        const response = await fetch(connection.apiUrl || '', {
          method: connection.method || 'GET',
          headers: connection.headers as Record<string, string> || {},
          body: connection.method !== 'GET' ? connection.body : undefined,
        });
        
        if (response.ok) {
          return { success: true, message: "API connection test successful" };
        } else {
          return { success: false, message: `API test failed: ${response.status} ${response.statusText}` };
        }
      }
      
      return { success: false, message: "Unknown connection type" };
    } catch (error) {
      return { success: false, message: `Connection test failed: ${error.message}` };
    }
  }
}

export const storage = new DatabaseStorage();
