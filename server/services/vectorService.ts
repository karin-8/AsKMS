import OpenAI from "openai";
import { Document, documentVectors, InsertDocumentVector } from "@shared/schema";
import { db } from '../db';
import { eq, and } from "drizzle-orm";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY 
});

interface VectorDocument {
  id: string;
  content: string;
  embedding: number[];
  metadata: Record<string, any>;
  chunkIndex?: number;
  totalChunks?: number;
}

export class VectorService {

  // Split text into chunks of approximately 3000 characters with 300 character overlap
  private splitTextIntoChunks(text: string, maxChunkSize: number = 3000, overlap: number = 300): string[] {
    const chunks: string[] = [];
    let start = 0;

    while (start < text.length) {
      let end = start + maxChunkSize;
      
      // Try to break at a sentence or paragraph boundary
      if (end < text.length) {
        const lastPeriod = text.lastIndexOf('.', end);
        const lastNewline = text.lastIndexOf('\n', end);
        const lastBreak = Math.max(lastPeriod, lastNewline);
        
        if (lastBreak > start + maxChunkSize * 0.5) {
          end = lastBreak + 1;
        }
      }
      
      chunks.push(text.slice(start, end).trim());
      start = end - overlap;
      
      if (start >= text.length) break;
    }

    return chunks.filter(chunk => chunk.length > 50); // Filter out very small chunks
  }

  async addDocument(id: string, content: string, metadata: Record<string, any>): Promise<string> {
    try {
      // Remove existing document chunks if they exist
      this.removeDocument(id);

      if (!content || content.trim().length === 0) {
        throw new Error("Document content is empty");
      }

      // Split content into chunks for better coverage
      const chunks = this.splitTextIntoChunks(content);
      console.log(`Document ${id}: Split into ${chunks.length} chunks for vector processing`);

      let addedChunks = 0;

      // Process each chunk
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        
        try {
          // Generate embedding for this chunk
          const response = await openai.embeddings.create({
            model: "text-embedding-3-small",
            input: chunk,
          });

          const embedding = response.data[0].embedding;

          // Create vector document for this chunk
          const vectorDoc: VectorDocument = {
            id: `${id}_chunk_${i}`,
            content: chunk,
            embedding,
            metadata: {
              ...metadata,
              originalDocumentId: id,
              chunkIndex: i,
              totalChunks: chunks.length,
              chunkSize: chunk.length
            },
            chunkIndex: i,
            totalChunks: chunks.length
          };

          this.documents.push(vectorDoc);
          addedChunks++;

          // Add a small delay to avoid rate limiting
          if (i < chunks.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }

        } catch (chunkError) {
          console.error(`Error processing chunk ${i} of document ${id}:`, chunkError);
          // Continue with next chunk instead of failing entirely
        }
      }
      
      console.log(`Document ${id}: Successfully added ${addedChunks}/${chunks.length} chunks to vector database`);
      return `Document ${id} added to vector database with ${addedChunks} chunks`;
    } catch (error) {
      console.error("Error adding document to vector database:", error);
      throw new Error("Failed to add document to vector database");
    }
  }

  async removeDocument(id: string): Promise<void> {
    // Remove all chunks related to this document
    const beforeCount = this.documents.length;
    this.documents = this.documents.filter(doc => {
      // Remove exact match or chunk matches
      return doc.id !== id && !doc.id.startsWith(`${id}_chunk_`) && doc.metadata?.originalDocumentId !== id;
    });
    const afterCount = this.documents.length;
    const removedCount = beforeCount - afterCount;
    
    if (removedCount > 0) {
      console.log(`Removed ${removedCount} chunks for document ${id}`);
    }
  }

  async searchDocuments(
    query: string, 
    userId: string, 
    limit: number = 10
  ): Promise<Array<{ document: VectorDocument; similarity: number }>> {
    try {
      console.log(`VectorService: Total documents in memory: ${this.documents.length}`);
      const userDocs = this.documents.filter(doc => doc.metadata.userId === userId);
      console.log(`VectorService: Documents for user ${userId}: ${userDocs.length}`);
      
      if (this.documents.length === 0) {
        console.log("VectorService: No documents in vector database");
        return [];
      }

      // Generate embedding for the search query
      const response = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: query,
      });

      const queryEmbedding = response.data[0].embedding;

      // Calculate similarities for all chunks
      const allResults = this.documents
        .filter(doc => doc.metadata.userId === userId)
        .map(doc => ({
          document: doc,
          similarity: this.cosineSimilarity(queryEmbedding, doc.embedding)
        }))
        .sort((a, b) => b.similarity - a.similarity);

      // Group by original document ID and take top chunks per document
      const documentGroups = new Map<string, Array<{ document: VectorDocument; similarity: number }>>();
      
      allResults.forEach(result => {
        const originalDocId = result.document.metadata.originalDocumentId || result.document.id;
        if (!documentGroups.has(originalDocId)) {
          documentGroups.set(originalDocId, []);
        }
        documentGroups.get(originalDocId)!.push(result);
      });

      // Take top 3 chunks per document and flatten
      const combinedResults: Array<{ document: VectorDocument; similarity: number }> = [];
      
      documentGroups.forEach((chunks, docId) => {
        // Sort chunks by similarity and take top 3 per document
        const topChunks = chunks
          .sort((a, b) => b.similarity - a.similarity)
          .slice(0, 3);
        
        combinedResults.push(...topChunks);
      });

      // Sort by similarity and apply final limit
      const finalResults = combinedResults
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit);

      console.log(`Vector search for "${query}": Found ${finalResults.length} relevant chunks from ${documentGroups.size} documents`);
      
      return finalResults;
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

  getDocumentChunkStats(userId: string): { [docId: string]: { chunks: number; totalLength: number } } {
    const stats: { [docId: string]: { chunks: number; totalLength: number } } = {};
    
    this.documents
      .filter(doc => doc.metadata.userId === userId)
      .forEach(doc => {
        const originalDocId = doc.metadata.originalDocumentId || doc.id;
        if (!stats[originalDocId]) {
          stats[originalDocId] = { chunks: 0, totalLength: 0 };
        }
        stats[originalDocId].chunks++;
        stats[originalDocId].totalLength += doc.content.length;
      });
    
    return stats;
  }
}

export const vectorService = new VectorService();