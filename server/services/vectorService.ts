import { openaiService } from "./openai";

// Simple in-memory vector store for demo purposes
// In production, you would use Pinecone, Weaviate, or similar
interface VectorDocument {
  id: string;
  content: string;
  embedding: number[];
  metadata: Record<string, any>;
}

export class VectorService {
  private documents: VectorDocument[] = [];

  async addDocument(id: string, content: string, metadata: Record<string, any>): Promise<string> {
    try {
      // Generate embedding for the document content
      const embedding = await openaiService.generateEmbedding(content);
      
      // Store the document with its embedding
      const vectorDoc: VectorDocument = {
        id,
        content,
        embedding,
        metadata,
      };

      // Remove existing document if it exists
      this.documents = this.documents.filter(doc => doc.id !== id);
      
      // Add new document
      this.documents.push(vectorDoc);

      return id;
    } catch (error) {
      console.error("Error adding document to vector store:", error);
      throw new Error("Failed to add document to vector store");
    }
  }

  async removeDocument(id: string): Promise<void> {
    this.documents = this.documents.filter(doc => doc.id !== id);
  }

  async searchDocuments(
    query: string,
    options: {
      userId?: string;
      limit?: number;
      threshold?: number;
    } = {}
  ): Promise<Array<{ id: string; content: string; score: number; metadata: Record<string, any> }>> {
    try {
      const { userId, limit = 10, threshold = 0.7 } = options;

      // Generate embedding for the query
      const queryEmbedding = await openaiService.generateEmbedding(query);

      // Calculate similarity scores
      const results = this.documents
        .map(doc => ({
          id: doc.id,
          content: doc.content,
          metadata: doc.metadata,
          score: this.cosineSimilarity(queryEmbedding, doc.embedding),
        }))
        .filter(result => {
          // Filter by user if specified
          if (userId && result.metadata.uploadedBy !== userId) {
            return false;
          }
          // Filter by similarity threshold
          return result.score >= threshold;
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

      return results;
    } catch (error) {
      console.error("Error searching documents:", error);
      return [];
    }
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error("Vectors must have the same length");
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (normA * normB);
  }

  getDocumentCount(): number {
    return this.documents.length;
  }

  getDocumentsByUser(userId: string): VectorDocument[] {
    return this.documents.filter(doc => doc.metadata.uploadedBy === userId);
  }
}

export const vectorService = new VectorService();
