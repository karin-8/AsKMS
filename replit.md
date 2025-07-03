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
```

## User Preferences

```
Preferred communication style: Simple, everyday language.
```