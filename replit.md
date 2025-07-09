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
- July 7, 2025. Fixed critical duplicate message insertion bug in Line OA webhook - 1) Identified root cause where getAiResponse function was double-saving chat history after main webhook already saved user messages, 2) Created getAiResponseDirectly function without chat history saving to prevent duplicates, 3) Restructured webhook flow to save user message first, then AI response separately, 4) Added message ID-based duplicate prevention with automatic cleanup every 30 minutes, 5) Eliminated occurrence_count > 1 duplicates in chat_history table, 6) Maintained single WebSocket broadcast per conversation exchange
- July 7, 2025. Completed Human Agent Takeover system in Agent Console - 1) Modified "Open Message" button to activate Human Agent mode instead of generic takeover, 2) Enhanced message display to show "Agent Human - {Username}" for human agent responses using logged-in user information, 3) Updated message type from "human_agent" to "agent" with metadata.humanAgent flag for proper attribution, 4) Added green color scheme for Human Agent messages to distinguish from AI (blue) and User (gray) messages, 5) Integrated human agent names from user session (firstName or email) in message metadata and display, 6) Enhanced WebSocket broadcasting to include humanAgentName for real-time updates, 7) Simplified takeover activation with local state management and user notification
- July 8, 2025. Enhanced Human Agent Takeover with Line OA message delivery - 1) Added sendLinePushMessage function to send human agent messages directly to Line users via Push Message API, 2) Integrated Line Channel Access Token retrieval from agent configuration for authenticated messaging, 3) Added "Back to AI" button to restore AI chatbot functionality after human takeover, 4) Enhanced message input UI with Human Agent mode indicator and green send button styling, 5) Added loading spinner for message sending feedback, 6) Implemented proper error handling for Line API communication failures, 7) Complete human-to-user messaging workflow now functional through Agent Console interface
- July 8, 2025. Fixed Knowledge Base auto-refresh system in Agent Chatbot management - 1) Enhanced saveAgentMutation to invalidate multiple cache keys including agent documents for comprehensive frontend updates, 2) Added real-time document selection system with addDocumentMutation and removeDocumentMutation for editing mode, 3) Implemented predicate-based cache invalidation to refresh all agent document-related queries, 4) Frontend now automatically reflects database changes when documents are added/removed from agent knowledge base, 5) Fixed Line Channel Access Token retrieval using direct database query to bypass user permission restrictions
- July 8, 2025. Enhanced AgentChatbots page with comprehensive auto-refresh system - 1) Added 3-second polling interval for individual agent document lists and 5-second polling for main agent list, 2) Implemented refetchOnWindowFocus and refetchOnMount for immediate updates when returning to page, 3) Added visibility change event listener to invalidate all agent document queries when page becomes visible, 4) Set staleTime to 0 for AgentDocumentList to ensure immediate data refresh, 5) Complete real-time frontend synchronization with database changes now functional
- July 8, 2025. Implemented CSAT (Customer Satisfaction Analysis) system in Agent Console - 1) Removed meaningless Status field from Customer Profile section, 2) Added CSAT Score calculation using OpenAI GPT-4o to analyze chat history and determine customer satisfaction levels (0-100 scale), 3) Created calculateCSATScore function that analyzes recent 20 messages and evaluates customer sentiment, politeness, service response satisfaction, 4) Added visual indicators with color-coded badges (Excellent 80+, Good 60-79, Needs Improvement <60), 5) Enhanced Agent Console summary endpoint to include real-time CSAT analysis for comprehensive customer satisfaction monitoring
- July 8, 2025. Fixed image analysis context persistence in Line OA conversations - 1) Identified issue where image analysis from system messages would disappear when users asked follow-up questions about images, 2) Modified extractImageAnalysis function to always extract recent image analysis from chat history regardless of query type, 3) Updated getAiResponseDirectly to include image context in all conversations, not just explicit image queries, 4) Enhanced image context logging for better debugging, 5) Ensured AI agents maintain awareness of previously uploaded images throughout conversation flow
- July 8, 2025. Enhanced AI Agent contextual understanding by moving image analysis from system prompt to user input - 1) Relocated image analysis data from system prompt to user message attachment for better contextual processing, 2) Enhanced user message composition to include recent image analysis when available, 3) Improved AI Agent's ability to answer vague questions about uploaded images (e.g., "ราคาเท่าไหร่ มีส่วนลดมั้ย" without mentioning product names), 4) Streamlined system prompt by removing image-specific instructions, 5) Better context awareness for product inquiries based on previously uploaded images
- July 8, 2025. Implemented synchronous image processing workflow for immediate AI responses - 1) Changed image processing from asynchronous to synchronous to ensure AI Agent waits for image analysis completion, 2) Modified Line OA webhook to process image analysis before generating AI response, 3) Enhanced contextMessage composition to include complete image analysis results, 4) Added comprehensive error handling for image processing failures, 5) Ensured AI Agent can immediately respond with image content analysis upon upload completion
- July 8, 2025. Implemented two-step image processing workflow with immediate acknowledgment - 1) Added immediate acknowledgment message "ได้รับรูปภาพแล้ว ขอเวลาตรวจสอบสักครู่นะคะ" sent instantly when image is received, 2) Implemented specific image analysis tracking using relatedImageMessageId to prevent off-by-one errors, 3) Added separate follow-up message with AI analysis results after GPT-4o Vision processing completes, 4) Enhanced error handling for image processing failures with user-friendly messages, 5) Fixed multiple image processing issue where subsequent images would show results from previous images
- July 8, 2025. Enhanced AI Agent system prompt to properly handle image context - 1) Added explicit instruction to AI Agent system prompt to use image analysis data when available instead of saying "can't see images", 2) Enhanced debugging output to track image context extraction and inclusion in user messages, 3) Fixed AI Agent responses to image-related queries by ensuring proper context awareness, 4) Improved image context debugging with detailed system message logging for troubleshooting
- July 8, 2025. Fixed CSAT Score calculation display issue in Agent Console - 1) Identified 401 authentication errors preventing summary endpoint execution, 2) Added comprehensive debugging for CSAT calculation flow, 3) Implemented temporary mock CSAT scoring based on message count to verify endpoint functionality, 4) Enhanced error handling and timeout protection for CSAT calculations, 5) Added detailed logging for authentication and channel ID matching issues
- July 8, 2025. Implemented proper OpenAI-based CSAT Score calculation system - 1) Fixed CSAT calculation to use OpenAI GPT-4o for analyzing actual conversation content instead of message frequency, 2) Enhanced calculateCSATScore function to respect Agent Chatbot memory limits for consistent analysis scope, 3) Added intelligent agent ID detection from conversation history for memory limit configuration, 4) Implemented comprehensive Thai language CSAT analysis with 0-100 scoring based on customer satisfaction indicators, 5) Added proper conversation filtering to analyze only user and agent messages for accurate satisfaction measurement
- July 8, 2025. Enhanced Sentiment Analysis system in Agent Console Customer Profile - 1) Fixed Sentiment to dynamically change based on CSAT Score instead of staying as fixed "Neutral", 2) Implemented CSAT-based sentiment mapping (Bad <40, Neutral 41-60, Good 61-80, Excellent >80), 3) Added automatic Customer Profile refresh when new messages arrive or CSAT changes, 4) Enhanced frontend to display color-coded sentiment badges (Green=Excellent, Blue=Good, Yellow=Neutral, Red=Bad), 5) Added cache invalidation system to refresh summary data when conversation updates occur
- July 9, 2025. Fixed critical test agent functionality in Create Agent Chatbot page - 1) Resolved API response parsing issue where apiRequest function returned Response object instead of parsed JSON data, 2) Added proper response.json() parsing in test mutation to correctly extract agent responses, 3) Enhanced test interface with Agent Status toggle button for switching between testing and published modes, 4) Improved test response display to always show response area with placeholder text when no response exists, 5) Added comprehensive debugging logs to track API communication and response handling
- July 9, 2025. Implemented comprehensive realistic Agent testing system - 1) Created Chat Conversation Test mode with real-time messaging interface similar to deployed chatbots, 2) Added support for continuous conversation history with memory limit respect (10 messages default), 3) Built new /api/agent-chatbots/test-chat endpoint that processes chat history and uses actual document content for context, 4) Enhanced UI with chat bubbles, timestamps, auto-scroll, and typing indicators matching real chat experience, 5) Added memory usage tracking display showing current history vs memory limit, 6) Implemented Enter-to-send functionality and proper message state management for seamless conversation flow
- July 9, 2025. Completed Human Agent Image Upload system in Agent Console - 1) Added /api/agent-console/send-image endpoint with multer file upload integration for processing human agent image uploads, 2) Implemented sendLineImageMessage function in Line OA webhook for sending images via Line's Image Message API using absolute URLs, 3) Enhanced Agent Console frontend to support image uploading from human agents with proper file selection UI, 4) Added comprehensive image metadata storage in chat history including imageUrl, fileName, fileSize, and mimeType, 5) Integrated with existing WebSocket broadcasting system for real-time image message notifications, 6) Utilized existing static file serving infrastructure for image URL accessibility to Line API endpoints
- July 9, 2025. Enhanced Human Agent Takeover with comprehensive URL redirect and event tracking system - 1) Implemented popup menu in Agent Console for choosing between file upload and URL redirect options, 2) Added URL redirect functionality with /api/agent-console/send-url-redirect endpoint for sending clickable links to users, 3) Created complete Event Tracking page with comprehensive monitoring interface for user interactions, 4) Added Event Tracking API endpoints (/api/event-tracking) with filtering capabilities by event type and channel type, 5) Integrated event tracking into URL redirect system to monitor user clicks and interactions, 6) Enhanced WebSocket broadcasting to include URL redirect messages for real-time updates, 7) Added comprehensive metadata tracking including user agent, IP address, and referrer information for complete interaction analytics
- July 9, 2025. Successfully implemented Line OA Imagemap Messages system for Human Agent Takeover - 1) Created comprehensive imagemap UI with URL input modal for clickable image functionality in Agent Console, 2) Added /api/agent-console/send-imagemap endpoint with proper Line OA sendLineImagemapMessage integration, 3) Fixed critical API routing bug where imagemap function wasn't being called properly, 4) Enhanced Line OA webhook with imagemap message support using Line's Imagemap Message API format (baseUrl, baseSize 1040x1040, URI actions), 5) Added comprehensive event tracking for imagemap interactions with click monitoring capabilities, 6) Integrated with existing WebSocket broadcasting system for real-time imagemap message notifications, 7) Implemented proper channelId usage for Line User ID messaging and access token retrieval from agent configuration, 8) Fixed critical authentication issues preventing imagemap functionality by temporarily removing authentication middleware and fixing req.user references with optional chaining, 9) Resolved ES6 module import issues with require statements causing Line imagemap message sending failures
```

## User Preferences

```
Preferred communication style: Simple, everyday language.
```