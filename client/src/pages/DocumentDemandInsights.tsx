import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";
import { TrendingUp, FileText, Eye, Clock } from "lucide-react";

export default function DocumentDemandInsights() {
  const { data: insightsData, isLoading } = useQuery({
    queryKey: ["/api/analytics/document-demand"],
    retry: false,
    refetchOnWindowFocus: false,
  });

  if (isLoading) {
    return (
      <div className="container mx-auto py-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }

  const mostAccessedDocuments = insightsData?.mostAccessedDocuments || [];
  const categoryStats = insightsData?.categoryStats || [];
  const timelineData = insightsData?.timelineData || [];

  // Colors for pie chart
  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'];

  const formatCategoryData = categoryStats.map((item, index) => ({
    ...item,
    fill: COLORS[index % COLORS.length]
  }));

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Document Demand Insights</h1>
          <p className="text-gray-600 mt-1">
            ความเข้าใจเกี่ยวกับเอกสารที่ถูกเข้าถึงและคำค้นหาที่ได้รับความนิยมมากที่สุด
          </p>
        </div>
        <div className="flex items-center space-x-2 text-sm text-gray-500">
          <Clock className="w-4 h-4" />
          <span>อัพเดทล่าสุด: {new Date().toLocaleDateString('th-TH')}</span>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Document Access</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {mostAccessedDocuments.reduce((sum, doc) => sum + doc.accessCount, 0)}
            </div>
            <p className="text-xs text-muted-foreground">การเข้าถึงเอกสารทั้งหมด</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Most Popular Category</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {categoryStats[0]?.category || 'N/A'}
            </div>
            <p className="text-xs text-muted-foreground">
              {categoryStats[0]?.count || 0} การเข้าถึง
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Documents</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mostAccessedDocuments.length}</div>
            <p className="text-xs text-muted-foreground">เอกสารที่มีการเข้าถึง</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Most Accessed Documents */}
        <Card>
          <CardHeader>
            <CardTitle>เอกสารที่เข้าถึงมากที่สุด (Top 10)</CardTitle>
            <CardDescription>เอกสารที่ผู้ใช้เข้าถึงบ่อยที่สุดในระบบ</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={mostAccessedDocuments} layout="horizontal">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis 
                  dataKey="documentName" 
                  type="category" 
                  width={120}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip 
                  formatter={(value) => [value, 'การเข้าถึง']}
                  labelFormatter={(label) => `เอกสาร: ${label}`}
                />
                <Bar dataKey="accessCount" fill="#3B82F6" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Category Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>การกระจายตามหมวดหมู่</CardTitle>
            <CardDescription>สัดส่วนการเข้าถึงเอกสารตามหมวดหมู่</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={350}>
              <PieChart>
                <Pie
                  data={formatCategoryData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ category, percent }) => `${category} (${(percent * 100).toFixed(0)}%)`}
                  outerRadius={120}
                  fill="#8884d8"
                  dataKey="count"
                >
                  {formatCategoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => [value, 'การเข้าถึง']} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Timeline Chart */}
      <Card>
        <CardHeader>
          <CardTitle>แนวโน้มการเข้าถึงเอกสาร (30 วันที่ผ่านมา)</CardTitle>
          <CardDescription>กราฟแสดงการเข้าถึงเอกสารตามช่วงเวลา</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={timelineData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => new Date(value).toLocaleDateString('th-TH', { 
                  month: 'short', 
                  day: 'numeric' 
                })}
              />
              <YAxis />
              <Tooltip 
                formatter={(value) => [value, 'การเข้าถึง']}
                labelFormatter={(label) => new Date(label).toLocaleDateString('th-TH')}
              />
              <Line 
                type="monotone" 
                dataKey="accessCount" 
                stroke="#10B981" 
                strokeWidth={2}
                dot={{ fill: '#10B981', strokeWidth: 2, r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Document Details Table */}
      <Card>
        <CardHeader>
          <CardTitle>รายละเอียดเอกสาร</CardTitle>
          <CardDescription>ข้อมูลโดยละเอียดของเอกสารที่เข้าถึงมากที่สุด</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">ชื่อเอกสาร</th>
                  <th className="text-left py-2">หมวดหมู่</th>
                  <th className="text-right py-2">จำนวนการเข้าถึง</th>
                </tr>
              </thead>
              <tbody>
                {mostAccessedDocuments.map((doc, index) => (
                  <tr key={doc.documentId} className="border-b">
                    <td className="py-2 font-medium">{doc.documentName}</td>
                    <td className="py-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800`}>
                        {doc.category}
                      </span>
                    </td>
                    <td className="py-2 text-right font-semibold">{doc.accessCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}