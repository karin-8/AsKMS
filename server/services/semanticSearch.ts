import { db } from "../db";
import { documents } from "@shared/schema";
import { eq, sql, desc, and, or, ilike } from "drizzle-orm";

export interface SearchResult {
  id: number;
  name: string;
  content: string;
  summary?: string;
  category?: string;
  aiCategory?: string;
  similarity: number;
  createdAt: string;
}

export interface SearchOptions {
  limit?: number;
  threshold?: number;
  searchType?: 'semantic' | 'keyword' | 'hybrid';
  categoryFilter?: string;
  dateRange?: { from: Date; to: Date };
}

export class SemanticSearchService {
  private similarityThreshold = 0.7;

  async searchDocuments(
    query: string,
    userId: string,
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    const {
      limit = 20,
      threshold = this.similarityThreshold,
      searchType = 'hybrid',
      categoryFilter,
      dateRange
    } = options;

    console.log(`Search session: ${userId} searched for "${query}" using ${searchType}`);

    switch (searchType) {
      case 'semantic':
        return this.performSemanticSearch(query, userId, { limit, threshold, categoryFilter, dateRange });
      case 'keyword':
        return this.performKeywordSearch(query, userId, { limit, categoryFilter, dateRange });
      case 'hybrid':
        return this.performHybridSearch(query, userId, { limit, threshold, categoryFilter, dateRange });
      default:
        return this.performHybridSearch(query, userId, { limit, threshold, categoryFilter, dateRange });
    }
  }

  private async performSemanticSearch(
    query: string,
    userId: string,
    options: Omit<SearchOptions, 'searchType'>
  ): Promise<SearchResult[]> {
    // Fall back to keyword search since embeddings aren't fully implemented
    console.log("Semantic search falling back to keyword search");
    return this.performKeywordSearch(query, userId, options);
  }

  private async performKeywordSearch(
    query: string,
    userId: string,
    options: Omit<SearchOptions, 'searchType'>
  ): Promise<SearchResult[]> {
    const { limit = 20, categoryFilter, dateRange } = options;

    console.log(`SemanticSearchService keyword search - query: "${query}", userId: ${userId}`);

    try {
      const searchTerms = query.toLowerCase().split(/\s+/).filter(term => term.length > 0);
      console.log(`Search terms: ${searchTerms.join(', ')}`);
      
      // Build search conditions for each term
      const searchConditions = searchTerms.map(term => 
        or(
          sql`LOWER(${documents.name}) LIKE ${`%${term}%`}`,
          sql`LOWER(${documents.content}) LIKE ${`%${term}%`}`,
          sql`LOWER(${documents.summary}) LIKE ${`%${term}%`}`,
          sql`LOWER(${documents.aiCategory}) LIKE ${`%${term}%`}`,
          sql`EXISTS (
            SELECT 1 FROM unnest(${documents.tags}) AS tag 
            WHERE LOWER(tag) LIKE ${`%${term}%`}
          )`
        )
      );

      let whereConditions = and(
        eq(documents.userId, userId),
        searchConditions.length > 0 ? or(...searchConditions) : sql`true`
      );

      // Apply filters
      if (categoryFilter && categoryFilter !== 'all') {
        whereConditions = and(
          whereConditions,
          eq(documents.aiCategory, categoryFilter)
        );
      }

      if (dateRange) {
        whereConditions = and(
          whereConditions,
          sql`${documents.createdAt} >= ${dateRange.from}`,
          sql`${documents.createdAt} <= ${dateRange.to}`
        );
      }

      const results = await db
        .select({
          id: documents.id,
          name: documents.name,
          content: documents.content,
          summary: documents.summary,
          aiCategory: documents.aiCategory,
          tags: documents.tags,
          createdAt: documents.createdAt,
        })
        .from(documents)
        .where(whereConditions)
        .orderBy(desc(documents.createdAt))
        .limit(limit);

      console.log(`SemanticSearchService found ${results.length} results`);

      return results.map(doc => ({
        id: doc.id,
        name: doc.name,
        content: doc.content || '',
        summary: doc.summary || undefined,
        category: undefined,
        aiCategory: doc.aiCategory || undefined,
        similarity: 0.8,
        createdAt: doc.createdAt?.toISOString() || '',
      }));
    } catch (error) {
      console.error("Error performing keyword search in SemanticSearchService:", error);
      throw new Error("Failed to perform keyword search");
    }
  }

  private async performHybridSearch(
    query: string,
    userId: string,
    options: Omit<SearchOptions, 'searchType'>
  ): Promise<SearchResult[]> {
    // For now, just use keyword search as hybrid
    console.log("Hybrid search using keyword search");
    return this.performKeywordSearch(query, userId, options);
  }

  // Placeholder methods for future semantic search implementation
  async generateDocumentEmbedding(documentId: number): Promise<void> {
    console.log(`Embedding generation placeholder for document ${documentId}`);
  }

  async reindexAllDocuments(userId: string): Promise<{ processed: number; failed: number }> {
    console.log(`Reindexing placeholder for user ${userId}`);
    return { processed: 0, failed: 0 };
  }
}

// Export singleton instance
export const semanticSearchService = new SemanticSearchService();

// Export the main search function for backwards compatibility
export async function searchDocuments(
  query: string,
  userId: string,
  options: SearchOptions = {}
): Promise<SearchResult[]> {
  return semanticSearchService.searchDocuments(query, userId, options);
}