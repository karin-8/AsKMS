import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { 
  FileText, 
  MoreHorizontal, 
  Download, 
  Share, 
  Trash2,
  Eye,
  Database,
  FilePen,
  FileSpreadsheet,
  FileImage,
  File,
  CheckCircle,
  Clock,
  XCircle,
  AlertCircle,
  BookOpen,
  Hash,
  Star,
  StarOff
} from "lucide-react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";

interface DocumentCardProps {
  document: {
    id: number;
    name: string;
    originalName?: string;
    fileName: string;
    fileType?: string;
    mimeType: string;
    fileSize: number;
    status?: string;
    createdAt: string;
    categoryId?: number;
    categoryName?: string;
    aiCategory?: string;
    aiCategoryColor?: string;
    isInVectorDb?: boolean;
    tags?: string[];
    summary?: string;
  };
  viewMode?: "grid" | "list";
  categories?: Array<{ id: number; name: string; color: string; icon: string }>;
}

export default function DocumentCard({ document, viewMode = "grid", categories }: DocumentCardProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showSummary, setShowSummary] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);

  // Fetch document summary when needed
  const { data: summaryData, isLoading: summaryLoading } = useQuery({
    queryKey: ["/api/documents", document.id, "summary"],
    enabled: showSummary,
    retry: false,
  });

  const getFileIcon = (mimeType: string) => {
    if (mimeType.includes('pdf')) return FilePen;
    if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return FileSpreadsheet;
    if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return FileText;
    if (mimeType.includes('image')) return FileImage;
    return FileText;
  };

  const getFileIconColor = (mimeType: string) => {
    if (mimeType.includes('pdf')) return 'text-red-500 bg-red-50';
    if (mimeType.includes('word')) return 'text-blue-500 bg-blue-50';
    if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return 'text-green-500 bg-green-50';
    if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return 'text-orange-500 bg-orange-50';
    if (mimeType.includes('image')) return 'text-purple-500 bg-purple-50';
    return 'text-slate-500 bg-slate-50';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'processed':
        return <CheckCircle className="w-3 h-3 text-emerald-500" />;
      case 'processing':
        return <Clock className="w-3 h-3 text-amber-500 animate-pulse" />;
      case 'failed':
        return <XCircle className="w-3 h-3 text-red-500" />;
      case 'pending':
        return <AlertCircle className="w-3 h-3 text-blue-500" />;
      default:
        return <Clock className="w-3 h-3 text-slate-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'processed':
        return <Badge className="bg-emerald-100 text-emerald-800">Processed</Badge>;
      case 'processing':
        return <Badge className="bg-amber-100 text-amber-800">Processing</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      case 'pending':
        return <Badge className="bg-blue-100 text-blue-800">Pending</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 1) {
      return `${Math.floor(diffInHours * 60)} minutes ago`;
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)} hours ago`;
    } else if (diffInHours < 48) {
      return '1 day ago';
    } else {
      return `${Math.floor(diffInHours / 24)} days ago`;
    }
  };

  const addToVectorMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('PUT', `/api/documents/${document.id}/vector`);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
      toast({
        title: "Added to Vector Database",
        description: "Document is now available for semantic search and AI queries.",
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
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteDocumentMutation = useMutation({
    mutationFn: async () => {
      await apiRequest('DELETE', `/api/documents/${document.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      toast({
        title: "Document Deleted",
        description: "Document has been permanently deleted.",
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
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const FileIcon = getFileIcon(document.mimeType || '');
  const iconColorClass = getFileIconColor(document.mimeType || '');

  if (viewMode === "list") {
    return (
      <div className="flex items-center space-x-4 p-4 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-colors">
        <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", iconColorClass)}>
          <FileIcon className="w-5 h-5" />
        </div>
        
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-800 truncate">
            {document.name || document.originalName}
          </p>
          <div className="flex items-center space-x-4 mt-1">
            <span className="text-xs text-slate-500">{formatDate(document.createdAt)}</span>
            <span className="text-xs text-slate-500">{formatFileSize(document.fileSize)}</span>
            <div className="flex items-center space-x-2">
              {/* AI Category with color */}
              {document.aiCategory && (
                <Badge 
                  variant="secondary" 
                  className="text-xs"
                  style={{ 
                    backgroundColor: document.aiCategoryColor + '20',
                    color: document.aiCategoryColor,
                    borderColor: document.aiCategoryColor + '40'
                  }}
                >
                  {document.aiCategory}
                </Badge>
              )}
              
              {/* Manual Category */}
              {document.categoryId && categories && (
                (() => {
                  const category = categories.find(c => c.id === document.categoryId);
                  return category ? (
                    <Badge variant="outline" className="text-xs">
                      {category.name}
                    </Badge>
                  ) : null;
                })()
              )}
              
              {/* AI Tags */}
              {document.tags && document.tags.length > 0 && (
                <div className="flex items-center space-x-1">
                  {document.tags.slice(0, 2).map((tag, index) => (
                    <Badge key={index} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                  {document.tags.length > 2 && (
                    <span className="text-xs text-slate-500">+{document.tags.length - 2}</span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1">
            {getStatusIcon(document.status || 'pending')}
            <span className="text-xs text-slate-600 capitalize">{document.status || 'pending'}</span>
          </div>
          
          {document.isInVectorDb && (
            <Badge variant="outline" className="text-xs">
              <Database className="w-3 h-3 mr-1" />
              Vector DB
            </Badge>
          )}
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>
                <Eye className="mr-2 h-4 w-4" />
                View Details
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Download className="mr-2 h-4 w-4" />
                Download
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Share className="mr-2 h-4 w-4" />
                Share
              </DropdownMenuItem>
              {!document.isInVectorDb && document.status === 'processed' && (
                <DropdownMenuItem 
                  onClick={() => addToVectorMutation.mutate()}
                  disabled={addToVectorMutation.isPending}
                >
                  <Database className="mr-2 h-4 w-4" />
                  Add to Vector DB
                </DropdownMenuItem>
              )}
              <DropdownMenuItem 
                className="text-red-600"
                onClick={() => deleteDocumentMutation.mutate()}
                disabled={deleteDocumentMutation.isPending}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    );
  }

  return (
    <Card className="border border-slate-200 hover:border-slate-300 transition-colors cursor-pointer group">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", iconColorClass)}>
            <FileIcon className="w-5 h-5" />
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>
                <Eye className="mr-2 h-4 w-4" />
                View Details
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Download className="mr-2 h-4 w-4" />
                Download
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Share className="mr-2 h-4 w-4" />
                Share
              </DropdownMenuItem>
              {!document.isInVectorDb && document.status === 'processed' && (
                <DropdownMenuItem 
                  onClick={() => addToVectorMutation.mutate()}
                  disabled={addToVectorMutation.isPending}
                >
                  <Database className="mr-2 h-4 w-4" />
                  Add to Vector DB
                </DropdownMenuItem>
              )}
              <DropdownMenuItem 
                className="text-red-600"
                onClick={() => deleteDocumentMutation.mutate()}
                disabled={deleteDocumentMutation.isPending}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        
        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-800 truncate" title={document.name || document.originalName}>
            {document.name || document.originalName}
          </p>
          
          <div className="flex items-center justify-between">
            {getStatusBadge(document.status || 'processed')}
            {document.isInVectorDb && (
              <Badge variant="outline" className="text-xs">
                <Database className="w-3 h-3 mr-1" />
                Vector
              </Badge>
            )}
          </div>
          
          <div className="flex items-center space-x-4 text-xs text-slate-500">
            <span>{formatDate(document.createdAt)}</span>
            <span>{formatFileSize(document.fileSize)}</span>
          </div>
          
          <div className="space-y-2">
            {/* AI Category with color */}
            {document.aiCategory && (
              <div className="flex items-center gap-1">
                <Badge 
                  variant="secondary" 
                  className="text-xs font-medium"
                  style={{ 
                    backgroundColor: document.aiCategoryColor + '20',
                    color: document.aiCategoryColor,
                    borderColor: document.aiCategoryColor + '40'
                  }}
                >
                  {document.aiCategory}
                </Badge>
                {document.summary && (
                  <span className="text-xs text-slate-400 truncate" title={document.summary}>
                    - {document.summary.substring(0, 40)}...
                  </span>
                )}
              </div>
            )}
            
            {/* Manual Category */}
            {document.categoryId && categories && (
              <div className="flex items-center gap-1">
                {(() => {
                  const category = categories.find(c => c.id === document.categoryId);
                  return category ? (
                    <Badge variant="outline" className="text-xs">
                      {category.name}
                    </Badge>
                  ) : null;
                })()}
              </div>
            )}
            
            {/* AI Generated Tags */}
            {document.tags && document.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {document.tags.slice(0, 3).map((tag, index) => (
                  <Badge key={index} variant="outline" className="text-xs">
                    {tag}
                  </Badge>
                ))}
                {document.tags.length > 3 && (
                  <Badge variant="outline" className="text-xs">
                    +{document.tags.length - 3}
                  </Badge>
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
