import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  MessageSquare, 
  Send, 
  User, 
  Phone, 
  Mail, 
  Filter,
  Clock,
  MessageCircle,
  Bot,
  UserCheck,
  Circle,
  Hash,
  ExternalLink,
  Image as ImageIcon,
  File as FileIcon
} from "lucide-react";
import { format, isValid, parseISO } from "date-fns";

interface ChatUser {
  userId: string;
  channelType: string;
  channelId: string;
  agentId: number;
  agentName: string;
  lastMessage: string;
  lastMessageAt: Date;
  messageCount: number;
  isOnline: boolean;
  userProfile?: {
    name?: string;
    email?: string;
    phone?: string;
  };
}

interface ConversationMessage {
  id: number;
  messageType: 'user' | 'assistant' | 'human_agent';
  content: string;
  createdAt: Date;
  metadata?: any;
}

interface ConversationSummary {
  totalMessages: number;
  firstContactAt: Date;
  lastActiveAt: Date;
  sentiment: 'positive' | 'neutral' | 'negative';
  mainTopics: string[];
  resolutionStatus: 'open' | 'resolved' | 'pending';
}

// Helper function to safely format dates
const safeFormatDate = (dateStr: string | null | undefined, formatStr: string = "MMM dd, HH:mm"): string => {
  if (!dateStr) return "N/A";
  
  try {
    const date = typeof dateStr === 'string' ? parseISO(dateStr) : new Date(dateStr);
    if (isValid(date)) {
      return format(date, formatStr);
    }
  } catch (error) {
    console.warn("Date formatting error:", error, dateStr);
  }
  
  return "Invalid Date";
};

