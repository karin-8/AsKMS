
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  CheckCircle, 
  XCircle, 
  TrendingUp, 
  BarChart3,
  Bot,
  MessageSquare 
} from "lucide-react";

export default function AIResponseAnalysis() {
  const { data: analysisStats, isLoading } = useQuery({
    queryKey: ["/api/ai-analysis/stats"],
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader className="animate-pulse">
                <div className="w-16 h-4 bg-gray-200 rounded"></div>
                <div className="w-24 h-8 bg-gray-200 rounded"></div>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const positiveRate = analysisStats?.totalAnalyses > 0 
    ? (analysisStats.positiveCount / analysisStats.totalAnalyses) * 100 
    : 0;

  const fallbackRate = analysisStats?.totalAnalyses > 0 
    ? (analysisStats.fallbackCount / analysisStats.totalAnalyses) * 100 
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">
          AI Response Analysis Dashboard
        </h1>
        <Badge variant="outline" className="px-3 py-1">
          <Bot className="w-4 h-4 mr-1" />
          Auto-Analysis
        </Badge>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Analyses</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analysisStats?.totalAnalyses || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              AI responses analyzed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Positive Responses</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {analysisStats?.positiveCount || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {positiveRate.toFixed(1)}% success rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Fallback Responses</CardTitle>
            <XCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {analysisStats?.fallbackCount || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {fallbackRate.toFixed(1)}% fallback rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Confidence</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {((analysisStats?.averageConfidence || 0) * 100).toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">
              Analysis confidence
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Success Rate Visualization */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Response Success Rate</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-green-600">
                  Positive Responses
                </span>
                <span className="text-sm text-gray-500">
                  {analysisStats?.positiveCount || 0} / {analysisStats?.totalAnalyses || 0}
                </span>
              </div>
              <Progress value={positiveRate} className="h-2" />
            </div>
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-red-600">
                  Fallback Responses
                </span>
                <span className="text-sm text-gray-500">
                  {analysisStats?.fallbackCount || 0} / {analysisStats?.totalAnalyses || 0}
                </span>
              </div>
              <Progress value={fallbackRate} className="h-2 bg-red-100" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Analysis Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 max-h-80 overflow-y-auto">
              {analysisStats?.recentAnalyses?.map((analysis: any) => (
                <div key={analysis.id} className="border-l-4 border-l-blue-200 pl-4 py-2">
                  <div className="flex items-center justify-between mb-1">
                    <Badge 
                      variant={analysis.analysisType === 'positive' ? 'default' : 'destructive'}
                      className="text-xs"
                    >
                      {analysis.analysisType === 'positive' ? (
                        <CheckCircle className="w-3 h-3 mr-1" />
                      ) : (
                        <XCircle className="w-3 h-3 mr-1" />
                      )}
                      {analysis.analysisType}
                    </Badge>
                    <span className="text-xs text-gray-500">
                      {(analysis.confidence * 100).toFixed(0)}% confidence
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 truncate">
                    {analysis.analysisReason}
                  </p>
                  {analysis.documentName && (
                    <p className="text-xs text-blue-600 mt-1">
                      Document: {analysis.documentName}
                    </p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(analysis.createdAt).toLocaleDateString('th-TH')} {new Date(analysis.createdAt).toLocaleTimeString('th-TH')}
                  </p>
                </div>
              ))}
              {(!analysisStats?.recentAnalyses || analysisStats.recentAnalyses.length === 0) && (
                <div className="text-center py-8 text-gray-500">
                  <MessageSquare className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p>No analysis data available yet</p>
                  <p className="text-sm mt-1">
                    Start chatting with documents to generate analysis data
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
