import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  Bot, 
  Plus, 
  Edit,
  Trash2,
  MessageSquare,
  Settings,
  Calendar,
  Users,
  Power,
  PowerOff
} from "lucide-react";
import { Link } from "wouter";

interface AgentChatbot {
  id: number;
  name: string;
  description?: string;
  systemPrompt: string;
  isActive: boolean;
  channels: string[];
  personality?: string;
  profession?: string;
  responseStyle?: string;
  specialSkills?: string[];
  contentFiltering?: boolean;
  toxicityPrevention?: boolean;
  privacyProtection?: boolean;
  factualAccuracy?: boolean;
  responseLength?: string;
  allowedTopics?: string[];
  blockedTopics?: string[];
  lineOaConfig?: {
    lineOaId?: string;
    lineOaName?: string;
    accessToken?: string;
  };
  facebookConfig?: {
    pageId: string;
    accessToken: string;
  };
  tiktokConfig?: {
    appId: string;
    appSecret: string;
  };
  createdAt: string;
  updatedAt: string;
}

export default function AgentChatbots() {
  const { toast } = useToast();
  const { user, isAuthenticated, isLoading } = useAuth();
  const queryClient = useQueryClient();

  // Redirect to login if not authenticated
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

  // Fetch agent chatbots
  const { data: agents = [], isLoading: isLoadingAgents } = useQuery({
    queryKey: ['/api/agent-chatbots'],
    enabled: isAuthenticated,
    retry: false,
  }) as { data: AgentChatbot[], isLoading: boolean };

  // Delete agent mutation
  const deleteAgentMutation = useMutation({
    mutationFn: async (agentId: number) => {
      return await apiRequest("DELETE", `/api/agent-chatbots/${agentId}`);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Agent chatbot deleted successfully!",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/agent-chatbots'] });
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
        description: "Failed to delete agent chatbot",
        variant: "destructive",
      });
    },
  });

  // Toggle agent status mutation
  const toggleAgentMutation = useMutation({
    mutationFn: async ({ agentId, isActive }: { agentId: number; isActive: boolean }) => {
      return await apiRequest("PUT", `/api/agent-chatbots/${agentId}`, { isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/agent-chatbots'] });
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
        description: "Failed to update agent status",
        variant: "destructive",
      });
    },
  });

  const handleDeleteAgent = (agentId: number) => {
    if (window.confirm("Are you sure you want to delete this agent chatbot?")) {
      deleteAgentMutation.mutate(agentId);
    }
  };

  const handleToggleAgent = (agentId: number, currentStatus: boolean) => {
    toggleAgentMutation.mutate({ agentId, isActive: !currentStatus });
  };

  const getChannelBadges = (channels: string[]) => {
    const channelColors: Record<string, string> = {
      lineoa: "bg-green-100 text-green-800",
      facebook: "bg-blue-100 text-blue-800",
      tiktok: "bg-pink-100 text-pink-800",
    };

    return channels.map((channel) => (
      <Badge
        key={channel}
        variant="secondary"
        className={`text-xs ${channelColors[channel] || "bg-gray-100 text-gray-800"}`}
      >
        {channel === "lineoa" ? "LINE OA" : channel.charAt(0).toUpperCase() + channel.slice(1)}
      </Badge>
    ));
  };

  if (isLoading || isLoadingAgents) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <Sidebar />
      
      <div className="flex-1 flex flex-col">
        <TopBar />
        
        <main className="flex-1 overflow-auto p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-semibold text-slate-800 mb-2">Agent Chatbots</h1>
              <p className="text-sm text-slate-500">
                Manage your AI-powered chatbot agents for different channels
              </p>
            </div>
            <Link href="/create-agent-chatbot">
              <Button className="bg-blue-600 hover:bg-blue-700">
                <Plus className="w-4 h-4 mr-2" />
                Create Agent Chatbot
              </Button>
            </Link>
          </div>

          {/* Agent Cards */}
          {agents.length === 0 ? (
            <div className="text-center py-12">
              <Bot className="w-16 h-16 mx-auto mb-4 text-slate-400" />
              <h3 className="text-lg font-medium text-slate-800 mb-2">No Agent Chatbots Yet</h3>
              <p className="text-sm text-slate-500 mb-6">
                Create your first AI-powered chatbot agent to start automating customer interactions
              </p>
              <Link href="/create-agent-chatbot">
                <Button className="bg-blue-600 hover:bg-blue-700">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Your First Agent
                </Button>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {agents.map((agent) => (
                <Card key={agent.id} className="border border-slate-200 hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-3">
                        <Avatar className="w-10 h-10 bg-blue-100">
                          <AvatarFallback className="text-blue-600">
                            <Bot className="w-5 h-5" />
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <CardTitle className="text-lg font-semibold text-slate-800 line-clamp-1">
                            {agent.name}
                          </CardTitle>
                          <div className="flex items-center space-x-2 mt-1">
                            {agent.isActive ? (
                              <Badge className="bg-green-100 text-green-800 text-xs">
                                <Power className="w-3 h-3 mr-1" />
                                Active
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="bg-gray-100 text-gray-600 text-xs">
                                <PowerOff className="w-3 h-3 mr-1" />
                                Inactive
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleToggleAgent(agent.id, agent.isActive)}
                          className="h-8 w-8 p-0"
                        >
                          {agent.isActive ? (
                            <PowerOff className="w-4 h-4 text-gray-500" />
                          ) : (
                            <Power className="w-4 h-4 text-green-600" />
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0"
                        >
                          <Edit className="w-4 h-4 text-blue-500" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteAgent(agent.id)}
                          className="h-8 w-8 p-0"
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="pt-0">
                    {agent.description && (
                      <p className="text-sm text-slate-600 mb-3 line-clamp-2">
                        {agent.description}
                      </p>
                    )}

                    {/* Personality & Profession */}
                    {(agent.personality || agent.profession) && (
                      <div className="mb-3">
                        <div className="flex flex-wrap gap-2">
                          {agent.personality && (
                            <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">
                              {agent.personality.charAt(0).toUpperCase() + agent.personality.slice(1)}
                            </Badge>
                          )}
                          {agent.profession && (
                            <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                              {agent.profession === 'hr' ? 'HR' : agent.profession === 'it' ? 'IT' : 
                               agent.profession.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            </Badge>
                          )}
                          {agent.responseStyle && (
                            <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                              {agent.responseStyle.charAt(0).toUpperCase() + agent.responseStyle.slice(1)}
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {/* Channels */}
                    <div className="mb-3">
                      <p className="text-xs font-medium text-slate-500 mb-2">Channels:</p>
                      <div className="flex flex-wrap gap-1">
                        {getChannelBadges(agent.channels)}
                      </div>
                    </div>
                    
                    {/* Stats */}
                    <div className="flex items-center justify-between text-xs text-slate-500 pt-3 border-t border-slate-100">
                      <div className="flex items-center space-x-1">
                        <Calendar className="w-3 h-3" />
                        <span>Created {new Date(agent.createdAt).toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <MessageSquare className="w-3 h-3" />
                        <span>0 chats</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}