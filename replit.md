# AI-KMS (Knowledge Management System) - Project Overview

## Overview

This is a full-stack AI-powered Knowledge Management System built with modern web technologies. The application enables users to upload, organize, search, and interact with documents using artificial intelligence. It features document processing, semantic search, AI chat assistance, user management, and enterprise integrations.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Styling**: Tailwind CSS with shadcn/ui component library
- **State Management**: TanStack Query (React Query) for server state
- **Routing**: Wouter for lightweight client-side routing
- **Build Tool**: Vite with custom configuration for monorepo structure

### Backend Architecture
- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js with middleware for CORS, body parsing, and logging
- **Authentication**: Replit Auth with OpenID Connect and session management
- **Database ORM**: Drizzle ORM with PostgreSQL dialect
- **File Processing**: Multer for uploads, various text extraction libraries

### Data Storage Solutions
- **Primary Database**: PostgreSQL (Neon Database in production)
- **Database Schema**: 
  - User management tables (users, sessions)
  - Document storage (documents, categories)
  - Chat system (conversations, messages)
  - Analytics and permissions
  - HR employee lookup system
- **File Storage**: Local filesystem with organized upload directory
- **Vector Search**: In-memory vector storage using OpenAI embeddings

## Key Components

### Document Processing Pipeline
1. **File Upload**: Multi-format support (PDF, DOCX, TXT, images)
2. **Content Extraction**: Automated text extraction using LlamaParse and textract
3. **AI Processing**: OpenAI GPT-4 for summarization, categorization, and tag generation
4. **Vector Embedding**: Text-embedding-3-small for semantic search capabilities
5. **Database Storage**: Structured metadata and content storage

### AI-Powered Features
- **Advanced Semantic Search**: OpenAI text-embedding-3-small integration with custom embeddings, document chunking, and hybrid search combining semantic and keyword approaches
- **Vector Database**: Document and chunk-level embeddings stored in PostgreSQL with similarity calculations
- **Search Analytics**: Query tracking, search session logging, and performance insights
- **Chat Assistant**: Conversational interface with document context and feedback system
- **Auto-Categorization**: AI-generated categories and tags with CSV/TXT processing
- **Content Summarization**: Automatic document summaries
- **Widget Integration**: Embeddable chat widgets for external sites
- **Feedback Collection**: RLHF-ready feedback system with thumbs up/down and explanations
- **Document Analytics**: Demand insights dashboard with access patterns and trends

### User Management System
- **Role-Based Access**: Admin, Editor, Viewer roles
- **Department Management**: User organization by departments
- **Permission System**: Document-level and department-level access controls
- **Profile Management**: User profiles with avatars and preferences

### Enterprise Integrations
- **Database Connections**: PostgreSQL, MySQL support
- **API Integrations**: REST API connectivity
- **HR System Integration**: Employee lookup via Thai Citizen ID
- **Live Chat Widgets**: Embeddable customer support widgets

## Data Flow

1. **Document Upload**: Files uploaded via drag-drop interface
2. **Processing Queue**: Background processing for text extraction
3. **AI Enhancement**: Content analysis and metadata generation
4. **Vector Indexing**: Embedding generation for semantic search
5. **Search & Discovery**: Keyword and semantic search capabilities
6. **Chat Interaction**: Context-aware AI responses using retrieved documents

## External Dependencies

### Core Services
- **OpenAI API**: GPT-4 for text processing, text-embedding-3-small for vectors
- **LlamaParse**: Advanced PDF text extraction service
- **Neon Database**: Serverless PostgreSQL hosting

### Authentication & Security
- **Replit Auth**: OAuth provider integration
- **Session Management**: PostgreSQL-backed session storage
- **CORS Configuration**: Configured for widget embeddings

### UI/UX Libraries
- **Radix UI**: Unstyled, accessible component primitives
- **Lucide React**: Icon system
- **Recharts**: Data visualization components
- **React Hook Form**: Form state management

