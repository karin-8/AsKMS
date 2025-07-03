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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { 
  Bot, 
  Settings, 
  MessageSquare, 
  FileText, 
  Check,
  X,
  Search,
  Plus,
  ArrowLeft,
  Brain,
  Shield,
  User,
  Briefcase,
  Heart,
  Zap,
  Target,
  AlertTriangle,
  Info,
  BookOpen,
  Lightbulb
} from "lucide-react";
import { Link } from "wouter";

// Schema for form validation
const createAgentSchema = z.object({
  name: z.string().min(1, "Agent name is required"),
  description: z.string().optional(),
  systemPrompt: z.string().min(1, "System prompt is required"),
  personality: z.string().min(1, "Personality is required"),
  profession: z.string().min(1, "Profession is required"),
  responseStyle: z.string().min(1, "Response style is required"),
  specialSkills: z.array(z.string()).default([]),
  // Guardrails
  contentFiltering: z.boolean().default(true),
  toxicityPrevention: z.boolean().default(true),
  privacyProtection: z.boolean().default(true),
  factualAccuracy: z.boolean().default(true),
  responseLength: z.enum(["short", "medium", "long"]).default("medium"),
  allowedTopics: z.array(z.string()).default([]),
  blockedTopics: z.array(z.string()).default([]),
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
  const [activeTab, setActiveTab] = useState("overview");
  
  // Check if we're editing an existing agent
  const urlParams = new URLSearchParams(window.location.search);
  const editAgentId = urlParams.get('edit');
  const isEditing = !!editAgentId;

  // Form setup
  const form = useForm<CreateAgentForm>({
    resolver: zodResolver(createAgentSchema),
    defaultValues: {
      name: "",
      description: "",
      systemPrompt: "You are a helpful AI assistant. Answer questions based on the provided documents and be polite and professional.",
      personality: "",
      profession: "",
      responseStyle: "",
      specialSkills: [],
      contentFiltering: true,
      toxicityPrevention: true,
      privacyProtection: true,
      factualAccuracy: true,
      responseLength: "medium",
      allowedTopics: [],
      blockedTopics: [],
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

  // Fetch agent data for editing
  const { data: existingAgent, isLoading: isLoadingAgent } = useQuery({
    queryKey: [`/api/agent-chatbots/${editAgentId}`],
    enabled: isAuthenticated && isEditing,
    retry: false,
  });

  // Fetch agent documents for editing
  const { data: agentDocuments = [] } = useQuery({
    queryKey: [`/api/agent-chatbots/${editAgentId}/documents`],
    enabled: isAuthenticated && isEditing,
    retry: false,
  });

  // Load existing agent data into form when editing
  useEffect(() => {
    if (isEditing && existingAgent) {
      const agent = existingAgent as any;
      form.reset({
        name: agent.name || "",
        description: agent.description || "",
        systemPrompt: agent.systemPrompt || "You are a helpful AI assistant. Answer questions based on the provided documents and be polite and professional.",
        personality: agent.personality || "",
        profession: agent.profession || "",
        responseStyle: agent.responseStyle || "",
        specialSkills: agent.specialSkills || [],
        contentFiltering: agent.contentFiltering !== false,
        toxicityPrevention: agent.toxicityPrevention !== false,
        privacyProtection: agent.privacyProtection !== false,
        factualAccuracy: agent.factualAccuracy !== false,
        responseLength: agent.responseLength || "medium",
        allowedTopics: agent.allowedTopics || [],
        blockedTopics: agent.blockedTopics || [],
      });
      
      // Load selected documents
      const docs = agentDocuments as any[];
      if (docs && docs.length > 0) {
        setSelectedDocuments(docs.map((doc: any) => doc.documentId));
      }
    }
  }, [existingAgent, agentDocuments, isEditing, form]);

  // Create/Update agent mutation
  const saveAgentMutation = useMutation({
    mutationFn: async (agentData: CreateAgentForm & { documentIds: number[] }) => {
      if (isEditing) {
        return await apiRequest("PUT", `/api/agent-chatbots/${editAgentId}`, agentData);
      } else {
        return await apiRequest("POST", "/api/agent-chatbots", agentData);
      }
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: isEditing ? "Agent chatbot updated successfully!" : "Agent chatbot created successfully!",
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
        description: isEditing ? "Failed to update agent chatbot" : "Failed to create agent chatbot",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: CreateAgentForm) => {
    saveAgentMutation.mutate({
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

  // Personality options
  const personalityOptions = [
    { id: "friendly", label: "Friendly", description: "Warm, approachable, and conversational", icon: Heart },
    { id: "professional", label: "Professional", description: "Formal, business-like, and authoritative", icon: Briefcase },
    { id: "energetic", label: "Energetic", description: "Enthusiastic, dynamic, and motivating", icon: Zap },
    { id: "empathetic", label: "Empathetic", description: "Understanding, supportive, and compassionate", icon: User },
    { id: "analytical", label: "Analytical", description: "Data-driven, logical, and systematic", icon: Target },
    { id: "creative", label: "Creative", description: "Innovative, imaginative, and inspiring", icon: Lightbulb },
  ];

  // Profession options
  const professionOptions = [
    { id: "sales", label: "Sales Representative", description: "Focused on customer acquisition and relationship building" },
    { id: "analyst", label: "Business Analyst", description: "Data analysis and insights generation" },
    { id: "marketing", label: "Marketing Specialist", description: "Brand promotion and content marketing" },
    { id: "engineer", label: "Software Engineer", description: "Technical problem solving and development" },
    { id: "it", label: "IT Support", description: "Technical assistance and troubleshooting" },
    { id: "hr", label: "HR Representative", description: "Employee relations and policy guidance" },
    { id: "finance", label: "Financial Advisor", description: "Financial planning and advisory services" },
    { id: "customer_service", label: "Customer Service", description: "Customer support and issue resolution" },
  ];

  // Response style options
  const responseStyleOptions = [
    { id: "concise", label: "Concise", description: "Brief and to-the-point responses" },
    { id: "detailed", label: "Detailed", description: "Comprehensive and thorough explanations" },
    { id: "conversational", label: "Conversational", description: "Natural, dialogue-style responses" },
    { id: "educational", label: "Educational", description: "Teaching-focused with examples" },
  ];

  // Special skills options
  const specialSkillsOptions = [
    "Document Analysis", "Data Interpretation", "Problem Solving", "Research", 
    "Technical Writing", "Customer Relations", "Project Management", "Financial Analysis",
    "Risk Assessment", "Quality Assurance", "Training & Development", "Process Optimization"
  ];

  // Guardrails topic suggestions
  const commonTopics = [
    "Company Policies", "HR Guidelines", "Technical Documentation", "Product Information",
    "Customer Support", "Financial Data", "Legal Compliance", "Safety Procedures"
  ];

  const blockedTopicSuggestions = [
    "Personal Financial Information", "Medical Records", "Legal Advice", "Investment Recommendations",
    "Political Opinions", "Religious Views", "Confidential Data", "Competitor Information"
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
          <div className="max-w-6xl mx-auto">
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
                  {isEditing ? "Edit Agent Chatbot" : "Create Agent Chatbot"}
                </h1>
                <p className="text-sm text-slate-500">
                  {isEditing ? "Update your AI-powered chatbot agent configuration" : "Set up your AI-powered chatbot agent with custom prompts and document knowledge"}
                </p>
              </div>
            </div>

            <div className="flex gap-6">
              {/* Left Sidebar - Navigation */}
              <div className="w-64 space-y-2">
                <Button
                  variant={activeTab === "overview" ? "default" : "ghost"}
                  className="w-full justify-start"
                  onClick={() => setActiveTab("overview")}
                >
                  <Settings className="w-4 h-4 mr-2" />
                  Overview
                </Button>
                <Button
                  variant={activeTab === "skills" ? "default" : "ghost"}
                  className="w-full justify-start"
                  onClick={() => setActiveTab("skills")}
                >
                  <Brain className="w-4 h-4 mr-2" />
                  Skills
                </Button>
                <Button
                  variant={activeTab === "guardrails" ? "default" : "ghost"}
                  className="w-full justify-start"
                  onClick={() => setActiveTab("guardrails")}
                >
                  <Shield className="w-4 h-4 mr-2" />
                  Guardrails
                </Button>
              </div>

              {/* Main Content */}
              <div className="flex-1">
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    {activeTab === "overview" && (
                      <div className="space-y-6">
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


                        </div>

                        {/* Personality & Profession */}
                        <Card>
                          <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                              <User className="h-5 w-5" />
                              Agent Personality & Profession
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-6">
                            {/* Personality Selection */}
                            <FormField
                              control={form.control}
                              name="personality"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Bot Personality</FormLabel>
                                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mt-2">
                                    {personalityOptions.map((personality) => {
                                      const IconComponent = personality.icon;
                                      return (
                                        <div
                                          key={personality.id}
                                          className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                                            field.value === personality.id 
                                              ? 'border-blue-500 bg-blue-50' 
                                              : 'border-gray-200 hover:border-gray-300'
                                          }`}
                                          onClick={() => field.onChange(personality.id)}
                                        >
                                          <div className="flex items-center space-x-2 mb-2">
                                            <IconComponent className="w-5 h-5 text-blue-600" />
                                            <span className="font-medium">{personality.label}</span>
                                          </div>
                                          <p className="text-xs text-gray-600">{personality.description}</p>
                                        </div>
                                      );
                                    })}
                                  </div>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            {/* Profession Selection */}
                            <FormField
                              control={form.control}
                              name="profession"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Bot Profession</FormLabel>
                                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                      <SelectTrigger>
                                        <SelectValue placeholder="Choose the bot's professional role" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      {professionOptions.map((profession) => (
                                        <SelectItem key={profession.id} value={profession.id}>
                                          <div className="flex flex-col">
                                            <span className="font-medium">{profession.label}</span>
                                            <span className="text-xs text-gray-500">{profession.description}</span>
                                          </div>
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            {/* Response Style */}
                            <FormField
                              control={form.control}
                              name="responseStyle"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Response Style</FormLabel>
                                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                      <SelectTrigger>
                                        <SelectValue placeholder="How should the bot respond?" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      {responseStyleOptions.map((style) => (
                                        <SelectItem key={style.id} value={style.id}>
                                          <div className="flex flex-col">
                                            <span className="font-medium">{style.label}</span>
                                            <span className="text-xs text-gray-500">{style.description}</span>
                                          </div>
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </CardContent>
                        </Card>

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
                                      placeholder="You are a helpful AI assistant. Answer questions based on the provided documents and be polite and professional."
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
                      </div>
                    )}

                    {activeTab === "skills" && (
                      <div className="space-y-6">
                        {/* Special Skills */}
                        <Card>
                          <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                              <Lightbulb className="h-5 w-5" />
                              Special Skills & Capabilities
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <FormField
                              control={form.control}
                              name="specialSkills"
                              render={() => (
                                <FormItem>
                                  <FormLabel>Select Skills</FormLabel>
                                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 mt-2">
                                    {specialSkillsOptions.map((skill) => (
                                      <FormField
                                        key={skill}
                                        control={form.control}
                                        name="specialSkills"
                                        render={({ field }) => {
                                          return (
                                            <FormItem
                                              key={skill}
                                              className="flex flex-row items-start space-x-3 space-y-0"
                                            >
                                              <FormControl>
                                                <Checkbox
                                                  checked={field.value?.includes(skill)}
                                                  onCheckedChange={(checked) => {
                                                    return checked
                                                      ? field.onChange([...field.value, skill])
                                                      : field.onChange(
                                                          field.value?.filter(
                                                            (value) => value !== skill
                                                          )
                                                        );
                                                  }}
                                                />
                                              </FormControl>
                                              <FormLabel className="text-sm font-normal">
                                                {skill}
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
                          </CardContent>
                        </Card>

                        {/* Knowledge Base (RAG Documents) */}
                        <Card>
                          <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                              <BookOpen className="h-5 w-5" />
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
                      </div>
                    )}

                    {activeTab === "guardrails" && (
                      <div className="space-y-6">
                        {/* Safety & Content Filtering */}
                        <Card>
                          <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                              <Shield className="h-5 w-5" />
                              Safety & Content Filtering
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <FormField
                                control={form.control}
                                name="contentFiltering"
                                render={({ field }) => (
                                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                                    <FormControl>
                                      <Checkbox
                                        checked={field.value}
                                        onCheckedChange={field.onChange}
                                      />
                                    </FormControl>
                                    <div className="space-y-1 leading-none">
                                      <FormLabel>Content Filtering</FormLabel>
                                      <FormDescription>
                                        Filter inappropriate or harmful content automatically
                                      </FormDescription>
                                    </div>
                                  </FormItem>
                                )}
                              />

                              <FormField
                                control={form.control}
                                name="toxicityPrevention"
                                render={({ field }) => (
                                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                                    <FormControl>
                                      <Checkbox
                                        checked={field.value}
                                        onCheckedChange={field.onChange}
                                      />
                                    </FormControl>
                                    <div className="space-y-1 leading-none">
                                      <FormLabel>Toxicity Prevention</FormLabel>
                                      <FormDescription>
                                        Prevent toxic or offensive language in responses
                                      </FormDescription>
                                    </div>
                                  </FormItem>
                                )}
                              />

                              <FormField
                                control={form.control}
                                name="privacyProtection"
                                render={({ field }) => (
                                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                                    <FormControl>
                                      <Checkbox
                                        checked={field.value}
                                        onCheckedChange={field.onChange}
                                      />
                                    </FormControl>
                                    <div className="space-y-1 leading-none">
                                      <FormLabel>Privacy Protection</FormLabel>
                                      <FormDescription>
                                        Protect sensitive personal information in conversations
                                      </FormDescription>
                                    </div>
                                  </FormItem>
                                )}
                              />

                              <FormField
                                control={form.control}
                                name="factualAccuracy"
                                render={({ field }) => (
                                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                                    <FormControl>
                                      <Checkbox
                                        checked={field.value}
                                        onCheckedChange={field.onChange}
                                      />
                                    </FormControl>
                                    <div className="space-y-1 leading-none">
                                      <FormLabel>Factual Accuracy</FormLabel>
                                      <FormDescription>
                                        Verify information accuracy before responding
                                      </FormDescription>
                                    </div>
                                  </FormItem>
                                )}
                              />
                            </div>

                            {/* Response Length Control */}
                            <FormField
                              control={form.control}
                              name="responseLength"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Response Length Control</FormLabel>
                                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                      <SelectTrigger>
                                        <SelectValue placeholder="Choose response length" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      <SelectItem value="short">Short (1-2 sentences)</SelectItem>
                                      <SelectItem value="medium">Medium (3-5 sentences)</SelectItem>
                                      <SelectItem value="long">Long (Detailed explanations)</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </CardContent>
                        </Card>

                        {/* Topic Control */}
                        <Card>
                          <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                              <AlertTriangle className="h-5 w-5" />
                              Topic Control
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              {/* Allowed Topics */}
                              <div>
                                <FormField
                                  control={form.control}
                                  name="allowedTopics"
                                  render={() => (
                                    <FormItem>
                                      <FormLabel className="text-green-700">Allowed Topics</FormLabel>
                                      <FormDescription>Topics the bot can discuss</FormDescription>
                                      <div className="space-y-2 mt-2">
                                        {commonTopics.map((topic) => (
                                          <FormField
                                            key={topic}
                                            control={form.control}
                                            name="allowedTopics"
                                            render={({ field }) => {
                                              return (
                                                <FormItem
                                                  key={topic}
                                                  className="flex flex-row items-start space-x-3 space-y-0"
                                                >
                                                  <FormControl>
                                                    <Checkbox
                                                      checked={field.value?.includes(topic)}
                                                      onCheckedChange={(checked) => {
                                                        return checked
                                                          ? field.onChange([...field.value, topic])
                                                          : field.onChange(
                                                              field.value?.filter(
                                                                (value) => value !== topic
                                                              )
                                                            );
                                                      }}
                                                    />
                                                  </FormControl>
                                                  <FormLabel className="text-sm font-normal text-green-700">
                                                    {topic}
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
                              </div>

                              {/* Blocked Topics */}
                              <div>
                                <FormField
                                  control={form.control}
                                  name="blockedTopics"
                                  render={() => (
                                    <FormItem>
                                      <FormLabel className="text-red-700">Blocked Topics</FormLabel>
                                      <FormDescription>Topics the bot should avoid</FormDescription>
                                      <div className="space-y-2 mt-2">
                                        {blockedTopicSuggestions.map((topic) => (
                                          <FormField
                                            key={topic}
                                            control={form.control}
                                            name="blockedTopics"
                                            render={({ field }) => {
                                              return (
                                                <FormItem
                                                  key={topic}
                                                  className="flex flex-row items-start space-x-3 space-y-0"
                                                >
                                                  <FormControl>
                                                    <Checkbox
                                                      checked={field.value?.includes(topic)}
                                                      onCheckedChange={(checked) => {
                                                        return checked
                                                          ? field.onChange([...field.value, topic])
                                                          : field.onChange(
                                                              field.value?.filter(
                                                                (value) => value !== topic
                                                              )
                                                            );
                                                      }}
                                                    />
                                                  </FormControl>
                                                  <FormLabel className="text-sm font-normal text-red-700">
                                                    {topic}
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
                              </div>
                            </div>
                          </CardContent>
                        </Card>

                        {/* Guardrails Information */}
                        <Card className="border-blue-200 bg-blue-50">
                          <CardContent className="pt-6">
                            <div className="flex items-start space-x-3">
                              <Info className="w-5 h-5 text-blue-600 mt-0.5" />
                              <div>
                                <h4 className="font-medium text-blue-900">About Guardrails</h4>
                                <p className="text-sm text-blue-700 mt-1">
                                  Guardrails help ensure your AI agent behaves safely and appropriately. 
                                  These settings are inspired by <a href="https://www.guardrailsai.com/" target="_blank" rel="noopener noreferrer" className="underline">Guardrails AI</a> best practices 
                                  for responsible AI deployment.
                                </p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    )}

                    {/* Submit Button - Always visible */}
                    <div className="flex justify-end space-x-4 pt-6 border-t">
                      <Link href="/agent-chatbots">
                        <Button type="button" variant="outline">
                          Cancel
                        </Button>
                      </Link>
                      <Button 
                        type="submit" 
                        disabled={saveAgentMutation.isPending}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        {saveAgentMutation.isPending ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                            {isEditing ? "Updating..." : "Creating..."}
                          </>
                        ) : (
                          <>
                            <Plus className="w-4 h-4 mr-2" />
                            {isEditing ? "Update Agent" : "Create Agent"}
                          </>
                        )}
                      </Button>
                    </div>
                  </form>
                </Form>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}