import OpenAI from "openai";

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR || "default_key" 
});

export class OpenAIService {
  // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
  private model = "gpt-4o";

  async classifyDocument(content: string, filename: string): Promise<{
    category: string;
    tags: string[];
    summary: string;
    confidence: number;
  }> {
    try {
      const response = await openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: "system",
            content: `You are a document classification expert. Analyze the document content and classify it into one of these categories: Financial, Legal, Technical, HR, Marketing, Operations, Research, or Other. Also generate relevant tags and a brief summary. Respond with JSON in this format: { "category": "string", "tags": ["string"], "summary": "string", "confidence": number }`,
          },
          {
            role: "user",
            content: `Please classify this document:\n\nFilename: ${filename}\n\nContent: ${content.substring(0, 4000)}`,
          },
        ],
        response_format: { type: "json_object" },
      });

      const result = JSON.parse(response.choices[0].message.content!);
      
      return {
        category: result.category || "Other",
        tags: Array.isArray(result.tags) ? result.tags : [],
        summary: result.summary || "No summary available",
        confidence: Math.max(0, Math.min(1, result.confidence || 0.5)),
      };
    } catch (error) {
      console.error("Error classifying document:", error);
      return {
        category: "Other",
        tags: [],
        summary: "Classification failed",
        confidence: 0,
      };
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: text,
      });

      return response.data[0].embedding;
    } catch (error) {
      console.error("Error generating embedding:", error);
      throw new Error("Failed to generate embedding");
    }
  }

  async generateChatResponse(
    query: string,
    context: Array<{ title: string; content: string; id: number }> = []
  ): Promise<{
    content: string;
    sources: Array<{ title: string; id: number }>;
  }> {
    try {
      const contextText = context
        .map(c => `Document: ${c.title}\nContent: ${c.content}`)
        .join("\n\n");

      const response = await openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: "system",
            content: `You are a knowledgeable AI assistant that helps users find information in their document collection. Use the provided context to answer questions accurately. If you can't find relevant information in the context, say so clearly. Always cite which documents you're referencing.`,
          },
          {
            role: "user",
            content: `Context:\n${contextText}\n\nQuestion: ${query}`,
          },
        ],
        temperature: 0.3,
      });

      const sources = context.map(c => ({ title: c.title, id: c.id }));

      return {
        content: response.choices[0].message.content!,
        sources,
      };
    } catch (error) {
      console.error("Error generating chat response:", error);
      return {
        content: "I apologize, but I'm having trouble processing your request right now. Please try again later.",
        sources: [],
      };
    }
  }

  async extractTextFromContent(content: string, fileType: string): Promise<string> {
    // For now, assume content is already extracted
    // In a real implementation, you would use specific libraries for each file type
    return content;
  }
}

export const openaiService = new OpenAIService();
