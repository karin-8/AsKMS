import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, TrendingUp, PieChart, BarChart3, Upload, Calendar } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart as RechartsPieChart, Cell, LineChart, Line, Legend } from "recharts";
import DashboardLayout from "@/components/Layout/DashboardLayout";

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

export default function DocumentUsage() {
  const { data: documents = [] } = useQuery({
    queryKey: ["/api/documents"],
  });

  const { data: categoryStats = [] } = useQuery({
    queryKey: ["/api/stats/categories"],
  });

  // Process data for charts
  const fileTypeData = documents.reduce((acc: any, doc: any) => {
    const ext = doc.originalName?.split('.').pop()?.toUpperCase() || 'UNKNOWN';
    acc[ext] = (acc[ext] || 0) + 1;
    return acc;
  }, {});

  const fileTypeChartData = Object.entries(fileTypeData).map(([type, count]) => ({
    fileType: type,
    count: count
  }));

  // Upload trend data (last 7 days)
  const uploadTrendData = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - i));
    const dateStr = date.toISOString().split('T')[0];
    
    const docsForDate = documents.filter((doc: any) => 
      doc.createdAt?.split('T')[0] === dateStr
    ).length;

    return {
      date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      uploads: docsForDate
    };
  });

  // Classification status
  const classificationData = [
    { 
      name: 'Classified', 
      value: documents.filter((doc: any) => doc.aiCategory && doc.aiCategory !== 'Uncategorized').length,
      color: '#00C49F'
    },
    { 
      name: 'Unclassified', 
      value: documents.filter((doc: any) => !doc.aiCategory || doc.aiCategory === 'Uncategorized').length,
      color: '#FF8042'
    }
  ];

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
                <p className="text-2xl font-bold text-gray-900">{documents.length}</p>
              </div>
              <FileText className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Auto-Classified</p>
                <p className="text-2xl font-bold text-gray-900">
                  {documents.filter((doc: any) => doc.aiCategory && doc.aiCategory !== 'Uncategorized').length}
                </p>
              </div>
              <PieChart className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">This Week</p>
                <p className="text-2xl font-bold text-gray-900">
                  {uploadTrendData.reduce((sum, day) => sum + day.uploads, 0)}
                </p>
              </div>
              <Upload className="w-8 h-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Classification Rate</p>
                <p className="text-2xl font-bold text-gray-900">
                  {documents.length > 0 ? Math.round((documents.filter((doc: any) => doc.aiCategory && doc.aiCategory !== 'Uncategorized').length / documents.length) * 100) : 0}%
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* File Type Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <BarChart3 className="w-5 h-5" />
              <span>Documents by File Type</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={fileTypeChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="fileType" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#0088FE" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Classification Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <PieChart className="w-5 h-5" />
              <span>Classification Status</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <RechartsPieChart>
                <Tooltip />
                <Legend />
                <RechartsPieChart.Pie
                  data={classificationData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {classificationData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </RechartsPieChart.Pie>
              </RechartsPieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Upload Trend */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <TrendingUp className="w-5 h-5" />
            <span>Upload Trend (Last 7 Days)</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={uploadTrendData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="uploads" stroke="#8884d8" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Category Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <BarChart3 className="w-5 h-5" />
            <span>Documents by Category</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {categoryStats.map((stat: any, index: number) => (
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
    </DashboardLayout>
  );
}