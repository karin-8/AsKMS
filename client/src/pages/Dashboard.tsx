import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";
import DocumentCard from "@/components/DocumentCard";
import AIAssistant from "@/components/AIAssistant";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  FileText, 
  Clock, 
  MessageSquare, 
  Users, 
  TrendingUp, 
  ChartLine,
  FilePen,
  Cog,
  BellRing,
  ClipboardList,
  FlaskRound,
  File,
  CloudUpload,
  Plus
} from "lucide-react";

export default function Dashboard() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();

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

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["/api/dashboard/stats"],
    retry: false,
  });

  const { data: documents, isLoading: documentsLoading } = useQuery({
    queryKey: ["/api/documents"],
    retry: false,
  });

  if (isLoading || !isAuthenticated) {
    return null;
  }

  const getCategoryIcon = (category: string) => {
    const iconMap: Record<string, any> = {
      financial: ChartLine,
      legal: FilePen,
      technical: Cog,
      hr: Users,
      marketing: BellRing,
      operations: ClipboardList,
      research: FlaskRound,
      other: File,
    };
    
    return iconMap[category?.toLowerCase()] || File;
  };

  const getCategoryColor = (category: string) => {
    const colorMap: Record<string, string> = {
      financial: "bg-blue-100 text-blue-800",
      legal: "bg-green-100 text-green-800",
      technical: "bg-yellow-100 text-yellow-800",
      hr: "bg-purple-100 text-purple-800",
      marketing: "bg-red-100 text-red-800",
      operations: "bg-cyan-100 text-cyan-800",
      research: "bg-lime-100 text-lime-800",
      other: "bg-gray-100 text-gray-800",
    };
    
    return colorMap[category?.toLowerCase()] || "bg-gray-100 text-gray-800";
  };

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar />
        
        <main className="flex-1 overflow-auto p-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <Card className="border border-slate-200">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500">Total Documents</p>
                    <p className="text-2xl font-semibold text-slate-800 mt-1">
                      {statsLoading ? "..." : (stats?.totalDocuments || 0)}
                    </p>
                    <p className="text-xs text-emerald-600 mt-1 flex items-center">
                      <TrendingUp className="w-3 h-3 mr-1" />
                      Active collection
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center">
                    <FileText className="w-6 h-6 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-slate-200">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500">Processing Queue</p>
                    <p className="text-2xl font-semibold text-slate-800 mt-1">
                      {statsLoading ? "..." : (stats?.processingQueue || 0)}
                    </p>
                    <p className="text-xs text-amber-600 mt-1 flex items-center">
                      <Clock className="w-3 h-3 mr-1" />
                      Being processed
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-amber-50 rounded-lg flex items-center justify-center">
                    <Clock className="w-6 h-6 text-amber-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-slate-200">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500">AI Queries Today</p>
                    <p className="text-2xl font-semibold text-slate-800 mt-1">
                      {statsLoading ? "..." : (stats?.aiQueries || 0)}
                    </p>
                    <p className="text-xs text-emerald-600 mt-1 flex items-center">
                      <TrendingUp className="w-3 h-3 mr-1" />
                      Knowledge queries
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-emerald-50 rounded-lg flex items-center justify-center">
                    <MessageSquare className="w-6 h-6 text-emerald-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-slate-200">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500">Active Users</p>
                    <p className="text-2xl font-semibold text-slate-800 mt-1">
                      {statsLoading ? "..." : (stats?.activeUsers || 0)}
                    </p>
                    <p className="text-xs text-slate-500 mt-1 flex items-center">
                      <Users className="w-3 h-3 mr-1" />
                      Online now
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-purple-50 rounded-lg flex items-center justify-center">
                    <Users className="w-6 h-6 text-purple-500" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Recent Documents */}
            <div className="lg:col-span-2">
              <Card className="border border-slate-200">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-semibold text-slate-800">
                      Recent Documents
                    </CardTitle>
                    <Button variant="ghost" size="sm" className="text-primary hover:text-blue-700">
                      View All
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {documentsLoading ? (
                      <div className="space-y-3">
                        {[1, 2, 3].map((i) => (
                          <div key={i} className="animate-pulse">
                            <div className="h-16 bg-slate-200 rounded-lg"></div>
                          </div>
                        ))}
                      </div>
                    ) : documents && documents.length > 0 ? (
                      documents.slice(0, 5).map((doc: any) => (
                        <DocumentCard key={doc.id} document={doc} />
                      ))
                    ) : (
                      <div className="text-center py-8 text-slate-500">
                        <FileText className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                        <p>No documents yet. Upload your first document to get started!</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* AI Assistant Panel */}
            <div className="lg:col-span-1">
              <AIAssistant />
            </div>
          </div>

          {/* Document Categories Overview */}
          <div className="mt-8">
            <Card className="border border-slate-200">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-slate-800">
                  Document Categories
                </CardTitle>
                <p className="text-sm text-slate-500">
                  Auto-classified document distribution
                </p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {statsLoading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="animate-pulse">
                        <div className="h-24 bg-slate-200 rounded-lg"></div>
                      </div>
                    ))
                  ) : stats?.categoryCounts && stats.categoryCounts.length > 0 ? (
                    stats.categoryCounts.map((category: any) => {
                      const IconComponent = getCategoryIcon(category.categoryName);
                      return (
                        <div
                          key={category.categoryId}
                          className="text-center p-4 rounded-lg border-2 border-dashed border-slate-200 hover:border-primary hover:bg-blue-50 transition-colors cursor-pointer"
                        >
                          <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                            <IconComponent className="w-6 h-6 text-primary" />
                          </div>
                          <p className="text-sm font-medium text-slate-800">
                            {category.categoryName}
                          </p>
                          <p className="text-2xl font-bold text-slate-800 mt-1">
                            {category.count}
                          </p>
                          <p className="text-xs text-slate-500">
                            {((category.count / (stats?.totalDocuments || 1)) * 100).toFixed(0)}% of total
                          </p>
                        </div>
                      );
                    })
                  ) : (
                    <div className="col-span-full text-center py-8 text-slate-500">
                      <ChartLine className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                      <p>No categories yet. Upload documents to see classification.</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Quick Upload Area */}
          <div className="mt-8 bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-dashed border-blue-200 rounded-xl p-8 text-center">
            <div className="max-w-md mx-auto">
              <div className="w-16 h-16 bg-primary rounded-xl flex items-center justify-center mx-auto mb-4">
                <CloudUpload className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-slate-800 mb-2">Quick Upload</h3>
              <p className="text-sm text-slate-600 mb-4">
                Drag and drop files here, or click to browse. Auto-classification and tagging will begin immediately.
              </p>
              <div className="flex items-center justify-center space-x-4">
                <Button 
                  className="bg-primary text-white hover:bg-blue-700"
                  onClick={() => window.location.href = "/upload"}
                >
                  Choose Files
                </Button>
                <span className="text-sm text-slate-500">or</span>
                <Button 
                  variant="ghost" 
                  className="text-primary hover:text-blue-700"
                  onClick={() => window.location.href = "/upload"}
                >
                  Bulk Upload Tool
                </Button>
              </div>
              <p className="text-xs text-slate-500 mt-3">
                Supports PDF, DOCX, TXT, XLSX, PPT and more
              </p>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
