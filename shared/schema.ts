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
  role: varchar("role").notNull().default("user"), // user, admin
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Document categories
export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: varchar("name").notNull().unique(),
  description: text("description"),
  color: varchar("color").notNull().default("#3b82f6"),
  icon: varchar("icon").notNull().default("file"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Document table
export const documents = pgTable("documents", {
  id: serial("id").primaryKey(),
  filename: varchar("filename").notNull(),
  originalName: varchar("original_name").notNull(),
  fileType: varchar("file_type").notNull(),
  fileSize: integer("file_size").notNull(),
  filePath: varchar("file_path").notNull(),
  content: text("content"),
  summary: text("summary"),
  categoryId: integer("category_id").references(() => categories.id),
  tags: text("tags").array(),
  metadata: jsonb("metadata"),
  status: varchar("status").notNull().default("pending"), // pending, processing, processed, failed
  processedAt: timestamp("processed_at"),
  uploadedBy: varchar("uploaded_by").notNull().references(() => users.id),
  isInVectorDb: boolean("is_in_vector_db").notNull().default(false),
  vectorId: varchar("vector_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Document access control
export const documentAccess = pgTable("document_access", {
  id: serial("id").primaryKey(),
  documentId: integer("document_id").notNull().references(() => documents.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  accessLevel: varchar("access_level").notNull().default("read"), // read, write, admin
  grantedBy: varchar("granted_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// AI chat conversations
export const conversations = pgTable("conversations", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  title: varchar("title").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// AI chat messages
export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull().references(() => conversations.id),
  role: varchar("role").notNull(), // user, assistant
  content: text("content").notNull(),
  sources: jsonb("sources"), // Referenced documents
  createdAt: timestamp("created_at").defaultNow(),
});

// Search queries for analytics
export const searchQueries = pgTable("search_queries", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  query: text("query").notNull(),
  queryType: varchar("query_type").notNull(), // keyword, semantic
  resultsCount: integer("results_count").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  documents: many(documents),
  conversations: many(conversations),
  documentAccess: many(documentAccess),
  searchQueries: many(searchQueries),
}));

export const documentsRelations = relations(documents, ({ one, many }) => ({
  category: one(categories, {
    fields: [documents.categoryId],
    references: [categories.id],
  }),
  uploadedByUser: one(users, {
    fields: [documents.uploadedBy],
    references: [users.id],
  }),
  access: many(documentAccess),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  documents: many(documents),
}));

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  user: one(users, {
    fields: [conversations.userId],
    references: [users.id],
  }),
  messages: many(messages),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
}));

// Schemas
export const insertUserSchema = createInsertSchema(users).pick({
  email: true,
  firstName: true,
  lastName: true,
  profileImageUrl: true,
  role: true,
});

export const insertDocumentSchema = createInsertSchema(documents).pick({
  filename: true,
  originalName: true,
  fileType: true,
  fileSize: true,
  filePath: true,
  content: true,
  summary: true,
  categoryId: true,
  tags: true,
  metadata: true,
  uploadedBy: true,
});

export const insertCategorySchema = createInsertSchema(categories).pick({
  name: true,
  description: true,
  color: true,
  icon: true,
});

export const insertConversationSchema = createInsertSchema(conversations).pick({
  userId: true,
  title: true,
});

export const insertMessageSchema = createInsertSchema(messages).pick({
  conversationId: true,
  role: true,
  content: true,
  sources: true,
});

// Types
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type Document = typeof documents.$inferSelect;
export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type Category = typeof categories.$inferSelect;
export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type Conversation = typeof conversations.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messages.$inferSelect;
export type DocumentAccess = typeof documentAccess.$inferSelect;
export type SearchQuery = typeof searchQueries.$inferSelect;
