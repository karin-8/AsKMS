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
- **Semantic Search**: Vector similarity search across document content
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
```

## User Preferences

```
Preferred communication style: Simple, everyday language.
```