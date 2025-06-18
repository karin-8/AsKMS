import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useEffect } from "react";
import Sidebar from "@/components/Layout/Sidebar";
import TopBar from "@/components/TopBar";
import DocumentCard from "@/components/DocumentCard";
import ChatModal from "@/components/Chat/ChatModal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  FileText, 
  Search, 
  Filter, 
  Grid3X3, 
  List,
  SortAsc,
  SortDesc,
  Calendar,
  Upload,
  Tag
} from "lucide-react";

export default function Documents() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchType, setSearchType] = useState<"keyword" | "semantic">("keyword");
  const [sortBy, setSortBy] = useState("newest");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterTag, setFilterTag] = useState("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [isChatModalOpen, setIsChatModalOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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

  // Enhanced search with semantic capabilities
  const { data: documents, isLoading: documentsLoading } = useQuery({
    queryKey: ["/api/documents/search", searchQuery, searchType],
    queryFn: async () => {
      if (!searchQuery.trim()) {
        const response = await fetch("/api/documents");
        return await response.json();
      }
      
      const params = new URLSearchParams({
        q: searchQuery,
        type: searchType
      });
      
      const response = await fetch(`/api/documents/search?${params}`);
      return await response.json();
    },
    retry: false,
  }) as { data: Array<any>; isLoading: boolean };

  const { data: categories } = useQuery({
    queryKey: ["/api/categories"],
    retry: false,
  }) as { data: Array<{ id: number; name: string }> | undefined };

  if (isLoading || !isAuthenticated) {
    return null;
  }

  // Get unique AI categories and tags for filtering
  const aiCategories = documents ? Array.from(new Set(documents.map((doc: any) => doc.aiCategory).filter(Boolean))) : [];
  const allTags = documents ? Array.from(new Set(documents.flatMap((doc: any) => doc.tags || []))) : [];

  // Filter and sort documents
  const filteredDocuments = documents ? documents.filter((doc: any) => {
    const matchesCategory = filterCategory === "all" || 
                           doc.aiCategory === filterCategory ||
                           (categories && categories.find((c: any) => c.id === doc.categoryId)?.name === filterCategory);
    const matchesTag = filterTag === "all" || (doc.tags && doc.tags.includes(filterTag));
    
    return matchesCategory && matchesTag;
  }).sort((a: any, b: any) => {
    switch (sortBy) {
      case "newest":
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      case "oldest":
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      case "name":
        return (a.name || a.originalName).localeCompare(b.name || b.originalName);
      case "size":
        return b.fileSize - a.fileSize;
      default:
        return 0;
    }
  }) : [];

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar 
        isMobileOpen={isMobileMenuOpen} 
        onMobileClose={() => setIsMobileMenuOpen(false)}
        onOpenChat={() => setIsChatModalOpen(true)}
      />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar />
        
        <main className="flex-1 overflow-auto p-6">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-semibold text-slate-800 mb-2">My Documents</h1>
            <p className="text-sm text-slate-500">
              Manage and organize your document collection
            </p>
          </div>

          {/* Filters and Search */}
          <Card className="border border-slate-200 mb-6">
            <CardContent className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Search documents..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                
                <Select value={filterCategory} onValueChange={setFilterCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filter by category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories?.map((category: any) => (
                      <SelectItem key={category.id} value={category.name}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">Newest First</SelectItem>
                    <SelectItem value="oldest">Oldest First</SelectItem>
                    <SelectItem value="name">Name</SelectItem>
                    <SelectItem value="size">File Size</SelectItem>
                  </SelectContent>
                </Select>
                
                <div className="flex items-center space-x-2">
                  <Button
                    variant={viewMode === "grid" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setViewMode("grid")}
                  >
                    <Grid className="w-4 h-4" />
                  </Button>
                  <Button
                    variant={viewMode === "list" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setViewMode("list")}
                  >
                    <List className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Documents Grid/List */}
          <Card className="border border-slate-200">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-semibold text-slate-800">
                  Documents ({filteredDocuments?.length || 0})
                </CardTitle>
                <Button 
                  onClick={() => window.location.href = "/upload"}
                  className="bg-primary text-white hover:bg-blue-700"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Documents
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {documentsLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i} className="animate-pulse">
                      <div className="h-32 bg-slate-200 rounded-lg"></div>
                    </div>
                  ))}
                </div>
              ) : filteredDocuments && filteredDocuments.length > 0 ? (
                <div className={
                  viewMode === "grid" 
                    ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
                    : "space-y-2"
                }>
                  {filteredDocuments.map((doc: any) => (
                    <DocumentCard key={doc.id} document={doc} viewMode={viewMode} categories={categories} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-16 text-slate-500">
                  <FileText className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                  <h3 className="text-lg font-medium text-slate-800 mb-2">
                    {searchQuery || filterCategory !== "all" ? "No documents found" : "No documents yet"}
                  </h3>
                  <p className="text-sm text-slate-500 mb-6">
                    {searchQuery || filterCategory !== "all" 
                      ? "Try adjusting your search or filter criteria"
                      : "Upload your first document to get started with AI-powered knowledge management"
                    }
                  </p>
                  <Button 
                    onClick={() => window.location.href = "/upload"}
                    className="bg-primary text-white hover:bg-blue-700"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Upload Documents
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
}
