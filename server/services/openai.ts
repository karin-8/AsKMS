import OpenAI from "openai";
import fs from "fs";
import { Document } from "@shared/schema";
import mammoth from "mammoth";
import XLSX from "xlsx";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR || "default_key"
});

export async function processDocument(filePath: string, mimeType: string): Promise<{
  content: string;
  summary: string;
  tags: string[];
  category: string;
  categoryColor: string;
}> {
  try {
    let content = "";
    
    // Extract content based on file type
    if (mimeType === "text/plain") {
      content = await fs.promises.readFile(filePath, "utf-8");
    } else if (mimeType === "application/pdf") {
      // For PDF files, use textract for text extraction
      try {
        const textract = require('textract');
        content = await new Promise((resolve, reject) => {
          textract.fromFileWithPath(filePath, (error: any, text: string) => {
            if (error) {
              console.error("PDF textract error:", error);
              resolve(`PDF document: ${filePath.split('/').pop()}. Text extraction failed, analyzing file metadata for classification.`);
            } else {
              resolve(text || `PDF document: ${filePath.split('/').pop()}. No extractable text found.`);
            }
          });
        });
      } catch (error) {
        console.error("PDF processing error:", error);
        content = `PDF document: ${filePath.split('/').pop()}. Processing PDF content for classification.`;
      }
    } else if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
      // Extract text from DOCX
      const docxBuffer = await fs.promises.readFile(filePath);
      const result = await mammoth.extractRawText({ buffer: docxBuffer });
      content = result.value;
    } else if (mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" || 
               mimeType === "application/vnd.ms-excel") {
      // Extract text from Excel files
      try {
        const workbook = XLSX.readFile(filePath);
        const sheets = workbook.SheetNames;
        let allText = "";
        sheets.forEach(sheet => {
          const worksheet = workbook.Sheets[sheet];
          const sheetData = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false });
          allText += `Sheet: ${sheet}\n`;
          sheetData.forEach((row: any) => {
            if (Array.isArray(row) && row.length > 0) {
              allText += row.join('\t') + '\n';
            }
          });
          allText += '\n';
        });
        content = allText || `Excel file: ${filePath.split('/').pop()}. Contains ${sheets.length} sheets.`;
      } catch (error) {
        console.error("Excel processing error:", error);
        content = `Excel file: ${filePath.split('/').pop()}. Content extraction failed, analyzing file metadata.`;
      }
    } else if (mimeType === "application/vnd.openxmlformats-officedocument.presentationml.presentation") {
      // For PPTX files, use textract for text extraction
      try {
        const textract = require('textract');
        content = await new Promise((resolve, reject) => {
          textract.fromFileWithPath(filePath, (error: any, text: string) => {
            if (error) {
              console.error("PPTX textract error:", error);
              resolve(`PowerPoint presentation: ${filePath.split('/').pop()}. Text extraction failed, analyzing file metadata for classification.`);
            } else {
              resolve(text || `PowerPoint presentation: ${filePath.split('/').pop()}. No extractable text found.`);
            }
          });
        });
      } catch (error) {
        console.error("PPTX processing error:", error);
        content = `PowerPoint presentation: ${filePath.split('/').pop()}. Processing presentation content for classification.`;
      }
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
      return {
        content: "",
        summary: "No content could be extracted from this document.",
        tags: ["empty"],
        category: "Uncategorized",
        categoryColor: "#6B7280"
      };
    }

    // Enhanced AI analysis for intelligent classification and tagging
    const analysisResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an expert document classifier and analyzer for a Knowledge Management System. Analyze documents and provide:

1. CATEGORY CLASSIFICATION - Classify into ONE of these categories:
   - HR: Resumes, CVs, job applications, employee documents, recruitment materials
   - Finance: Invoices, budgets, financial reports, expense reports, accounting documents
   - Legal: Contracts, agreements, legal documents, compliance, terms of service
   - Marketing: Campaigns, brochures, presentations, promotional materials, brand assets
   - Technical: Manuals, specifications, code documentation, IT procedures, technical guides
   - Operations: SOPs, workflows, operational guidelines, process documentation
   - Research: Studies, analysis, whitepapers, academic papers, research reports
   - Personal: Personal notes, diaries, personal correspondence, private documents
   - Administrative: Forms, applications, administrative documents, general paperwork
   - Uncategorized: Documents that don't clearly fit the above categories

2. INTELLIGENT TAGGING - Generate 4-8 specific, relevant tags that describe:
   - Document type/format
   - Subject matter/topic
   - Purpose/use case
   - Key themes or concepts

3. SUMMARY - Create a concise 2-3 sentence summary highlighting the document's main purpose and key information

Respond with JSON in this exact format:
{
  "category": "category_name",
  "summary": "concise summary here",
  "tags": ["specific_tag1", "topic_tag2", "type_tag3", "purpose_tag4"]
}`
        },
        {
          role: "user",
          content: `Analyze and classify this document content:\n\n${content.substring(0, 4000)}`
        }
      ],
      response_format: { type: "json_object" },
      max_tokens: 800,
    });

    const analysis = JSON.parse(analysisResponse.choices[0].message.content || "{}");
    
    // Category color mapping for visual identification
    const categoryColors: Record<string, string> = {
      "HR": "#10B981",           // Green - Human resources
      "Finance": "#F59E0B",      // Amber - Financial documents  
      "Legal": "#EF4444",        // Red - Legal/compliance
      "Marketing": "#8B5CF6",    // Purple - Marketing materials
      "Technical": "#3B82F6",    // Blue - Technical documentation
      "Operations": "#6366F1",   // Indigo - Operational procedures
      "Research": "#06B6D4",     // Cyan - Research and analysis
      "Personal": "#EC4899",     // Pink - Personal documents
      "Administrative": "#84CC16", // Lime - Administrative forms
      "Uncategorized": "#6B7280"  // Gray - Uncategorized items
    };
    
    const category = analysis.category || "Uncategorized";
    const categoryColor = categoryColors[category] || "#6B7280";
    
    return {
      content: content.substring(0, 10000),
      summary: analysis.summary || "Document processed successfully",
      tags: Array.isArray(analysis.tags) ? analysis.tags : ["document"],
      category,
      categoryColor
    };

  } catch (error) {
    console.error("Error processing document with AI:", error);
    return {
      content: "Error extracting content",
      summary: "Document uploaded but could not be processed with AI",
      tags: ["unprocessed"],
      category: "Uncategorized",
      categoryColor: "#6B7280"
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
