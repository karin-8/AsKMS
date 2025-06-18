import OpenAI from "openai";
import fs from "fs";
import { Document } from "@shared/schema";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR || "default_key"
});

export async function processDocument(filePath: string, mimeType: string): Promise<{
  content: string;
  summary: string;
  tags: string[];
}> {
  try {
    let content = "";
    
    // Extract content based on file type
    if (mimeType === "text/plain") {
      content = await fs.promises.readFile(filePath, "utf-8");
    } else if (mimeType === "application/pdf" || mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
      // For PDF and DOCX, we'll use a simple text extraction or OCR
      // In a real implementation, you'd use libraries like pdf-parse or mammoth
      content = "Content extraction not implemented for this file type.";
    } else if (mimeType.startsWith("image/")) {
      // For images, use GPT-4o vision capabilities
      const imageBuffer = await fs.promises.readFile(filePath);
      const base64Image = imageBuffer.toString('base64');
      
      const visionResponse = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Extract all text and describe the content of this document image. Provide the extracted text and a summary of what's shown."
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType};base64,${base64Image}`
                }
              }
            ],
          },
        ],
        max_tokens: 1000,
      });
      
      content = visionResponse.choices[0].message.content || "";
    }

    if (!content || content.trim().length === 0) {
      throw new Error("No content could be extracted from the document");
    }

    // Generate summary and tags using AI
    const analysisResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a document analysis expert. Analyze the provided document content and return a JSON response with a concise summary (max 200 characters) and relevant tags (array of 3-8 keywords) for categorization and search."
        },
        {
          role: "user",
          content: `Please analyze this document content and provide a summary and tags:\n\n${content.substring(0, 4000)}`
        }
      ],
      response_format: { type: "json_object" },
    });

    const analysis = JSON.parse(analysisResponse.choices[0].message.content || "{}");
    
    return {
      content: content.substring(0, 10000), // Limit content length
      summary: analysis.summary || "Document processed successfully",
      tags: Array.isArray(analysis.tags) ? analysis.tags : ["document"]
    };

  } catch (error) {
    console.error("Error processing document with AI:", error);
    return {
      content: "Error extracting content",
      summary: "Document uploaded but could not be processed with AI",
      tags: ["unprocessed"]
    };
  }
}

export async function generateChatResponse(userMessage: string, documents: Document[]): Promise<string> {
  try {
    // Prepare context from documents
    const documentContext = documents
      .filter(doc => doc.content && doc.content.trim().length > 0)
      .slice(0, 5) // Limit to 5 most recent documents for context
      .map(doc => `Document: ${doc.name}\nSummary: ${doc.summary}\nTags: ${doc.tags?.join(", ")}\nContent: ${doc.content?.substring(0, 500)}`)
      .join("\n\n");

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an AI assistant helping users with their document management system. You have access to the user's documents and can answer questions about them, help with searches, provide summaries, and assist with document organization.

Available documents context:
${documentContext}

Provide helpful, accurate responses based on the available documents. If you can't find relevant information in the documents, let the user know and suggest how they might upload or organize documents to get better assistance.`
        },
        {
          role: "user",
          content: userMessage
        }
      ],
      max_tokens: 500,
    });

    return response.choices[0].message.content || "I'm sorry, I couldn't generate a response at this time.";

  } catch (error) {
    console.error("Error generating chat response:", error);
    return "I'm experiencing some technical difficulties. Please try again later.";
  }
}
