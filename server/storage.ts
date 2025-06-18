import {
  users,
  documents,
  categories,
  conversations,
  messages,
  documentAccess,
  searchQueries,
  type User,
  type UpsertUser,
  type Document,
  type InsertDocument,
  type Category,
  type InsertCategory,
  type Conversation,
  type InsertConversation,
  type Message,
  type InsertMessage,
  type DocumentAccess,
  type SearchQuery,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, or, desc, asc, ilike, sql, inArray } from "drizzle-orm";

// Interface for storage operations
export interface IStorage {
  // User operations
  // (IMPORTANT) these user operations are mandatory for Replit Auth.
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Document operations
  createDocument(document: InsertDocument): Promise<Document>;
  getDocument(id: number): Promise<Document | undefined>;
  getDocuments(userId: string, limit?: number, offset?: number): Promise<Document[]>;
  updateDocument(id: number, updates: Partial<Document>): Promise<Document>;
  deleteDocument(id: number): Promise<void>;
  getDocumentsByCategory(categoryId: number): Promise<Document[]>;
  searchDocuments(query: string, userId: string): Promise<Document[]>;
  getDocumentStats(userId: string): Promise<{
    totalDocuments: number;
    processingQueue: number;
    categoryCounts: Array<{ categoryId: number; count: number; categoryName: string }>;
  }>;
  
  // Category operations
  createCategory(category: InsertCategory): Promise<Category>;
  getCategories(): Promise<Category[]>;
  getCategory(id: number): Promise<Category | undefined>;
  updateCategory(id: number, updates: Partial<Category>): Promise<Category>;
  deleteCategory(id: number): Promise<void>;
  
  // Conversation operations
  createConversation(conversation: InsertConversation): Promise<Conversation>;
  getConversations(userId: string): Promise<Conversation[]>;
  getConversation(id: number): Promise<Conversation | undefined>;
  deleteConversation(id: number): Promise<void>;
  
  // Message operations
  createMessage(message: InsertMessage): Promise<Message>;
  getMessages(conversationId: number): Promise<Message[]>;
  
  // Access control
  grantDocumentAccess(documentId: number, userId: string, accessLevel: string, grantedBy: string): Promise<void>;
  checkDocumentAccess(documentId: number, userId: string): Promise<DocumentAccess | undefined>;
  getUserDocuments(userId: string): Promise<Document[]>;
  
  // Search analytics
  logSearchQuery(userId: string, query: string, queryType: string, resultsCount: number): Promise<void>;
  getSearchStats(userId: string): Promise<{ totalQueries: number; recentQueries: SearchQuery[] }>;
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

  // Document operations
  async createDocument(document: InsertDocument): Promise<Document> {
    const [newDocument] = await db.insert(documents).values(document).returning();
    return newDocument;
  }

  async getDocument(id: number): Promise<Document | undefined> {
    const [document] = await db.select().from(documents).where(eq(documents.id, id));
    return document;
  }

