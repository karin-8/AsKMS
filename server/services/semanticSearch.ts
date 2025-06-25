import { db } from "../db";
import { documents, documentChunks, searchSessions } from "@shared/schema"; // เพิ่ม searchSessions และ documentChunks
import { embeddingService } from "./embeddings"; // ตรวจสอบเส้นทางของไฟล์นี้
import { eq, sql, desc, and, or, ilike } from "drizzle-orm";

export interface SearchResult {
  id: number;
  name: string;
  content: string;
  summary?: string;
  category?: string;
  aiCategory?: string;
  similarity: number;
  chunkContent?: string;
  chunkIndex?: number;
  createdAt: string;
}

export interface SearchOptions {
  limit?: number;
  threshold?: number; // Minimum similarity threshold
  searchType?: "semantic" | "keyword" | "hybrid";
  categoryFilter?: string;
  dateRange?: { from: Date; to: Date };
}

export class SemanticSearchService {
  // ค่าเริ่มต้นสำหรับ Threshold สามารถปรับได้ตามความเหมาะสมของโมเดล AI และข้อมูลของคุณ
  private similarityThreshold = 0.5; // ปรับลดค่าเริ่มต้นลงเพื่อเพิ่มโอกาสเจอผลลัพธ์

  async searchDocuments(
    query: string,
    userId: string,
    options: SearchOptions = {},
  ): Promise<SearchResult[]> {
    const {
      limit = 20,
      threshold = this.similarityThreshold,
      searchType = "hybrid",
      categoryFilter,
      dateRange,
    } = options;

    console.log(
      `Search session: User ${userId} searched for "${query}" using ${searchType}`,
    );

    // Log search session (เรียกใช้ตรงนี้เพื่อบันทึกการค้นหา ไม่ว่าผลลัพธ์จะเป็นอย่างไร)
    // การบันทึก session ควรทำแบบ async ไม่บล็อกการทำงานหลัก
    this.logSearchSession(query, userId, searchType).catch((err) => {
      console.error("Failed to log search session:", err);
    });

    switch (searchType) {
      case "semantic":
        return this.performSemanticSearch(query, userId, {
          limit,
          threshold,
          categoryFilter,
          dateRange,
        });
      case "keyword":
        return this.performKeywordSearch(query, userId, {
          limit,
          categoryFilter,
          dateRange,
        });
      case "hybrid":
        return this.performHybridSearch(query, userId, {
          limit,
          threshold,
          categoryFilter,
          dateRange,
        });
      default:
        // Fallback to hybrid if searchType is invalid or not provided
        return this.performHybridSearch(query, userId, {
          limit,
          threshold,
          categoryFilter,
          dateRange,
        });
    }
  }

