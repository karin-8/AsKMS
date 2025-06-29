import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Bot, FileText, MessageSquare, Settings, Plus, X } from "lucide-react";

const createAgentSchema = z.object({
  name: z.string().min(1, "Agent name is required"),
  description: z.string().optional(),
  systemPrompt: z.string().min(10, "System prompt must be at least 10 characters"),
  channels: z.array(z.string()).min(1, "At least one channel is required"),
  lineOaConfig: z.object({
    lineOaId: z.string().optional(),
    lineOaName: z.string().optional(),
  }).optional(),
});

type CreateAgentForm = z.infer<typeof createAgentSchema>;

// Mock LineOA data including 4urney HR
const mockLineOAList = [
  { id: "line-4urney-hr", name: "4urney HR", verified: true },
  { id: "line-customer-support", name: "Customer Support Bot", verified: true },
  { id: "line-sales-assistant", name: "Sales Assistant", verified: false },
  { id: "line-tech-support", name: "Technical Support", verified: true },
  { id: "line-marketing", name: "Marketing Updates", verified: false },
];

const availableChannels = [
  { id: "lineoa", label: "Line OA", icon: MessageSquare },
  { id: "facebook", label: "Facebook Messenger", icon: MessageSquare },
  { id: "tiktok", label: "TikTok", icon: MessageSquare },
];

export default function CreateAgentChatbot() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedDocuments, setSelectedDocuments] = useState<number[]>([]);
  const [selectedLineOA, setSelectedLineOA] = useState<string>("");

  const form = useForm<CreateAgentForm>({
    resolver: zodResolver(createAgentSchema),
    defaultValues: {
      name: "",
      description: "",
      systemPrompt: "You are a helpful AI assistant. Answer questions based on the provided documents and be helpful, friendly, and professional.",
      channels: [],
      lineOaConfig: {},
    },
  });

  // Fetch user's documents
  const { data: documents = [], isLoading: loadingDocuments } = useQuery({
    queryKey: ["/api/documents"],
  });

  // Create agent mutation
  const createAgentMutation = useMutation({
    mutationFn: async (agentData: CreateAgentForm) => {
      const response = await apiRequest("/api/agent-chatbots", {
        method: "POST",
        body: JSON.stringify(agentData),
      });
      return response;
    },
    onSuccess: async (agent) => {
      // Add selected documents to the agent
      for (const documentId of selectedDocuments) {
        try {
          await apiRequest(`/api/agent-chatbots/${agent.id}/documents/${documentId}`, {
            method: "POST",
          });
        } catch (error) {
          console.error("Error adding document to agent:", error);
        }
      }
      
      toast({
        title: "Success",
        description: "Agent chatbot created successfully!",
      });
      
      queryClient.invalidateQueries({ queryKey: ["/api/agent-chatbots"] });
      form.reset();
      setSelectedDocuments([]);
      setSelectedLineOA("");
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to create agent chatbot",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: CreateAgentForm) => {
    // Add LineOA config if LineOA is selected
    if (data.channels.includes("lineoa") && selectedLineOA) {
      const selectedLine = mockLineOAList.find(line => line.id === selectedLineOA);
      data.lineOaConfig = {
        lineOaId: selectedLineOA,
        lineOaName: selectedLine?.name || "",
      };
    }

    createAgentMutation.mutate(data);
  };

  const toggleDocument = (documentId: number) => {
    setSelectedDocuments(prev => 
      prev.includes(documentId)
        ? prev.filter(id => id !== documentId)
        : [...prev, documentId]
    );
  };

  const selectedChannels = form.watch("channels") || [];

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <Bot className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Create Agent Chatbot</h1>
          <p className="text-muted-foreground">Build your custom AI assistant with document knowledge</p>
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
                      <FormLabel>Description (Optional)</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="A helpful assistant for HR-related questions..."
                          rows={3}
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="systemPrompt"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>System Prompt</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="You are a helpful AI assistant..."
                          rows={5}
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Communication Channels */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Communication Channels
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
                        {availableChannels.map((channel) => (
                          <FormField
                            key={channel.id}
                            control={form.control}
                            name="channels"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value?.includes(channel.id)}
                                    onCheckedChange={(checked) => {
                                      const value = field.value || [];
                                      if (checked) {
                                        field.onChange([...value, channel.id]);
                                      } else {
                                        field.onChange(value.filter((v) => v !== channel.id));
                                      }
                                    }}
                                  />
                                </FormControl>
                                <FormLabel className="flex items-center gap-2 font-normal">
                                  <channel.icon className="h-4 w-4" />
                                  {channel.label}
                                </FormLabel>
                              </FormItem>
                            )}
                          />
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* LineOA Configuration */}
                {selectedChannels.includes("lineoa") && (
                  <div className="border rounded-lg p-4 bg-muted/50">
                    <label className="text-sm font-medium mb-2 block">Select Line OA</label>
                    <Select value={selectedLineOA} onValueChange={setSelectedLineOA}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a Line OA account" />
                      </SelectTrigger>
                      <SelectContent>
                        {mockLineOAList.map((lineOA) => (
                          <SelectItem key={lineOA.id} value={lineOA.id}>
                            <div className="flex items-center gap-2">
                              <span>{lineOA.name}</span>
                              {lineOA.verified && (
                                <Badge variant="secondary" className="text-xs">Verified</Badge>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* RAG Documents Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Knowledge Base Documents
                <Badge variant="outline">{selectedDocuments.length} selected</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingDocuments ? (
                <div className="text-center py-4">Loading documents...</div>
              ) : documents.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No documents available. Upload some documents first.
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {documents.map((document: any) => (
                    <div
                      key={document.id}
                      className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                        selectedDocuments.includes(document.id)
                          ? "bg-primary/10 border-primary"
                          : "hover:bg-muted/50"
                      }`}
                      onClick={() => toggleDocument(document.id)}
                    >
                      <Checkbox
                        checked={selectedDocuments.includes(document.id)}
                        onChange={() => {}} // Controlled by parent click
                      />
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{document.name}</p>
                        {document.description && (
                          <p className="text-sm text-muted-foreground truncate">
                            {document.description}
                          </p>
                        )}
                      </div>
                      {document.aiCategory && (
                        <Badge variant="outline" className="text-xs">
                          {document.aiCategory}
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Separator />

          <div className="flex justify-end gap-3">
            <Button 
              type="button" 
              variant="outline"
              onClick={() => {
                form.reset();
                setSelectedDocuments([]);
                setSelectedLineOA("");
              }}
            >
              Reset
            </Button>
            <Button 
              type="submit" 
              disabled={createAgentMutation.isPending}
              className="min-w-32"
            >
              {createAgentMutation.isPending ? (
                <>Creating...</>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Agent
                </>
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}