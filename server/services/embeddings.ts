import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface EmbeddingService {
  generateEmbedding(text: string): Promise<number[]>;
  generateEmbeddings(texts: string[]): Promise<number[][]>;
  calculateSimilarity(embedding1: number[], embedding2: number[]): number;
  chunkText(text: string, maxTokens?: number): string[];
}

export class OpenAIEmbeddingService implements EmbeddingService {
  private model = "text-embedding-3-small"; // 1536 dimensions, cost-effective
  private maxTokensPerChunk = 8000; // Conservative limit for text-embedding-3-small

  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await openai.embeddings.create({
        model: this.model,
        input: text.trim(),
      });

      return response.data[0].embedding;
    } catch (error) {
      console.error("Error generating embedding:", error);
      throw new Error("Failed to generate embedding");
    }
  }

  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    try {
      // OpenAI allows up to 2048 inputs per request for text-embedding-3-small
      const batchSize = 100; // Conservative batch size
      const embeddings: number[][] = [];

      for (let i = 0; i < texts.length; i += batchSize) {
        const batch = texts.slice(i, i + batchSize);
        const response = await openai.embeddings.create({
          model: this.model,
          input: batch.map(text => text.trim()),
        });

        embeddings.push(...response.data.map(item => item.embedding));
      }

      return embeddings;
    } catch (error) {
      console.error("Error generating embeddings:", error);
      throw new Error("Failed to generate embeddings");
    }
  }

  calculateSimilarity(embedding1: number[], embedding2: number[]): number {
    // Cosine similarity calculation
    if (embedding1.length !== embedding2.length) {
      throw new Error("Embeddings must have the same length");
    }

    let dotProduct = 0;
    let magnitude1 = 0;
    let magnitude2 = 0;

    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
      magnitude1 += embedding1[i] * embedding1[i];
      magnitude2 += embedding2[i] * embedding2[i];
    }

    magnitude1 = Math.sqrt(magnitude1);
    magnitude2 = Math.sqrt(magnitude2);

    if (magnitude1 === 0 || magnitude2 === 0) {
      return 0;
    }

    return dotProduct / (magnitude1 * magnitude2);
  }

  chunkText(text: string, maxTokens: number = this.maxTokensPerChunk): string[] {
    // Simple chunking by sentences, approximately 4 characters per token
    const approxMaxChars = maxTokens * 4;
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const chunks: string[] = [];
    let currentChunk = "";

    for (const sentence of sentences) {
      const trimmedSentence = sentence.trim();
      if (!trimmedSentence) continue;

      // If adding this sentence would exceed the limit, start a new chunk
      if (currentChunk.length + trimmedSentence.length > approxMaxChars && currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        currentChunk = trimmedSentence;
      } else {
        currentChunk += (currentChunk ? ". " : "") + trimmedSentence;
      }
    }

    // Add the last chunk if it has content
    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }

    // If no chunks were created (very short text), return the original text as a single chunk
    if (chunks.length === 0 && text.trim()) {
      chunks.push(text.trim());
    }

    return chunks;
  }

  getModel(): string {
    return this.model;
  }
}

// Export singleton instance
export const embeddingService = new OpenAIEmbeddingService();