  async getDocuments(userId: string, limit = 50, offset = 0): Promise<Document[]> {
    return await db
      .select()
      .from(documents)
      .where(eq(documents.uploadedBy, userId))
      .orderBy(desc(documents.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async updateDocument(id: number, updates: Partial<Document>): Promise<Document> {
    const [updatedDocument] = await db
      .update(documents)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(documents.id, id))
      .returning();
    return updatedDocument;
  }

  async deleteDocument(id: number): Promise<void> {
    await db.delete(documents).where(eq(documents.id, id));
  }

  async getDocumentsByCategory(categoryId: number): Promise<Document[]> {
    return await db
      .select()
      .from(documents)
      .where(eq(documents.categoryId, categoryId))
      .orderBy(desc(documents.createdAt));
  }

  async searchDocuments(query: string, userId: string): Promise<Document[]> {
    return await db
      .select()
      .from(documents)
      .where(
        and(
          eq(documents.uploadedBy, userId),
          or(
            ilike(documents.originalName, `%${query}%`),
            ilike(documents.content, `%${query}%`),
            ilike(documents.summary, `%${query}%`)
          )
        )
      )
      .orderBy(desc(documents.createdAt));
  }

  async getDocumentStats(userId: string): Promise<{
    totalDocuments: number;
    processingQueue: number;
    categoryCounts: Array<{ categoryId: number; count: number; categoryName: string }>;
  }> {
    const [totalResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(documents)
      .where(eq(documents.uploadedBy, userId));

    const [processingResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(documents)
      .where(
        and(
          eq(documents.uploadedBy, userId),
          inArray(documents.status, ['pending', 'processing'])
        )
      );

    const categoryCounts = await db
      .select({
        categoryId: documents.categoryId,
        count: sql<number>`count(*)`,
        categoryName: categories.name,
      })
      .from(documents)
      .leftJoin(categories, eq(documents.categoryId, categories.id))
      .where(eq(documents.uploadedBy, userId))
      .groupBy(documents.categoryId, categories.name);

    return {
      totalDocuments: totalResult.count,
      processingQueue: processingResult.count,
      categoryCounts: categoryCounts.filter(c => c.categoryId !== null) as Array<{
        categoryId: number;
        count: number;
        categoryName: string;
      }>,
    };
  }

  // Category operations
  async createCategory(category: InsertCategory): Promise<Category> {
    const [newCategory] = await db.insert(categories).values(category).returning();
    return newCategory;
  }

  async getCategories(): Promise<Category[]> {
    return await db.select().from(categories).orderBy(asc(categories.name));
  }

  async getCategory(id: number): Promise<Category | undefined> {
    const [category] = await db.select().from(categories).where(eq(categories.id, id));
    return category;
  }

  async updateCategory(id: number, updates: Partial<Category>): Promise<Category> {
    const [updatedCategory] = await db
      .update(categories)
      .set(updates)
      .where(eq(categories.id, id))
      .returning();
    return updatedCategory;
  }

  async deleteCategory(id: number): Promise<void> {
    await db.delete(categories).where(eq(categories.id, id));
  }

  // Conversation operations
  async createConversation(conversation: InsertConversation): Promise<Conversation> {
    const [newConversation] = await db.insert(conversations).values(conversation).returning();
    return newConversation;
  }

  async getConversations(userId: string): Promise<Conversation[]> {
    return await db
      .select()
      .from(conversations)
      .where(eq(conversations.userId, userId))
      .orderBy(desc(conversations.updatedAt));
  }

  async getConversation(id: number): Promise<Conversation | undefined> {
    const [conversation] = await db.select().from(conversations).where(eq(conversations.id, id));
    return conversation;
  }

  async deleteConversation(id: number): Promise<void> {
    await db.delete(conversations).where(eq(conversations.id, id));
  }

  // Message operations
  async createMessage(message: InsertMessage): Promise<Message> {
    const [newMessage] = await db.insert(messages).values(message).returning();
    return newMessage;
  }

  async getMessages(conversationId: number): Promise<Message[]> {
    return await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(asc(messages.createdAt));
  }

  // Access control
  async grantDocumentAccess(documentId: number, userId: string, accessLevel: string, grantedBy: string): Promise<void> {
    await db.insert(documentAccess).values({
      documentId,
      userId,
      accessLevel,
      grantedBy,
    });
  }

  async checkDocumentAccess(documentId: number, userId: string): Promise<DocumentAccess | undefined> {
    const [access] = await db
      .select()
      .from(documentAccess)
      .where(
        and(
          eq(documentAccess.documentId, documentId),
          eq(documentAccess.userId, userId)
        )
      );
    return access;
  }

  async getUserDocuments(userId: string): Promise<Document[]> {
    // Get documents user has access to (either uploaded by them or granted access)
    const accessibleDocs = await db
      .select()
      .from(documents)
      .leftJoin(documentAccess, eq(documents.id, documentAccess.documentId))
      .where(
        or(
          eq(documents.uploadedBy, userId),
          eq(documentAccess.userId, userId)
        )
      )
      .orderBy(desc(documents.createdAt));

    return accessibleDocs.map(row => row.documents);
  }

  // Search analytics
  async logSearchQuery(userId: string, query: string, queryType: string, resultsCount: number): Promise<void> {
    await db.insert(searchQueries).values({
      userId,
      query,
      queryType,
      resultsCount,
    });
  }

  async getSearchStats(userId: string): Promise<{ totalQueries: number; recentQueries: SearchQuery[] }> {
    const [totalResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(searchQueries)
      .where(eq(searchQueries.userId, userId));

    const recentQueries = await db
      .select()
      .from(searchQueries)
      .where(eq(searchQueries.userId, userId))
      .orderBy(desc(searchQueries.createdAt))
      .limit(10);

    return {
      totalQueries: totalResult.count,
      recentQueries,
    };
  }
}

export const storage = new DatabaseStorage();