export default function AgentConsole() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // State management
  const [selectedUser, setSelectedUser] = useState<ChatUser | null>(null);
  const [channelFilter, setChannelFilter] = useState<string>("all");
  const [messageInput, setMessageInput] = useState("");
  const [isHumanTakeover, setIsHumanTakeover] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Authentication check
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  // Query for active chat users
  const { data: chatUsers = [], isLoading: isLoadingUsers } = useQuery({
    queryKey: ["/api/agent-console/users", channelFilter],
    enabled: isAuthenticated,
    refetchInterval: 5000, // Refresh every 5 seconds
    retry: false,
  });

  // Query for conversation messages
  const { data: conversationMessages = [], isLoading: isLoadingMessages } = useQuery({
    queryKey: ["/api/agent-console/conversation", selectedUser?.userId, selectedUser?.channelType, selectedUser?.channelId, selectedUser?.agentId],
    queryFn: async () => {
      if (!selectedUser) return [];
      const params = new URLSearchParams({
        userId: selectedUser.userId,
        channelType: selectedUser.channelType,
        channelId: selectedUser.channelId,
        agentId: selectedUser.agentId.toString(),
      });
      try {
        const response = await apiRequest("GET", `/api/agent-console/conversation?${params}`);
        const result = await response.json();
        return Array.isArray(result) ? result : [];
      } catch (error) {
        console.error("❌ Agent Console: API error:", error);
        return [];
      }
    },
    enabled: isAuthenticated && !!selectedUser,
    refetchInterval: 2000, // Refresh every 2 seconds for real-time updates
    retry: false,
  });

  // Auto-select first user if none selected
  useEffect(() => {
    if (chatUsers.length > 0 && !selectedUser) {
      console.log("🎯 Agent Console: Auto-selecting first user:", chatUsers[0]);
      setSelectedUser(chatUsers[0]);
    }
  }, [chatUsers, selectedUser]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [conversationMessages]);

  // Query for conversation summary
  const { data: conversationSummary } = useQuery({
    queryKey: ["/api/agent-console/summary", selectedUser?.userId, selectedUser?.channelType, selectedUser?.channelId],
    queryFn: async () => {
      if (!selectedUser) return null;
      const params = new URLSearchParams({
        userId: selectedUser.userId,
        channelType: selectedUser.channelType,
        channelId: selectedUser.channelId,
      });
      console.log("📊 Agent Console: Fetching summary with params:", {
        userId: selectedUser.userId,
        channelType: selectedUser.channelType,
        channelId: selectedUser.channelId
      });
      const result = await apiRequest("GET", `/api/agent-console/summary?${params}`);
      console.log("📊 Agent Console: Summary API response:", result);
      return result;
    },
    enabled: isAuthenticated && !!selectedUser,
    retry: false,
  });

  // Mutation for sending human agent message
  const sendMessageMutation = useMutation({
    mutationFn: async ({ message }: { message: string }) => {
      if (!selectedUser) throw new Error("No user selected");
      
      return await apiRequest("POST", "/api/agent-console/send-message", {
        userId: selectedUser.userId,
        channelType: selectedUser.channelType,
        channelId: selectedUser.channelId,
        agentId: selectedUser.agentId,
        message,
        messageType: "human_agent",
      });
    },
    onSuccess: () => {
      setMessageInput("");
      queryClient.invalidateQueries({ 
        queryKey: ["/api/agent-console/conversation", selectedUser?.userId, selectedUser?.channelType, selectedUser?.channelId, selectedUser?.agentId] 
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Mutation for taking over conversation
  const takeoverMutation = useMutation({
    mutationFn: async () => {
      if (!selectedUser) throw new Error("No user selected");
      
      return await apiRequest("POST", "/api/agent-console/takeover", {
        userId: selectedUser.userId,
        channelType: selectedUser.channelType,
        channelId: selectedUser.channelId,
        agentId: selectedUser.agentId,
      });
    },
    onSuccess: () => {
      setIsHumanTakeover(true);
      toast({
        title: "Takeover Activated",
        description: "You are now handling this conversation manually.",
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      
      toast({
        title: "Error",
        description: "Failed to take over conversation. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversationMessages]);

  const handleSendMessage = () => {
    if (!messageInput.trim() || !selectedUser) return;
    sendMessageMutation.mutate({ message: messageInput });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const getChannelIcon = (channelType: string) => {
    switch (channelType) {
      case "lineoa":
        return <MessageCircle className="w-4 h-4 text-green-600" />;
      case "facebook":
        return <MessageSquare className="w-4 h-4 text-blue-600" />;
      case "tiktok":
        return <Hash className="w-4 h-4 text-pink-600" />;
      case "web":
        return <ExternalLink className="w-4 h-4 text-gray-600" />;
      default:
        return <MessageSquare className="w-4 h-4" />;
    }
  };

  const getChannelBadge = (channelType: string) => {
    const variants = {
      lineoa: "bg-green-100 text-green-800",
      facebook: "bg-blue-100 text-blue-800",
      tiktok: "bg-pink-100 text-pink-800",
      web: "bg-gray-100 text-gray-800",
    };
    
    return variants[channelType as keyof typeof variants] || "bg-gray-100 text-gray-800";
  };

  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="flex">
          <Sidebar />
          <div className="flex-1">
            <TopBar />
            <main className="p-6">
              <div className="text-center py-8">Loading...</div>
            </main>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="flex">
        <Sidebar />
        <div className="flex-1">
          <TopBar />
          <main className="p-6">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <UserCheck className="w-6 h-6" />
                  <h1 className="text-2xl font-bold">Agent Console</h1>
                </div>
                <Badge variant="outline" className="px-3 py-1">
                  {chatUsers.length} Active Conversations
                </Badge>
              </div>

              <div className="grid grid-cols-12 gap-6 h-[calc(100vh-200px)]">
                {/* Left Panel - User List */}
                <Card className="col-span-3">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">Active Users</CardTitle>
                      <Filter className="w-4 h-4 text-gray-500" />
                    </div>
                    <div className="pt-2">
                      <Select value={channelFilter} onValueChange={setChannelFilter}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Filter by channel" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Channels</SelectItem>
                          <SelectItem value="lineoa">Line OA</SelectItem>
                          <SelectItem value="facebook">Facebook</SelectItem>
                          <SelectItem value="tiktok">TikTok</SelectItem>
                          <SelectItem value="web">Web Widget</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <ScrollArea className="h-[500px]">
                      <div className="space-y-1 p-3">
                        {isLoadingUsers ? (
                          <div className="text-center py-4 text-gray-500">Loading users...</div>
                        ) : chatUsers.length === 0 ? (
                          <div className="text-center py-4 text-gray-500">No active conversations</div>
                        ) : (
                          chatUsers.map((chatUser: ChatUser) => (
                            <div
                              key={`${chatUser.userId}-${chatUser.channelType}-${chatUser.channelId}`}
                              className={`p-3 rounded-lg cursor-pointer transition-colors hover:bg-gray-50 ${
                                selectedUser?.userId === chatUser.userId &&
                                selectedUser?.channelType === chatUser.channelType &&
                                selectedUser?.channelId === chatUser.channelId
                                  ? "bg-blue-50 border border-blue-200"
                                  : "border border-transparent"
                              }`}
                              onClick={() => {
                                console.log("👤 Agent Console: User selected:", chatUser);
                                setSelectedUser(chatUser);
                              }}
                            >
                              <div className="flex items-start space-x-3">
                                <div className="relative">
                                  <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                                    <User className="w-5 h-5 text-gray-600" />
                                  </div>
                                  {chatUser.isOnline && (
                                    <Circle className="absolute -bottom-1 -right-1 w-3 h-3 fill-green-500 text-green-500" />
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between">
                                    <p className="text-sm font-medium text-gray-900 truncate">
                                      {chatUser.userProfile?.name || `User ${chatUser.userId.slice(-4)}`}
                                    </p>
                                    <div className="flex items-center space-x-1">
                                      {getChannelIcon(chatUser.channelType)}
                                    </div>
                                  </div>
                                  <div className="flex items-center justify-between mt-1">
                                    <p className="text-xs text-gray-500 truncate max-w-[100px]">
                                      {chatUser.lastMessage}
                                    </p>
                                    <span className="text-xs text-gray-400">
                                      {safeFormatDate(chatUser.lastMessageAt, "HH:mm")}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between mt-2">
                                    <span className={`inline-flex px-2 py-1 text-xs rounded-full ${getChannelBadge(chatUser.channelType)}`}>
                                      {chatUser.channelType.toUpperCase()}
                                    </span>
                                    <Badge variant="secondary" className="text-xs">
                                      {chatUser.messageCount} msgs
                                    </Badge>
                                  </div>
                                  <div className="mt-1">
                                    <p className="text-xs text-gray-400">
                                      Agent: {chatUser.agentName}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>

                {/* Center Panel - Conversation */}
                <Card className="col-span-6">
                  <CardHeader className="pb-3">
                    {selectedUser ? (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                            <User className="w-4 h-4 text-gray-600" />
                          </div>
                          <div>
                            <CardTitle className="text-lg">
                              {selectedUser.userProfile?.name || `User ${selectedUser.userId.slice(-4)}`}
                            </CardTitle>
                            <CardDescription>
                              {selectedUser.channelType.toUpperCase()} • Agent: {selectedUser.agentName}
                            </CardDescription>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          {!isHumanTakeover && (
                            <Button
                              size="sm"
                              onClick={() => takeoverMutation.mutate()}
                              disabled={takeoverMutation.isPending}
                            >
                              <UserCheck className="w-4 h-4 mr-2" />
                              Open Message
                            </Button>
                          )}
                          {isHumanTakeover && (
                            <Badge variant="destructive">Human Agent Active</Badge>
                          )}
                        </div>
                      </div>
                    ) : (
                      <CardTitle className="text-lg">Select a conversation</CardTitle>
                    )}
                  </CardHeader>
                  <CardContent className="p-0">
                    {selectedUser ? (
                      <div className="flex flex-col h-[500px]">
                        {/* Messages Area */}
                        <ScrollArea className="flex-1 p-4">
                          <div className="space-y-4">
                            {isLoadingMessages ? (
                              <div className="text-center py-4 text-gray-500">Loading messages...</div>
                            ) : !Array.isArray(conversationMessages) || conversationMessages.length === 0 ? (
                              <div className="text-center py-4 text-gray-500">
                                {!Array.isArray(conversationMessages) ? "Error loading messages" : "No messages yet"}
                              </div>
                            ) : (
                              conversationMessages.map((message: ConversationMessage) => (
                                <div
                                  key={message.id}
                                  className={`flex ${
                                    message.messageType === "user" ? "justify-start" : "justify-end"
                                  }`}
                                >
                                  <div
                                    className={`max-w-[70%] rounded-lg px-4 py-2 ${
                                      message.messageType === "user"
                                        ? "bg-gray-100 text-gray-900"
                                        : message.messageType === "human_agent"
                                        ? "bg-green-500 text-white"
                                        : "bg-blue-500 text-white"
                                    }`}
                                  >
                                    <div className="flex items-center space-x-2 mb-1">
                                      {message.messageType === "user" && <User className="w-3 h-3" />}
                                      {message.messageType === "assistant" && <Bot className="w-3 h-3" />}
                                      {message.messageType === "human_agent" && <UserCheck className="w-3 h-3" />}
                                      <span className="text-xs opacity-75">
                                        {message.messageType === "user" ? "User" : 
                                         message.messageType === "human_agent" ? "Human Agent" : "AI Agent"}
                                      </span>
                                    </div>
                                    {/* Render message content based on type */}
                                    {message.metadata?.messageType === 'image_analysis' ? (
                                      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                                        <div className="flex items-center space-x-2 mb-2">
                                          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                          <span className="text-sm font-semibold text-blue-700 dark:text-blue-300">การวิเคราะห์รูปภาพด้วย AI</span>
                                        </div>
                                        <p className="text-sm text-blue-800 dark:text-blue-200 whitespace-pre-wrap">{message.content.replace('[การวิเคราะห์รูปภาพ] ', '')}</p>
                                      </div>
                                    ) : message.metadata?.messageType === 'image' ? (
                                      <div className="space-y-2">
                                        <div className="flex items-center space-x-2">
                                          <ImageIcon className="w-4 h-4" />
                                          <span className="text-sm font-semibold">รูปภาพ</span>
                                        </div>
                                        {message.metadata.originalContentUrl ? (
                                          <a href={message.metadata.originalContentUrl} target="_blank" rel="noopener noreferrer" className="block mt-2">
                                            <img
                                              src={message.metadata.previewImageUrl || message.metadata.originalContentUrl}
                                              alt="User sent image"
                                              className="max-w-48 max-h-48 rounded-lg shadow-md object-cover cursor-pointer"
                                              onError={(e) => { 
                                                console.log('Image load error:', e.currentTarget.src);
                                                e.currentTarget.style.display = 'none';
                                                e.currentTarget.nextElementSibling?.classList.remove('hidden');
                                              }}
                                            />
                                            <div className="hidden bg-yellow-100 border border-yellow-400 text-yellow-700 px-3 py-2 rounded text-sm">
                                              ไม่สามารถโหลดรูปภาพได้ - กรุณาตรวจสอบ URL หรือสิทธิ์การเข้าถึง
                                            </div>
                                          </a>
                                        ) : (
                                          <div className="bg-gray-200 dark:bg-gray-700 p-2 rounded text-xs space-y-1">
                                            <div className="flex items-center space-x-2">
                                              <ImageIcon className="w-3 h-3" />
                                              <span>รูปภาพจาก Line OA</span>
                                            </div>
                                            {message.metadata.messageId && (
                                              <div className="text-gray-500">Message ID: {message.metadata.messageId}</div>
                                            )}
                                            <div className="text-xs text-gray-400">
                                              (ไม่สามารถแสดงรูปภาพ - ต้องการ Line Content API)
                                            </div>
                                          </div>
                                        )}
                                        {message.metadata.imageAnalysis && (
                                          <div className="mt-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                                            <div className="flex items-center space-x-2 mb-2">
                                              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                              <span className="text-xs font-semibold text-blue-700 dark:text-blue-300">การวิเคราะห์รูปภาพด้วย AI</span>
                                            </div>
                                            <p className="text-xs text-blue-800 dark:text-blue-200 whitespace-pre-wrap">{message.metadata.imageAnalysis}</p>
                                          </div>
                                        )}
                                        {message.content && <p className="text-sm whitespace-pre-wrap mt-2">{message.content}</p>}
                                      </div>
                                    ) : message.metadata?.messageType === 'sticker' ? (
                                      <div className="space-y-2">
                                        <div className="flex items-center space-x-2">
                                          <span className="text-lg">😀</span>
                                          <span className="text-sm font-semibold">สติ๊กเกอร์</span>
                                        </div>
                                        {message.metadata.packageId && message.metadata.stickerId ? (
                                          <img
                                            src={`https://stickershop.line-scdn.net/stickershop/v1/sticker/${message.metadata.stickerId}/android/sticker.png`}
                                            alt="Line Sticker"
                                            className="w-24 h-24 object-contain"
                                            onError={(e) => { e.currentTarget.src = 'https://via.placeholder.com/100?text=Sticker+Error'; }}
                                          />
                                        ) : (
                                          <div className="bg-gray-200 dark:bg-gray-700 p-2 rounded text-xs">
                                            Package: {message.metadata.packageId}<br/>
                                            Sticker: {message.metadata.stickerId}
                                          </div>
                                        )}
                                        {message.content && <p className="text-sm whitespace-pre-wrap mt-2">{message.content}</p>}
                                      </div>
                                    ) : message.metadata?.messageType && message.metadata.messageType !== 'text' ? (
                                      <div className="space-y-2">
                                        <div className="flex items-center space-x-2">
                                          <FileIcon className="w-4 h-4" />
                                          <span className="text-sm font-semibold">{message.metadata.messageType.charAt(0).toUpperCase() + message.metadata.messageType.slice(1)}</span>
                                        </div>
                                        {message.metadata.originalContentUrl && (
                                          <a href={message.metadata.originalContentUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline">
                                            เปิดไฟล์ {message.metadata.messageType}
                                          </a>
                                        )}
                                        <p className="text-sm whitespace-pre-wrap mt-2">{message.content}</p>
                                      </div>
                                    ) : (
                                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                                    )}
                                    <p className="text-xs opacity-75 mt-1">
                                      {safeFormatDate(message.createdAt, "HH:mm")}
                                    </p>
                                  </div>
                                </div>
                              ))
                            )}
                            <div ref={messagesEndRef} />
                          </div>
                        </ScrollArea>

                        {/* Message Input */}
                        {isHumanTakeover && (
                          <div className="border-t p-4">
                            <div className="flex space-x-2">
                              <Textarea
                                placeholder="Type your message..."
                                value={messageInput}
                                onChange={(e) => setMessageInput(e.target.value)}
                                onKeyPress={handleKeyPress}
                                className="flex-1 resize-none"
                                rows={2}
                              />
                              <Button
                                onClick={handleSendMessage}
                                disabled={!messageInput.trim() || sendMessageMutation.isPending}
                              >
                                <Send className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="h-[500px] flex items-center justify-center text-gray-500">
                        Select a user to view conversation
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Right Panel - Customer Profile & Summary */}
                <Card className="col-span-3">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Customer Profile</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {selectedUser ? (
                      <div className="space-y-6">
                        {/* User Profile */}
                        <div className="space-y-3">
                          <h4 className="font-semibold text-sm">Contact Information</h4>
                          <div className="space-y-2">
                            <div className="flex items-center space-x-2">
                              <User className="w-4 h-4 text-gray-500" />
                              <span className="text-sm">
                                {selectedUser.userProfile?.name || `User ${selectedUser.userId.slice(-4)}`}
                              </span>
                            </div>
                            {selectedUser.userProfile?.email && (
                              <div className="flex items-center space-x-2">
                                <Mail className="w-4 h-4 text-gray-500" />
                                <span className="text-sm">{selectedUser.userProfile.email}</span>
                              </div>
                            )}
                            {selectedUser.userProfile?.phone && (
                              <div className="flex items-center space-x-2">
                                <Phone className="w-4 h-4 text-gray-500" />
                                <span className="text-sm">{selectedUser.userProfile.phone}</span>
                              </div>
                            )}
                            <div className="flex items-center space-x-2">
                              <MessageSquare className="w-4 h-4 text-gray-500" />
                              <span className="text-sm">ID: {selectedUser.userId}</span>
                            </div>
                          </div>
                        </div>

                        {/* Conversation Summary */}
                        {conversationSummary && (
                          <div className="space-y-3">
                            <h4 className="font-semibold text-sm">Conversation Summary</h4>
                            <div className="space-y-2">
                              <div className="flex justify-between">
                                <span className="text-sm text-gray-600">Total Messages:</span>
                                <span className="text-sm font-medium">{conversationSummary.totalMessages}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-sm text-gray-600">First Contact:</span>
                                <span className="text-sm font-medium">
                                  {safeFormatDate(conversationSummary?.firstContactAt, "MMM dd")}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-sm text-gray-600">Last Active:</span>
                                <span className="text-sm font-medium">
                                  {safeFormatDate(conversationSummary?.lastActiveAt, "MMM dd, HH:mm")}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-sm text-gray-600">Status:</span>
                                <Badge variant={
                                  conversationSummary.resolutionStatus === "resolved" ? "default" :
                                  conversationSummary.resolutionStatus === "pending" ? "secondary" : "destructive"
                                }>
                                  {conversationSummary.resolutionStatus}
                                </Badge>
                              </div>
                              {conversationSummary.sentiment && (
                                <div className="flex justify-between">
                                  <span className="text-sm text-gray-600">Sentiment:</span>
                                  <Badge variant={
                                    conversationSummary.sentiment === "positive" ? "default" :
                                    conversationSummary.sentiment === "neutral" ? "secondary" : "destructive"
                                  }>
                                    {conversationSummary.sentiment}
                                  </Badge>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Main Topics */}
                        {conversationSummary?.mainTopics && conversationSummary.mainTopics.length > 0 && (
                          <div className="space-y-3">
                            <h4 className="font-semibold text-sm">Main Topics</h4>
                            <div className="flex flex-wrap gap-1">
                              {conversationSummary.mainTopics.map((topic, index) => (
                                <Badge key={index} variant="outline" className="text-xs">
                                  {topic}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Agent Information */}
                        <div className="space-y-3">
                          <h4 className="font-semibold text-sm">Agent Details</h4>
                          <div className="space-y-2">
                            <div className="flex items-center space-x-2">
                              <Bot className="w-4 h-4 text-gray-500" />
                              <span className="text-sm">{selectedUser.agentName}</span>
                            </div>
                            <div className="flex items-center space-x-2">
                              <span className={`inline-flex px-2 py-1 text-xs rounded-full ${getChannelBadge(selectedUser.channelType)}`}>
                                {selectedUser.channelType.toUpperCase()}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        Select a conversation to view customer profile
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}