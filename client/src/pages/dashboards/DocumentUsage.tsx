import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, TrendingUp, PieChart, BarChart3, Upload, Calendar } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart as RechartsPieChart, Cell, LineChart, Line, Legend, Pie } from "recharts";
import DashboardLayout from "@/components/Layout/DashboardLayout";
import type { Document } from "@shared/schema";

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

export default function DocumentUsage() {
  const { data: documents = [] } = useQuery<Document[]>({
    queryKey: ["/api/documents"],
  });

  const { data: categoryStats = [] } = useQuery({
    queryKey: ["/api/categories/stats"],
  });

  // Calculate metrics
  const totalDocuments = documents.length;
  const todayUploads = documents.filter((doc: Document) => {
    const today = new Date().toDateString();
    if (!doc.createdAt) return false;
    return new Date(doc.createdAt).toDateString() === today;
  }).length;

  const totalSize = documents.reduce((sum: number, doc: Document) => sum + (doc.fileSize || 0), 0);
  const avgSize = totalDocuments > 0 ? Math.round(totalSize / totalDocuments / 1024) : 0;

  // Upload trend data (last 7 days)
  const uploadTrendData = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - i));
    const dayDocs = documents.filter((doc: Document) => {
      if (!doc.createdAt) return false;
      return new Date(doc.createdAt).toDateString() === date.toDateString();
    });
    return {
      date: date.toLocaleDateString('en-US', { weekday: 'short' }),
      uploads: dayDocs.length,
      size: Math.round(dayDocs.reduce((sum: number, doc: Document) => sum + (doc.fileSize || 0), 0) / 1024 / 1024)
    };
  });

  // File type distribution
  const fileTypeData = documents.reduce((acc: any, doc: Document) => {
    const ext = doc.fileName.split('.').pop()?.toLowerCase() || 'unknown';
    acc[ext] = (acc[ext] || 0) + 1;
    return acc;
  }, {});

  const fileTypeChartData = Object.entries(fileTypeData).map(([type, count]) => ({
    name: type.toUpperCase(),
    value: count,
    color: COLORS[Object.keys(fileTypeData).indexOf(type) % COLORS.length]
  }));

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Document Usage Overview</h1>
            <p className="text-gray-600 mt-1">Analyze document upload patterns and classification metrics</p>
          </div>
          <Badge variant="outline" className="px-3 py-1">
            <Calendar className="w-4 h-4 mr-2" />
            Last 7 Days
          </Badge>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Documents</p>
                  <p className="text-2xl font-bold text-gray-900">{totalDocuments}</p>
                </div>
                <FileText className="w-8 h-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Today's Uploads</p>
                  <p className="text-2xl font-bold text-gray-900">{todayUploads}</p>
                </div>
                <Upload className="w-8 h-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Avg File Size</p>
                  <p className="text-2xl font-bold text-gray-900">{avgSize} KB</p>
                </div>
                <BarChart3 className="w-8 h-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Growth Rate</p>
                  <p className="text-2xl font-bold text-gray-900">+12.5%</p>
                </div>
                <TrendingUp className="w-8 h-8 text-orange-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Upload Trend Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <BarChart3 className="w-5 h-5 mr-2" />
                Upload Trend (Last 7 Days)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={uploadTrendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="uploads" fill="#0088FE" name="Documents" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* File Type Distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <PieChart className="w-5 h-5 mr-2" />
                File Type Distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <RechartsPieChart>
                  <Pie
                    data={fileTypeChartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {fileTypeChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </RechartsPieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Storage Usage and Categories */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Storage Usage Over Time */}
          <Card>
            <CardHeader>
              <CardTitle>Storage Usage Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={uploadTrendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="size" stroke="#00C49F" name="Size (MB)" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Categories Overview */}
          <Card>
            <CardHeader>
              <CardTitle>Documents by Category</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Array.isArray(categoryStats) && categoryStats.map((stat: any, index: number) => (
                  <div key={stat.category} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div 
                        className="w-4 h-4 rounded"
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      />
                      <span className="font-medium">{stat.category}</span>
                    </div>
                    <Badge variant="outline">{stat.count} docs</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}