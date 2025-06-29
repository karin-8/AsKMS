import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Server, Zap, AlertTriangle, CheckCircle, Clock, TrendingUp } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, LineChart, Line, Legend } from "recharts";
import DashboardLayout from "@/components/Layout/DashboardLayout";

export default function SystemHealth() {
  // Mock system health data - in real implementation, this would come from monitoring APIs
  const systemMetrics = {
    avgInferenceTime: 1.2,
    accuracyScore: 87.5,
    failures: 3,
    uptime: 99.8
  };

  // Performance trend over last 24 hours
  const performanceTrendData = Array.from({ length: 24 }, (_, i) => {
    const hour = new Date();
    hour.setHours(hour.getHours() - (23 - i));
    
    return {
      time: hour.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      responseTime: 0.8 + Math.random() * 0.8, // 0.8-1.6 seconds
      accuracy: 85 + Math.random() * 10, // 85-95%
      throughput: 50 + Math.random() * 100 // 50-150 requests/hour
    };
  });

  // AI Model Performance by Type
  const modelPerformanceData = [
    { model: 'OpenAI GPT-4', avgTime: 1.2, accuracy: 92, status: 'Healthy' },
    { model: 'Classification Model', avgTime: 0.3, accuracy: 88, status: 'Healthy' },
    { model: 'Embedding Model', avgTime: 0.5, accuracy: 90, status: 'Warning' },
    { model: 'Search Index', avgTime: 0.1, accuracy: 85, status: 'Healthy' }
  ];

  // Error distribution
  const errorData = [
    { type: 'Timeout', count: 12, severity: 'High' },
    { type: 'Rate Limit', count: 8, severity: 'Medium' },
    { type: 'API Error', count: 5, severity: 'High' },
    { type: 'Parse Error', count: 3, severity: 'Low' },
    { type: 'Network', count: 2, severity: 'Medium' }
  ];

  // System status indicators
  const systemStatus = [
    { component: 'API Gateway', status: 'Healthy', uptime: '99.9%', lastCheck: '2 min ago' },
    { component: 'Database', status: 'Healthy', uptime: '99.8%', lastCheck: '1 min ago' },
    { component: 'AI Services', status: 'Warning', uptime: '98.5%', lastCheck: '30 sec ago' },
    { component: 'File Storage', status: 'Healthy', uptime: '99.7%', lastCheck: '1 min ago' },
    { component: 'Vector Database', status: 'Healthy', uptime: '99.6%', lastCheck: '45 sec ago' }
  ];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Healthy':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'Warning':
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'Error':
        return <AlertTriangle className="w-4 h-4 text-red-500" />;
      default:
        return <Server className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Healthy':
        return 'bg-green-100 text-green-800';
      case 'Warning':
        return 'bg-yellow-100 text-yellow-800';
      case 'Error':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">System Health & AI Performance</h1>
          <p className="text-gray-600 mt-1">Monitor system performance and AI model metrics</p>
        </div>
        <Badge variant="outline" className="px-3 py-1">
          <Server className="w-4 h-4 mr-2" />
          Real-time Monitoring
        </Badge>
      </div>

      {/* Key Performance Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Avg Inference Time</p>
                <p className="text-2xl font-bold text-gray-900">{systemMetrics.avgInferenceTime}s</p>
                <p className="text-xs text-green-600 mt-1">-0.2s from target</p>
              </div>
              <Clock className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Accuracy Score</p>
                <p className="text-2xl font-bold text-gray-900">{systemMetrics.accuracyScore}%</p>
                <p className="text-xs text-green-600 mt-1">+2.5% improvement</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Failed Tasks</p>
                <p className="text-2xl font-bold text-gray-900">{systemMetrics.failures}</p>
                <p className="text-xs text-yellow-600 mt-1">Last 24 hours</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">System Uptime</p>
                <p className="text-2xl font-bold text-gray-900">{systemMetrics.uptime}%</p>
                <p className="text-xs text-green-600 mt-1">99.5% SLA target</p>
              </div>
              <Server className="w-8 h-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Performance Trend */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <TrendingUp className="w-5 h-5" />
            <span>Performance Trend (24 Hours)</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={performanceTrendData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip />
              <Legend />
              <Line yAxisId="left" type="monotone" dataKey="responseTime" stroke="#8884d8" strokeWidth={2} name="Response Time (s)" />
              <Line yAxisId="right" type="monotone" dataKey="accuracy" stroke="#82ca9d" strokeWidth={2} name="Accuracy (%)" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* System Status and Model Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* System Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Server className="w-5 h-5" />
              <span>System Components Status</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {systemStatus.map((component, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    {getStatusIcon(component.status)}
                    <div>
                      <p className="font-medium text-gray-900">{component.component}</p>
                      <p className="text-sm text-gray-500">Uptime: {component.uptime}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge className={getStatusColor(component.status)}>
                      {component.status}
                    </Badge>
                    <p className="text-xs text-gray-500 mt-1">{component.lastCheck}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* AI Model Performance */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Zap className="w-5 h-5" />
              <span>AI Model Performance</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {modelPerformanceData.map((model, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">{model.model}</p>
                    <p className="text-sm text-gray-500">
                      {model.avgTime}s avg • {model.accuracy}% accuracy
                    </p>
                  </div>
                  <Badge className={getStatusColor(model.status)}>
                    {model.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Error Analysis */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <AlertTriangle className="w-5 h-5" />
            <span>Error Distribution (Last 24 Hours)</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={errorData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="type" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#FF8042" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Performance Metrics Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Clock className="w-5 h-5" />
            <span>Detailed Performance Metrics</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-3 font-medium text-gray-900">Metric</th>
                  <th className="text-center p-3 font-medium text-gray-900">Current</th>
                  <th className="text-center p-3 font-medium text-gray-900">Target</th>
                  <th className="text-center p-3 font-medium text-gray-900">Status</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b hover:bg-gray-50">
                  <td className="p-3 font-medium">API Response Time</td>
                  <td className="p-3 text-center">1.2s</td>
                  <td className="p-3 text-center">&lt; 2.0s</td>
                  <td className="p-3 text-center">
                    <Badge className="bg-green-100 text-green-800">Good</Badge>
                  </td>
                </tr>
                <tr className="border-b hover:bg-gray-50">
                  <td className="p-3 font-medium">Classification Accuracy</td>
                  <td className="p-3 text-center">87.5%</td>
                  <td className="p-3 text-center">&gt; 85%</td>
                  <td className="p-3 text-center">
                    <Badge className="bg-green-100 text-green-800">Good</Badge>
                  </td>
                </tr>
                <tr className="border-b hover:bg-gray-50">
                  <td className="p-3 font-medium">Error Rate</td>
                  <td className="p-3 text-center">0.5%</td>
                  <td className="p-3 text-center">&lt; 1%</td>
                  <td className="p-3 text-center">
                    <Badge className="bg-green-100 text-green-800">Good</Badge>
                  </td>
                </tr>
                <tr className="border-b hover:bg-gray-50">
                  <td className="p-3 font-medium">Vector Search Latency</td>
                  <td className="p-3 text-center">150ms</td>
                  <td className="p-3 text-center">&lt; 200ms</td>
                  <td className="p-3 text-center">
                    <Badge className="bg-green-100 text-green-800">Good</Badge>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}