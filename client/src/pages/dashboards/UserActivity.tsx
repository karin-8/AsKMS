import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Activity, Download, Eye, Edit, Clock } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, LineChart, Line, Legend } from "recharts";

export default function UserActivity() {
  const { data: documents = [] } = useQuery({
    queryKey: ["/api/documents"],
  });

  // Mock user activity data (in real implementation, this would come from document access logs)
  const userActivityData = [
    { user: "John Smith", role: "Admin", uploads: 12, downloads: 45, edits: 8, lastActive: "2 hours ago" },
    { user: "Sarah Johnson", role: "Editor", uploads: 8, downloads: 32, edits: 15, lastActive: "1 hour ago" },
    { user: "Mike Chen", role: "Viewer", uploads: 2, downloads: 28, edits: 0, lastActive: "30 min ago" },
    { user: "Emily Davis", role: "Editor", uploads: 6, downloads: 19, edits: 7, lastActive: "4 hours ago" },
    { user: "Alex Brown", role: "Admin", uploads: 9, downloads: 41, edits: 12, lastActive: "1 hour ago" }
  ];

  // Daily activity trend (last 7 days)
  const activityTrendData = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - i));
    
    return {
      date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      uploads: Math.floor(Math.random() * 15) + 5,
      downloads: Math.floor(Math.random() * 50) + 20,
      searches: Math.floor(Math.random() * 80) + 30,
      views: Math.floor(Math.random() * 120) + 60
    };
  });

  // Activity by hour heatmap data
  const hourlyActivityData = Array.from({ length: 24 }, (_, hour) => ({
    hour: `${hour}:00`,
    activity: Math.floor(Math.random() * 30) + (hour >= 9 && hour <= 17 ? 20 : 5) // Higher during work hours
  }));

  // Role distribution
  const roleDistribution = [
    { role: "Admin", count: 5, color: "#FF8042" },
    { role: "Editor", count: 12, color: "#00C49F" },
    { role: "Viewer", count: 23, color: "#0088FE" }
  ];

  const totalUsers = roleDistribution.reduce((sum, role) => sum + role.count, 0);
  const activeUsers = Math.floor(totalUsers * 0.7); // 70% active

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">User Activity Monitoring</h1>
          <p className="text-gray-600 mt-1">Track user engagement and system usage patterns</p>
        </div>
        <Badge variant="outline" className="px-3 py-1">
          <Activity className="w-4 h-4 mr-2" />
          Live Monitoring
        </Badge>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Users</p>
                <p className="text-2xl font-bold text-gray-900">{activeUsers}</p>
                <p className="text-xs text-green-600 mt-1">+5% this week</p>
              </div>
              <Users className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">File Access Events</p>
                <p className="text-2xl font-bold text-gray-900">1,247</p>
                <p className="text-xs text-green-600 mt-1">+18% from yesterday</p>
              </div>
              <Eye className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Downloads Today</p>
                <p className="text-2xl font-bold text-gray-900">89</p>
                <p className="text-xs text-blue-600 mt-1">Peak at 2 PM</p>
              </div>
              <Download className="w-8 h-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Edits/Tags</p>
                <p className="text-2xl font-bold text-gray-900">34</p>
                <p className="text-xs text-green-600 mt-1">+12% improvement</p>
              </div>
              <Edit className="w-8 h-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Activity Trend */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Activity className="w-5 h-5" />
            <span>Daily Activity Trend</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={activityTrendData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="uploads" stroke="#8884d8" strokeWidth={2} name="Uploads" />
              <Line type="monotone" dataKey="downloads" stroke="#82ca9d" strokeWidth={2} name="Downloads" />
              <Line type="monotone" dataKey="searches" stroke="#ffc658" strokeWidth={2} name="Searches" />
              <Line type="monotone" dataKey="views" stroke="#ff7300" strokeWidth={2} name="Views" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Hourly Activity Heatmap */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Clock className="w-5 h-5" />
            <span>Activity by Hour</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={hourlyActivityData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="hour" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="activity" fill="#0088FE" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* User Role Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Users className="w-5 h-5" />
              <span>User Role Distribution</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {roleDistribution.map((role, index) => (
                <div key={role.role} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div 
                      className="w-4 h-4 rounded"
                      style={{ backgroundColor: role.color }}
                    />
                    <span className="font-medium">{role.role}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge variant="outline">{role.count} users</Badge>
                    <span className="text-sm text-gray-500">
                      {Math.round((role.count / totalUsers) * 100)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Top Active Users */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Activity className="w-5 h-5" />
              <span>Top Active Users</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {userActivityData.map((user, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <Badge variant="outline" className="text-xs">
                      #{index + 1}
                    </Badge>
                    <div>
                      <p className="font-medium text-gray-900">{user.user}</p>
                      <p className="text-sm text-gray-500">{user.role}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">
                      {user.uploads + user.downloads + user.edits} actions
                    </p>
                    <p className="text-xs text-gray-500">{user.lastActive}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Activity Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Activity className="w-5 h-5" />
            <span>User Activity Details</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-3 font-medium text-gray-900">User</th>
                  <th className="text-left p-3 font-medium text-gray-900">Role</th>
                  <th className="text-center p-3 font-medium text-gray-900">Uploads</th>
                  <th className="text-center p-3 font-medium text-gray-900">Downloads</th>
                  <th className="text-center p-3 font-medium text-gray-900">Edits</th>
                  <th className="text-center p-3 font-medium text-gray-900">Last Active</th>
                </tr>
              </thead>
              <tbody>
                {userActivityData.map((user, index) => (
                  <tr key={index} className="border-b hover:bg-gray-50">
                    <td className="p-3 font-medium">{user.user}</td>
                    <td className="p-3">
                      <Badge variant="outline">{user.role}</Badge>
                    </td>
                    <td className="p-3 text-center">{user.uploads}</td>
                    <td className="p-3 text-center">{user.downloads}</td>
                    <td className="p-3 text-center">{user.edits}</td>
                    <td className="p-3 text-center text-gray-500">{user.lastActive}</td>
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