  private async performSemanticSearch(
    query: string,
    userId: string,
    options: Omit<SearchOptions, "searchType">,
  ): Promise<SearchResult[]> {
    const {
      limit = 20,
      threshold = this.similarityThreshold,
      categoryFilter,
      dateRange,
    } = options;

    try {
      // 1. สร้าง Embedding สำหรับ Query ก่อน
      const queryEmbedding = await embeddingService.generateEmbedding(query);
      if (!queryEmbedding || queryEmbedding.length === 0) {
        console.warn(
          "Query embedding could not be generated. Aborting semantic search.",
        );
        return []; // ไม่สามารถสร้าง embedding ได้ จึงไม่สามารถค้นหาเชิงความหมายได้
      }

      // 2. ดึงข้อมูล Documents ที่มี Embedding และเนื้อหา
      let baseConditions = and(
        eq(documents.userId, userId),
        sql`${documents.content} IS NOT NULL AND LENGTH(${documents.content}) > 0`,
        // เพิ่มเงื่อนไขว่าต้องมี embedding ด้วยจึงจะนำมาพิจารณาในการค้นหาเชิงความหมาย
        sql`${documents.embedding} IS NOT NULL`,
      );

      // Apply category filter if provided
      if (categoryFilter && categoryFilter !== "all") {
        baseConditions = and(
          baseConditions,
          or(
            eq(documents.category, categoryFilter),
            eq(documents.aiCategory, categoryFilter),
          ),
        );
      }

      // Apply date range filter if provided
      if (dateRange && dateRange.from && dateRange.to) {
        // ตรวจสอบว่ามีค่า from และ to
        baseConditions = and(
          baseConditions,
          sql`${documents.createdAt} >= ${dateRange.from.toISOString()}`, // แปลงเป็น ISO string
          sql`${documents.createdAt} <= ${dateRange.to.toISOString()}`,
        );
      }

      // ดึงเอกสารจากฐานข้อมูล
      const documentsToEvaluate = await db
        .select({
          id: documents.id,
          name: documents.name,
          content: documents.content,
          summary: documents.summary,
          category: documents.category,
          aiCategory: documents.aiCategory,
          createdAt: documents.createdAt,
          embedding: documents.embedding, // ดึง embedding มาด้วย
        })
        .from(documents)
        .where(baseConditions);

      const results: SearchResult[] = [];

      // 3. คำนวณความคล้ายคลึงกันและกรองผลลัพธ์
      for (const doc of documentsToEvaluate) {
        if (!doc.embedding) {
          // ควรถูกกรองไปแล้วโดย baseConditions แต่เพิ่มการเช็คซ้ำเพื่อความปลอดภัย
          console.warn(
            `Document ${doc.id} found without embedding despite filter.`,
          );
          continue;
        }

        try {
          // ตรวจสอบและแปลง string embedding ให้เป็น array ของตัวเลข
          const docEmbedding: number[] = JSON.parse(doc.embedding as string); // Cast to string

          if (!Array.isArray(docEmbedding) || docEmbedding.length === 0) {
            console.error(
              `Invalid embedding format for document ${doc.id}. Expected array of numbers.`,
            );
            continue;
          }

          const similarity = embeddingService.calculateSimilarity(
            queryEmbedding,
            docEmbedding,
          );

          if (similarity >= threshold) {
            results.push({
              id: doc.id,
              name: doc.name,
              content: doc.content || "",
              summary: doc.summary || undefined,
              category: doc.category || undefined,
              aiCategory: doc.aiCategory || undefined,
              similarity,
              createdAt: doc.createdAt?.toISOString() || "",
            });
          }
        } catch (error) {
          console.error(
            `Error parsing or calculating similarity for document ${doc.id}:`,
            error,
          );
        }
      }

      // Sort by similarity (highest first) and limit results
      return results
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit);
    } catch (error) {
      console.error("Error performing semantic search:", error);
      throw new Error(
        "Failed to perform semantic search due to internal error.",
      );
    }
  }

  private async performKeywordSearch(
    query: string,
    userId: string,
    options: Omit<SearchOptions, "searchType">,
  ): Promise<SearchResult[]> {
    const { limit = 20, categoryFilter, dateRange } = options;

    try {
      const searchTerms = query
        .toLowerCase()
        .split(/\s+/)
        .filter((term) => term.length > 2); // กรองคำที่สั้นเกินไป

      let whereConditions = eq(documents.userId, userId);

      // Add text search conditions only if there are valid search terms
      if (searchTerms.length > 0) {
        const searchConditions = searchTerms.map((term) =>
          or(
            ilike(documents.name, `%${term}%`),
            ilike(documents.content, `%${term}%`),
            ilike(documents.summary, `%${term}%`),
            // ตรวจสอบว่า `documents.tags` เป็น array of text ใน DB schema
            sql`${documents.tags} && ARRAY[${term}]::text[]`,
          ),
        );
        whereConditions = and(whereConditions, or(...searchConditions));
      } else {
        // ถ้าไม่มี searchTerms ที่มีประโยชน์ ให้ส่งคืน array ว่างเปล่า หรือดึงเอกสารล่าสุดตามเงื่อนไขอื่นๆ
        console.warn(
          "No valid search terms for keyword search, returning empty results.",
        );
        return [];
      }

      // Apply filters
      if (categoryFilter && categoryFilter !== "all") {
        whereConditions = and(
          whereConditions,
          or(
            eq(documents.category, categoryFilter),
            eq(documents.aiCategory, categoryFilter),
          ),
        );
      }

      if (dateRange && dateRange.from && dateRange.to) {
        whereConditions = and(
          whereConditions,
          sql`${documents.createdAt} >= ${dateRange.from.toISOString()}`,
          sql`${documents.createdAt} <= ${dateRange.to.toISOString()}`,
        );
      }

      const results = await db
        .select({
          id: documents.id,
          name: documents.name,
          content: documents.content,
          summary: documents.summary,
          category: documents.category,
          aiCategory: documents.aiCategory,
          createdAt: documents.createdAt,
        })
        .from(documents)
        .where(whereConditions)
        .orderBy(desc(documents.createdAt))
        .limit(limit);

      return results.map((doc) => ({
        id: doc.id,
        name: doc.name,
        content: doc.content || "",
        summary: doc.summary || undefined,
        category: doc.category || undefined,
        aiCategory: doc.aiCategory || undefined,
        similarity: 0.8, // Fixed similarity for keyword search (สามารถปรับได้)
        createdAt: doc.createdAt?.toISOString() || "",
      }));
    } catch (error) {
      console.error("Error performing keyword search:", error);
      throw new Error(
        "Failed to perform keyword search due to internal error.",
      );
    }
  }

  private async performHybridSearch(
    query: string,
    userId: string,
    options: Omit<SearchOptions, "searchType">,
  ): Promise<SearchResult[]> {
    const { limit = 20 } = options;
    const halfLimit = Math.ceil(limit / 2); // แบ่งโควต้าผลลัพธ์ครึ่งหนึ่ง

    try {
      // Get results from both semantic and keyword search
      const [semanticResults, keywordResults] = await Promise.all([
        this.performSemanticSearch(query, userId, {
          ...options,
          limit: halfLimit,
        }),
        this.performKeywordSearch(query, userId, {
          ...options,
          limit: halfLimit,
        }),
      ]);

      // Combine and deduplicate results using a Map for efficient lookup
      const combinedResults = new Map<number, SearchResult>();

      // Add semantic results with higher weight (semantic usually more relevant)
      semanticResults.forEach((result) => {
        combinedResults.set(result.id, {
          ...result,
          similarity: result.similarity * 1.2, // Boost semantic results for hybrid score
        });
      });

      // Add keyword results, boosting if not already present or combining scores
      keywordResults.forEach((result) => {
        if (combinedResults.has(result.id)) {
          // If document exists, combine (or take max) similarity
          const existing = combinedResults.get(result.id)!;
          existing.similarity = Math.min(1.0, existing.similarity + 0.2); // Cap at 1.0
        } else {
          combinedResults.set(result.id, result);
        }
      });

      // Sort by combined similarity (highest first) and limit to final 'limit'
      return Array.from(combinedResults.values())
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit);
    } catch (error) {
      console.error("Error performing hybrid search:", error);
      throw new Error("Failed to perform hybrid search due to internal error.");
    }
  }

  async generateDocumentEmbedding(documentId: number): Promise<void> {
    try {
      const [document] = await db
        .select({
          id: documents.id,
          content: documents.content,
          name: documents.name,
          summary: documents.summary,
        })
        .from(documents)
        .where(eq(documents.id, documentId));

      if (!document) {
        console.warn(
          `Document with ID ${documentId} not found for embedding generation.`,
        );
        return; // ไม่ต้อง throw error ถ้าแค่ไม่พบเอกสาร
      }

      // Combine relevant document text for a single embedding
      const textToEmbed = [
        document.name,
        document.summary || "",
        document.content || "",
      ]
        .filter(Boolean)
        .join("\n\n")
        .trim(); // Trim เพื่อกำจัด whitespace ที่ไม่จำเป็น

      if (!textToEmbed) {
        // ตรวจสอบหลังจาก trim
        console.warn(
          `No effective content to embed for document ${documentId}. Skipping embedding generation.`,
        );
        // อัปเดต isInVectorDb เป็น false เพื่อบ่งชี้ว่าไม่มี embedding
        await db
          .update(documents)
          .set({ isInVectorDb: false })
          .where(eq(documents.id, documentId));
        return;
      }

      // Generate embedding
      const embedding = await embeddingService.generateEmbedding(textToEmbed);

      if (!embedding || embedding.length === 0) {
        console.error(
          `Embedding generation failed for document ${documentId}. No embedding returned.`,
        );
        await db
          .update(documents)
          .set({ isInVectorDb: false })
          .where(eq(documents.id, documentId));
        return;
      }

      // Update document with embedding
      await db
        .update(documents)
        .set({
          embedding: JSON.stringify(embedding), // เก็บเป็น JSON string
          embeddingModel: embeddingService.getModel(), // ตรวจสอบว่า getModel() มีอยู่จริงใน embeddingService
          lastEmbeddingUpdate: new Date(),
          isInVectorDb: true, // ตั้งค่าเป็น true เมื่อมี embedding
        })
        .where(eq(documents.id, documentId));

      // Generate chunk embeddings for finer-grained search (ถ้าจำเป็น)
      await this.generateChunkEmbeddings(documentId, document.content || "");
    } catch (error) {
      console.error(
        `Error generating embedding for document ${documentId}:`,
        error,
      );
      // อาจจะตั้งค่า isInVectorDb เป็น false ด้วยในกรณีเกิด error
      await db
        .update(documents)
        .set({ isInVectorDb: false })
        .where(eq(documents.id, documentId))
        .catch((e) =>
          console.error("Failed to update isInVectorDb status:", e),
        );
      throw error; // Re-throw to propagate the error if needed higher up
    }
  }

  private async generateChunkEmbeddings(
    documentId: number,
    content: string,
  ): Promise<void> {
    try {
      if (!content || content.trim().length === 0) {
        console.warn(
          `No content provided for chunk embedding generation for document ${documentId}.`,
        );
        return;
      }

      // Delete existing chunks to prevent duplicates or stale data
      await db
        .delete(documentChunks)
        .where(eq(documentChunks.documentId, documentId));

      // Chunk the content
      const chunks = embeddingService.chunkText(content);

      if (chunks.length === 0) {
        console.warn(`No chunks generated for document ${documentId}.`);
        return;
      }

      // Generate embeddings for chunks
      // ตรวจสอบว่า generateEmbeddings รองรับ array ของ string และคืนค่า array ของ array ของตัวเลข
      const embeddings = await embeddingService.generateEmbeddings(chunks);

      if (!embeddings || embeddings.length !== chunks.length) {
        console.error(
          `Mismatched chunk embeddings count for document ${documentId}. Skipping chunk insert.`,
        );
        return;
      }

      // Prepare chunk inserts
      const chunkInserts = chunks.map((chunk, index) => ({
        documentId,
        chunkIndex: index,
        content: chunk,
        embedding: JSON.stringify(embeddings[index]), // เก็บเป็น JSON string
        // TODO: คำนวณ startPosition และ endPosition ที่ถูกต้องตามตำแหน่งของ chunk ใน content ทั้งหมด
        startPosition: 0,
        endPosition: chunk.length,
        tokenCount: Math.ceil(chunk.length / 4), // Rough token estimate
      }));

      // Insert chunks with embeddings in batches if many
      if (chunkInserts.length > 0) {
        // ใช้ db.insert().values() จะทำการ insert หลายรายการพร้อมกัน
        await db.insert(documentChunks).values(chunkInserts);
        console.log(
          `Successfully generated and inserted ${chunkInserts.length} chunks for document ${documentId}.`,
        );
      }
    } catch (error) {
      console.error(
        `Error generating chunk embeddings for document ${documentId}:`,
        error,
      );
      // Don't throw to avoid interrupting main document embedding flow, but log
    }
  }

  private async logSearchSession(
    query: string,
    userId: string,
    searchType: string,
  ): Promise<void> {
    try {
      const queryEmbedding = await embeddingService.generateEmbedding(query);

      await db.insert(searchSessions).values({
        userId,
        query,
        searchType,
        queryEmbedding: queryEmbedding ? JSON.stringify(queryEmbedding) : null, // เก็บ embedding ถ้ามี
        resultsCount: 0, // จะถูกอัปเดตหลังจากได้ผลลัพธ์
        createdAt: new Date(), // เพิ่ม createdAt
      });
    } catch (error) {
      console.error("Error logging search session:", error);
      // ไม่ควร throw error สำหรับ logging failures
    }
  }

  async reindexAllDocuments(
    userId: string,
  ): Promise<{ processed: number; failed: number }> {
    try {
      const userDocuments = await db
        .select({ id: documents.id })
        .from(documents)
        .where(eq(documents.userId, userId));

      let processed = 0;
      let failed = 0;

      // ใช้ Promise.allSettled เพื่อให้การ reindex แต่ละเอกสารไม่หยุดเมื่อมีเอกสารใดเกิด error
      const results = await Promise.allSettled(
        userDocuments.map(async (doc) => {
          try {
            await this.generateDocumentEmbedding(doc.id);
            processed++;
          } catch (error) {
            console.error(`Failed to reindex document ${doc.id}:`, error);
            failed++;
          }
        }),
      );

      // คุณสามารถตรวจสอบ results เพื่อดูสถานะของแต่ละ Promise
      // results.forEach((result, index) => {
      //   if (result.status === 'rejected') {
      //     console.error(`Document ${userDocuments[index].id} reindex failed:`, result.reason);
      //   }
      // });

      return { processed, failed };
    } catch (error) {
      console.error("Error initiating reindexing all documents:", error);
      throw new Error(
        "Failed to reindex documents due to an unexpected error.",
      );
    }
  }
}

// Export singleton instance
export const semanticSearchService = new SemanticSearchService();
