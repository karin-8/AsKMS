import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  FileText, 
  Upload, 
  MoreVertical, 
  Eye, 
  Download,
  Star,
  Trash2
} from "lucide-react";
import Sidebar from "@/components/Layout/Sidebar";
import TopBar from "@/components/TopBar";
import StatsCards from "@/components/Stats/StatsCards";
import CategoryStatsCards from "@/components/Stats/CategoryStatsCards";
import UploadZone from "@/components/Upload/UploadZone";
import ChatModal from "@/components/Chat/ChatModal";
import { apiRequest } from "@/lib/queryClient";

interface UploadFile {
  file: File;
  id: string;
  status: 'uploading' | 'processing' | 'completed' | 'error';
  progress: number;
  error?: string;
}

export default function Dashboard() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isChatModalOpen, setIsChatModalOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [uploadFiles, setUploadFiles] = useState<UploadFile[]>([]);
  const [selectedDocumentSummary, setSelectedDocumentSummary] = useState<string | null>(null);

  const { data: documents = [] } = useQuery({
    queryKey: ["/api/documents"],
    enabled: isAuthenticated,
  }) as { data: Array<any> };

  const { data: stats } = useQuery({
    queryKey: ["/api/stats"],
    enabled: isAuthenticated,
  }) as { data: { totalDocuments: number } | undefined };

  // Upload mutation with progress tracking
  const uploadMutation = useMutation({
    mutationFn: async (files: File[]) => {
      const formData = new FormData();
      files.forEach(file => formData.append('files', file));
      
      // Initialize upload tracking
      const fileTracking = files.map(file => ({
        file,
        id: Math.random().toString(36).substr(2, 9),
        status: 'uploading' as const,
        progress: 0
      }));
      setUploadFiles(fileTracking);

      // Simulate progress updates
      fileTracking.forEach((fileTrack, index) => {
        let progress = 0;
        const interval = setInterval(() => {
          progress += Math.random() * 20;
          if (progress >= 90) {
            setUploadFiles(prev => prev.map(f => 
              f.id === fileTrack.id ? { ...f, status: 'processing', progress: 90 } : f
            ));
            clearInterval(interval);
          } else {
            setUploadFiles(prev => prev.map(f => 
              f.id === fileTrack.id ? { ...f, progress } : f
            ));
          }
        }, 500);
      });

      const response = await fetch("/api/documents/upload", {
        method: "POST",
        body: formData,
      });

      // Mark as completed
      setUploadFiles(prev => prev.map(f => ({ ...f, status: 'completed', progress: 100 })));
      
      // Clear after 3 seconds
      setTimeout(() => setUploadFiles([]), 3000);
      
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({
        title: "Upload successful",
        description: "Documents have been uploaded and processed with AI classification.",
      });
    },
    onError: (error: Error) => {
      setUploadFiles(prev => prev.map(f => ({ ...f, status: 'error', error: error.message })));
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Content summary mutation
  const summaryMutation = useMutation({
    mutationFn: async (documentId: number) => {
      const response = await fetch(`/api/documents/${documentId}/summary`);
      const data = await response.json();
      return data;
    },
    onSuccess: (data: { summary: string }) => {
      setSelectedDocumentSummary(data.summary);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to generate summary",
        description: error.message,
        variant: "destructive",
      });
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

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  const recentDocuments = Array.isArray(documents) ? documents.slice(0, 5) : [];

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar 
        isMobileOpen={isMobileMenuOpen} 
        onMobileClose={() => setIsMobileMenuOpen(false)}
        onOpenChat={() => setIsChatModalOpen(true)}
      />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar />
        
        <main className="p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            <StatsCards />
            
            {/* Upload Section */}
            <div className="grid lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Upload className="w-5 h-5" />
                    <span>Upload Documents</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <UploadZone onUploadComplete={() => {}} />
                  
                  {/* Upload Progress */}
                  {uploadFiles.length > 0 && (
                    <div className="mt-4 space-y-3">
                      <Separator />
                      <h4 className="text-sm font-medium">Upload Progress</h4>
                      {uploadFiles.map((file) => (
                        <div key={file.id} className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="truncate">{file.file.name}</span>
                            <Badge variant={
                              file.status === 'completed' ? 'default' :
                              file.status === 'error' ? 'destructive' :
                              'secondary'
                            }>
                              {file.status}
                            </Badge>
                          </div>
                          <Progress value={file.progress} className="h-2" />
                          {file.error && (
                            <p className="text-xs text-red-600">{file.error}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Recent Documents */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <FileText className="w-5 h-5" />
                    <span>Recent Documents</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {recentDocuments.length === 0 ? (
                      <p className="text-gray-500 text-center py-4">No documents uploaded yet</p>
                    ) : (
                      recentDocuments.map((doc: any) => (
                        <div key={doc.id} className="flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:bg-gray-50">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {doc.name}
                            </p>
                            <div className="flex items-center space-x-2 mt-1">
                              {doc.aiCategory && (
                                <Badge 
                                  variant="secondary" 
                                  className="text-xs"
                                  style={{ 
                                    backgroundColor: doc.aiCategoryColor + '20',
                                    color: doc.aiCategoryColor,
                                    borderColor: doc.aiCategoryColor + '40'
                                  }}
                                >
                                  {doc.aiCategory}
                                </Badge>
                              )}
                              <span className="text-xs text-gray-500">
                                {new Date(doc.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                          
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => summaryMutation.mutate(doc.id)}>
                                <Eye className="w-4 h-4 mr-2" />
                                Content Summary
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <Download className="w-4 h-4 mr-2" />
                                Download
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <Star className="w-4 h-4 mr-2" />
                                Add to Favorites
                              </DropdownMenuItem>
                              <DropdownMenuItem className="text-red-600">
                                <Trash2 className="w-4 h-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Content Summary Modal */}
            {selectedDocumentSummary && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                <Card className="max-w-2xl w-full max-h-96 overflow-auto">
                  <CardHeader>
                    <CardTitle>Content Summary</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-700 whitespace-pre-wrap">{selectedDocumentSummary}</p>
                    <div className="mt-4 flex justify-end">
                      <Button onClick={() => setSelectedDocumentSummary(null)}>
                        Close
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </main>
      </div>

      <ChatModal 
        isOpen={isChatModalOpen} 
        onClose={() => setIsChatModalOpen(false)} 
      />
    </div>
  );
}
