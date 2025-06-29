import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { 
  Bot, 
  Settings, 
  MessageSquare, 
  FileText, 
  Check,
  X,
  Search,
  Plus,
  ArrowLeft
} from "lucide-react";
import { Link } from "wouter";

// Schema for form validation
const createAgentSchema = z.object({
  name: z.string().min(1, "Agent name is required"),
  description: z.string().optional(),
  systemPrompt: z.string().min(1, "System prompt is required"),
  channels: z.array(z.string()).min(1, "At least one channel is required"),
  lineOaChannelId: z.string().optional(),
});

type CreateAgentForm = z.infer<typeof createAgentSchema>;

interface Document {
  id: number;
  name: string;
  description?: string;
  summary?: string;
  categoryName?: string;
}

export default function CreateAgentChatbot() {
  const { toast } = useToast();
  const { user, isAuthenticated, isLoading } = useAuth();
  const queryClient = useQueryClient();
  
  const [selectedDocuments, setSelectedDocuments] = useState<number[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  // Form setup
  const form = useForm<CreateAgentForm>({
    resolver: zodResolver(createAgentSchema),
    defaultValues: {
      name: "",
      description: "",
      systemPrompt: "You are a helpful AI assistant. Answer questions based on the provided documents and be polite and professional.",
      channels: [],
      lineOaChannelId: "",
    },
  });

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

  // Fetch documents for RAG selection
  const { data: documents = [] } = useQuery({
    queryKey: ['/api/documents'],
    enabled: isAuthenticated,
    retry: false,
  }) as { data: Document[] };

  // Create agent mutation
  const createAgentMutation = useMutation({
    mutationFn: async (agentData: CreateAgentForm & { documentIds: number[] }) => {
      return await apiRequest("POST", "/api/agent-chatbots", agentData);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Agent chatbot created successfully!",
      });
      // Clear form and navigate back
      form.reset();
      setSelectedDocuments([]);
      queryClient.invalidateQueries({ queryKey: ['/api/agent-chatbots'] });
      window.history.back();
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
        description: "Failed to create agent chatbot",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: CreateAgentForm) => {
    createAgentMutation.mutate({
      ...data,
      documentIds: selectedDocuments,
    });
  };

  const toggleDocument = (documentId: number) => {
    setSelectedDocuments(prev => 
      prev.includes(documentId) 
        ? prev.filter(id => id !== documentId)
        : [...prev, documentId]
    );
  };

  const filteredDocuments = documents.filter(doc => 
    doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    doc.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Mock LineOA channels
  const lineOaChannels = [
    { id: "U1234567890", name: "4urney HR", description: "HR Support Channel" },
    { id: "U0987654321", name: "Customer Support", description: "General Support" },
    { id: "U1122334455", name: "Sales Inquiry", description: "Sales Team Channel" },
  ];

  if (isLoading) {
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
          <div className="max-w-4xl mx-auto">
            {/* Header */}
            <div className="flex items-center gap-4 mb-6">
              <Link href="/agent-chatbots">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Agents
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-semibold text-slate-800 mb-2">
                  Create Agent Chatbot
                </h1>
                <p className="text-sm text-slate-500">
                  Set up your AI-powered chatbot agent with custom prompts and document knowledge
                </p>
              </div>
            </div>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Basic Information */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Settings className="h-5 w-5" />
                        Basic Information
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Agent Name</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="HR Assistant Bot" 
                                {...field} 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="description"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Description</FormLabel>
                            <FormControl>
                              <Textarea 
                                placeholder="Brief description of what this agent does"
                                className="min-h-[80px]"
                                {...field} 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </CardContent>
                  </Card>

                  {/* Channel Selection */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <MessageSquare className="h-5 w-5" />
                        Channel Selection
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <FormField
                        control={form.control}
                        name="channels"
                        render={() => (
                          <FormItem>
                            <FormLabel>Select Channels</FormLabel>
                            <div className="space-y-3">
                              {[
                                { id: "lineoa", label: "LINE Official Account", color: "green" },
                                { id: "facebook", label: "Facebook Messenger", color: "blue" },
                                { id: "tiktok", label: "TikTok", color: "pink" },
                              ].map((channel) => (
                                <FormField
                                  key={channel.id}
                                  control={form.control}
                                  name="channels"
                                  render={({ field }) => {
                                    return (
                                      <FormItem
                                        key={channel.id}
                                        className="flex flex-row items-start space-x-3 space-y-0"
                                      >
                                        <FormControl>
                                          <Checkbox
                                            checked={field.value?.includes(channel.id)}
                                            onCheckedChange={(checked) => {
                                              return checked
                                                ? field.onChange([...field.value, channel.id])
                                                : field.onChange(
                                                    field.value?.filter(
                                                      (value) => value !== channel.id
                                                    )
                                                  );
                                            }}
                                          />
                                        </FormControl>
                                        <FormLabel className="text-sm font-normal">
                                          {channel.label}
                                        </FormLabel>
                                      </FormItem>
                                    );
                                  }}
                                />
                              ))}
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* LINE OA Channel Selection */}
                      {form.watch("channels")?.includes("lineoa") && (
                        <FormField
                          control={form.control}
                          name="lineOaChannelId"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>LINE OA Channel</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select a LINE OA channel" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {lineOaChannels.map((channel) => (
                                    <SelectItem key={channel.id} value={channel.id}>
                                      <div className="flex flex-col">
                                        <span className="font-medium">{channel.name}</span>
                                        <span className="text-xs text-slate-500">{channel.description}</span>
                                      </div>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* System Prompt */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Bot className="h-5 w-5" />
                      AI System Prompt
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <FormField
                      control={form.control}
                      name="systemPrompt"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>System Prompt</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="Define how your AI agent should behave and respond..."
                              className="min-h-[120px]"
                              {...field} 
                            />
                          </FormControl>
                          <FormDescription>
                            This prompt defines your agent's personality, behavior, and how it should respond to users.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>

                {/* Document Selection for RAG */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      Knowledge Base (RAG Documents)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {/* Search */}
                      <div className="relative">
                        <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                        <Input
                          placeholder="Search documents..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-10"
                        />
                      </div>

                      {/* Selected Documents Count */}
                      {selectedDocuments.length > 0 && (
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                            {selectedDocuments.length} documents selected
                          </Badge>
                        </div>
                      )}

                      {/* Documents List */}
                      <div className="max-h-64 overflow-y-auto space-y-2 border rounded-lg p-3">
                        {filteredDocuments.length === 0 ? (
                          <div className="text-center py-4 text-slate-500">
                            <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                            <p>No documents found</p>
                          </div>
                        ) : (
                          filteredDocuments.map((doc) => (
                            <div
                              key={doc.id}
                              className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-colors ${
                                selectedDocuments.includes(doc.id)
                                  ? "bg-blue-50 border-blue-200"
                                  : "bg-white hover:bg-slate-50"
                              }`}
                              onClick={() => toggleDocument(doc.id)}
                            >
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <h4 className="font-medium text-slate-800">{doc.name}</h4>
                                  {doc.categoryName && (
                                    <Badge variant="outline" className="text-xs">
                                      {doc.categoryName}
                                    </Badge>
                                  )}
                                </div>
                                {doc.description && (
                                  <p className="text-sm text-slate-500 mt-1 line-clamp-2">
                                    {doc.description}
                                  </p>
                                )}
                              </div>
                              <div className="ml-3">
                                {selectedDocuments.includes(doc.id) ? (
                                  <div className="w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center">
                                    <Check className="w-3 h-3 text-white" />
                                  </div>
                                ) : (
                                  <div className="w-5 h-5 border-2 border-slate-300 rounded-full" />
                                )}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Submit Button */}
                <div className="flex justify-end space-x-4">
                  <Link href="/agent-chatbots">
                    <Button type="button" variant="outline">
                      Cancel
                    </Button>
                  </Link>
                  <Button 
                    type="submit" 
                    disabled={createAgentMutation.isPending}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {createAgentMutation.isPending ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Creating...
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4 mr-2" />
                        Create Agent
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </div>
        </main>
      </div>
    </div>
  );
}