## Deployment Strategy

### Development Environment
- **Runtime**: Replit with Node.js 20
- **Database**: PostgreSQL 16
- **Hot Reload**: Vite development server
- **Process Management**: npm scripts for development workflow

### Production Build
- **Frontend Build**: Vite production build to dist/public
- **Backend Build**: esbuild bundling for Node.js deployment
- **Database Migrations**: Drizzle Kit for schema management
- **Environment**: Autoscale deployment target on port 80

### Configuration Management
- **Environment Variables**: DATABASE_URL, OPENAI_API_KEY, session secrets
- **Path Aliases**: TypeScript path mapping for clean imports
- **Asset Management**: Organized public assets and uploads

## Changelog

```
Changelog:
- June 25, 2025. Initial setup
- June 25, 2025. Fixed Chat with Documents feature - improved message display and Thai date/time formatting
- June 25, 2025. Enhanced CSV/TXT file processing with structured data analysis and document-specific chat targeting
- June 25, 2025. Implemented Document Demand Insights dashboard and AI Assistant feedback system with RLHF preparation
- June 25, 2025. Implemented resizable chat modals and fixed navigation for Document Demand Insights dashboard
- June 25, 2025. Fixed chat modal positioning (starts higher on screen) and added bidirectional resize capability including upward expansion
- June 25, 2025. Enhanced chat scrolling behavior to auto-scroll to latest messages when reopening dialogs
- June 25, 2025. Implemented advanced semantic search with custom embeddings - added OpenAI text-embedding-3-small integration, document chunking, hybrid search capabilities, and comprehensive search analytics
- June 27, 2025. Fixed three critical issues: 1) Added user/department metadata to document details with uploader information display, 2) Enhanced delete document functionality with improved error handling and logging, 3) Fixed translation system by removing problematic database schema columns and implementing direct OpenAI translation
- June 29, 2025. Enhanced vector database system with intelligent document chunking - documents now split into 3000-character chunks with 300-character overlap, supporting comprehensive content coverage (minimum 3 A4 pages), improved search results with top 3 chunks per document, and added re-indexing capabilities for better chat performance
- June 30, 2025. Enhanced Audit & Monitoring system - added expandable Details column with full JSON view, added "Chat" filter option, and enhanced chat audit logging to capture complete conversation details including user messages and AI responses for comprehensive conversation tracking
- July 1, 2025. Enhanced Create Agent Chatbot page with advanced configuration system - implemented tabbed interface with Overview/Skills/Guardrails sections, added personality customization (Friendly, Professional, Energetic, etc.), profession selection (Sales, HR, IT, etc.), response style options, special skills selection, comprehensive guardrails system inspired by Guardrails AI including content filtering, toxicity prevention, privacy protection, topic control with allowed/blocked topics
- July 3, 2025. Successfully implemented Line OA webhook system with OpenAI integration - Agent Chatbots can now respond to real Line OA messages using GPT-4, fixed database schema issues with social integrations, added webhook endpoints for Line messaging, integrated AI responses with agent configuration and document context
- July 3, 2025. Fixed Line OA webhook user identification system - resolved critical issue where webhook couldn't identify correct user by implementing Bot User ID matching instead of Channel ID, added bot_user_id field to database schema, implemented fallback logic for automatic Bot User ID detection, and added Channel Access Token support for sending replies to Line users
- July 3, 2025. Fixed Agent Chatbot document association bug - resolved database constraint violation in agent_chatbot_documents table by ensuring userId field is properly included when linking documents to agents, and added document count display component to show linked documents for each agent in the Agent Chatbots list
- July 4, 2025. Enhanced Agent Chatbot RAG system and UI improvements - 1) Fixed Line OA webhook to actually use document content in conversations instead of just showing document IDs, implemented proper RAG with document content retrieval and context building, 2) Enhanced Agent Chatbot cards to show actual document names with "...More" overflow instead of just count, 3) Improved Create Agent Chatbot page to display selected document names with individual remove buttons for better UX
- July 7, 2025. Successfully completed functional Agent Console for human agent takeover and conversation management - 1) Created comprehensive Agent Console page with 3-panel layout (user list, conversation timeline, customer profile), 2) Added complete Agent Console API endpoints (/api/agent-console/*) for real-time messaging webhook integration, 3) Integrated with existing Line OA chat history data to display actual user conversations with 21 messages, 4) Fixed critical frontend API response parsing issue with apiRequest function requiring .json() call, 5) Added human takeover functionality with audit logging and conversation handoff capabilities, 6) Implemented channel filtering (Line OA, Facebook, TikTok, Web) and customer profile summaries, 7) Real-time chat display with User messages on left and Chatbot/Agent responses on right side layout
- July 7, 2025. Enhanced Agent Console with multimedia message support - 1) Updated Line OA webhook to handle image and sticker messages with proper metadata storage, 2) Enhanced frontend to display multimedia messages with appropriate icons and metadata information, 3) Added support for image messages showing Message ID and sticker messages showing Package ID and Sticker ID, 4) Improved Line webhook message processing to handle various message types beyond text
- July 7, 2025. Implemented complete Line OA image processing system with GPT-4o Vision - 1) Created LineImageService for downloading images from Line Content API using Channel Access Token, 2) Added GPT-4o Vision integration to analyze uploaded images and extract text/data content in Thai, 3) Enhanced Agent Console to display both images and AI analysis results with proper UI components, 4) Implemented automatic image analysis workflow: download → analyze with GPT-4o → save analysis as system message for AI context, 5) Added comprehensive error handling and static file serving for line-images directory
- July 7, 2025. Enhanced AI Agent's contextual understanding for image-related queries - 1) Added intelligent image query detection using keyword matching in multiple languages, 2) Implemented system message filtering to extract previous image analysis results, 3) Enhanced AI prompt with image context when users ask about previously uploaded images, 4) Added automatic context prioritization for image-related conversations, 5) Enabled AI to reference and answer questions about image content using stored GPT-4o Vision analysis results
- July 7, 2025. Fixed memory limit system for Agent Chatbots to include ALL message types - 1) Enhanced getChatHistory to consider all message_type values (user, assistant, system) within memory limits, 2) Added getChatHistoryWithMemoryStrategy method to properly count system messages containing image analysis, 3) Updated Line OA webhook to use new memory strategy ensuring image analysis context is available for AI responses, 4) Added comprehensive message type breakdown logging for debugging memory usage patterns
- July 7, 2025. Implemented comprehensive WebSocket real-time messaging system - 1) Added WebSocket server in routes.ts on /ws path to avoid Vite HMR conflicts, 2) Created WebSocket client in Agent Console with connection status indicators, 3) Integrated Line OA webhook to broadcast new messages via WebSocket instead of frequent polling, 4) Reduced Agent Console refresh intervals from 2-5 seconds to 10-30 seconds when WebSocket connected, 5) Added real-time message notifications and automatic cache invalidation for instant updates, 6) Eliminated excessive server load from constant API polling while maintaining real-time functionality
- July 7, 2025. Fixed duplicate message issue in Agent Console - 1) Added message ID tracking system in Line OA webhook to prevent duplicate message processing, 2) Implemented processedMessageIds Set with automatic cleanup to maintain memory efficiency, 3) Added skip logic for already processed messages with proper logging, 4) Enhanced with database-level duplicate detection using getRecentChatHistory method, 5) Added 60-second time window check to prevent saving duplicate user messages, 6) Cleaned up existing duplicate messages from database, 7) Fixed WebSocket broadcast issue by ensuring duplicate messages still trigger WebSocket updates for real-time UI, 8) Added test endpoint for WebSocket functionality verification
```

## User Preferences

```
Preferred communication style: Simple, everyday language.
```