import {
  pgTable,
  text,
  varchar,
  timestamp,
  jsonb,
  index,
  serial,
  integer,
  boolean,
  real,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Session storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const users = pgTable("users", {
  id: varchar("id").primaryKey().notNull(),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  role: varchar("role").default("user").notNull(), // admin, user, viewer
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Document categories
export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: varchar("name").notNull(),
  description: text("description"),
  color: varchar("color").notNull().default("#3B82F6"),
  userId: varchar("user_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Documents
export const documents = pgTable("documents", {
  id: serial("id").primaryKey(),
  name: varchar("name").notNull(),
  description: text("description"),
  fileName: varchar("file_name").notNull(),
  filePath: varchar("file_path").notNull(),
  fileSize: integer("file_size").notNull(),
  mimeType: varchar("mime_type").notNull(),
  content: text("content"), // Extracted text content
  summary: text("summary"), // AI-generated summary
  tags: text("tags").array(), // AI-generated tags
  aiCategory: varchar("ai_category", { length: 50 }), // AI-classified category
  aiCategoryColor: varchar("ai_category_color", { length: 10 }), // Category color
  categoryId: integer("category_id").references(() => categories.id),
  userId: varchar("user_id").references(() => users.id).notNull(),
  isPublic: boolean("is_public").default(false),
  isFavorite: boolean("is_favorite").default(false),
  processedAt: timestamp("processed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Chat conversations
export const chatConversations = pgTable("chat_conversations", {
  id: serial("id").primaryKey(),
  title: varchar("title").notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Chat messages
export const chatMessages = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").references(() => chatConversations.id).notNull(),
  role: varchar("role").notNull(), // user, assistant
  content: text("content").notNull(),
  documentIds: integer("document_ids").array(), // Referenced documents
  createdAt: timestamp("created_at").defaultNow(),
});

// Document access logs
export const documentAccess = pgTable("document_access", {
  id: serial("id").primaryKey(),
  documentId: integer("document_id").references(() => documents.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  accessType: varchar("access_type").notNull(), // view, download, edit
  createdAt: timestamp("created_at").defaultNow(),
});

// Data connections table for database and API connections
export const dataConnections = pgTable("data_connections", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name").notNull(),
  description: text("description"),
  type: varchar("type").notNull(), // 'database', 'api', or 'enterprise'
  
  // Database connection fields
  dbType: varchar("db_type"), // 'postgresql', 'mysql', 'sqlserver', 'oracle', 'redshift', 'snowflake', 'tidb'
  host: varchar("host"),
  port: integer("port"),
  database: varchar("database"),
  username: varchar("username"),
  password: varchar("password"), // encrypted
  connectionString: text("connection_string"), // encrypted
  
  // API connection fields
  apiUrl: text("api_url"),
  method: varchar("method"), // 'GET', 'POST', 'PUT', 'DELETE'
  headers: jsonb("headers"),
  body: text("body"),
  authType: varchar("auth_type"), // 'none', 'basic', 'bearer', 'api_key'
  authConfig: jsonb("auth_config"), // stores auth credentials
  
  // Enterprise system fields
  enterpriseType: varchar("enterprise_type"), // 'salesforce', 'sap', 'oracle_erp', 'microsoft_dynamics'
  instanceUrl: varchar("instance_url"), // For Salesforce, SAP, etc.
  clientId: varchar("client_id"),
  clientSecret: varchar("client_secret"),
  
  isActive: boolean("is_active").default(true),
  lastTested: timestamp("last_tested"),
  testStatus: varchar("test_status"), // 'success', 'failed', 'pending'
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  documents: many(documents),
  categories: many(categories),
  chatConversations: many(chatConversations),
  documentAccess: many(documentAccess),
  dataConnections: many(dataConnections),
}));

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  user: one(users, {
    fields: [categories.userId],
    references: [users.id],
  }),
  documents: many(documents),
}));

export const documentsRelations = relations(documents, ({ one, many }) => ({
  user: one(users, {
    fields: [documents.userId],
    references: [users.id],
  }),
  category: one(categories, {
    fields: [documents.categoryId],
    references: [categories.id],
  }),
  accessLogs: many(documentAccess),
}));

export const chatConversationsRelations = relations(chatConversations, ({ one, many }) => ({
  user: one(users, {
    fields: [chatConversations.userId],
    references: [users.id],
  }),
  messages: many(chatMessages),
}));

export const chatMessagesRelations = relations(chatMessages, ({ one }) => ({
  conversation: one(chatConversations, {
    fields: [chatMessages.conversationId],
    references: [chatConversations.id],
  }),
}));

export const documentAccessRelations = relations(documentAccess, ({ one }) => ({
  document: one(documents, {
    fields: [documentAccess.documentId],
    references: [documents.id],
  }),
  user: one(users, {
    fields: [documentAccess.userId],
    references: [users.id],
  }),
}));

export const dataConnectionsRelations = relations(dataConnections, ({ one }) => ({
  user: one(users, {
    fields: [dataConnections.userId],
    references: [users.id],
  }),
}));

// Insert schemas
export const insertCategorySchema = createInsertSchema(categories).omit({
  id: true,
  createdAt: true,
});

export const insertDocumentSchema = createInsertSchema(documents).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateDocumentSchema = createInsertSchema(documents).omit({
  id: true,
  createdAt: true,
}).partial();

export const insertChatConversationSchema = createInsertSchema(chatConversations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({
  id: true,
  createdAt: true,
});

export const insertDataConnectionSchema = createInsertSchema(dataConnections).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateDataConnectionSchema = createInsertSchema(dataConnections).omit({
  id: true,
  userId: true,
  createdAt: true,
});

// Types
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type Document = typeof documents.$inferSelect;
export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type UpdateDocument = z.infer<typeof updateDocumentSchema>;
export type ChatConversation = typeof chatConversations.$inferSelect;
export type InsertChatConversation = z.infer<typeof insertChatConversationSchema>;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type DocumentAccess = typeof documentAccess.$inferSelect;
export type DataConnection = typeof dataConnections.$inferSelect;
export type InsertDataConnection = z.infer<typeof insertDataConnectionSchema>;
export type UpdateDataConnection = z.infer<typeof updateDataConnectionSchema>;
