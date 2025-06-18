import OpenAI from "openai";
import { Document } from "@shared/schema";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY 
});

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
      const response = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: content.substring(0, 8000), // Limit content for embedding
      });

      const embedding = response.data[0].embedding;

      // Remove existing document if it exists
      this.removeDocument(id);

      // Add new document
      const vectorDoc: VectorDocument = {
        id,
        content,
        embedding,
        metadata
      };

      this.documents.push(vectorDoc);
      
      return `Document ${id} added to vector database`;
    } catch (error) {
      console.error("Error adding document to vector database:", error);
      throw new Error("Failed to add document to vector database");
    }
  }

  async removeDocument(id: string): Promise<void> {
    this.documents = this.documents.filter(doc => doc.id !== id);
  }

  async searchDocuments(
    query: string, 
    userId: string, 
    limit: number = 5
  ): Promise<Array<{ document: VectorDocument; similarity: number }>> {
    try {
      if (this.documents.length === 0) {
        return [];
      }

      // Generate embedding for the search query
      const response = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: query,
      });

      const queryEmbedding = response.data[0].embedding;

      // Calculate similarities and sort by relevance
      const results = this.documents
        .filter(doc => doc.metadata.userId === userId)
        .map(doc => ({
          document: doc,
          similarity: this.cosineSimilarity(queryEmbedding, doc.embedding)
        }))
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit);

      return results;
    } catch (error) {
      console.error("Error searching vector database:", error);
      return [];
    }
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
    return dotProduct / (magnitudeA * magnitudeB);
  }

  getDocumentCount(): number {
    return this.documents.length;
  }

  getDocumentsByUser(userId: string): VectorDocument[] {
    return this.documents.filter(doc => doc.metadata.userId === userId);
  }
}

export const vectorService = new VectorService();