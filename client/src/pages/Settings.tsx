import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { 
  User, 
  Settings as SettingsIcon, 
  LogOut,
  Shield,
  Bell,
  Database,
  Key,
  Globe,
  Server,
  Plus,
  Edit,
  Trash2,
  TestTube,
  CheckCircle,
  XCircle,
  Loader2,
  X
} from "lucide-react";

interface DataConnection {
  id: number;
  name: string;
  description?: string;
  type: 'database' | 'api';
  dbType?: string;
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  apiUrl?: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  authType?: string;
  isActive: boolean;
  testStatus?: string;
  lastTested?: string;
  createdAt: string;
}

const databaseTypes = [
  { value: 'postgresql', label: 'PostgreSQL', icon: Database },
  { value: 'mysql', label: 'MySQL', icon: Database },
  { value: 'sqlserver', label: 'SQL Server', icon: Server },
  { value: 'oracle', label: 'Oracle', icon: Database },
  { value: 'redshift', label: 'Amazon Redshift', icon: Database },
  { value: 'snowflake', label: 'Snowflake', icon: Database },
  { value: 'tidb', label: 'TiDB', icon: Database },
];

const httpMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
const authTypes = [
  { value: 'none', label: 'No Authentication' },
  { value: 'basic', label: 'Basic Auth' },
  { value: 'bearer', label: 'Bearer Token' },
  { value: 'api_key', label: 'API Key' },
];

export default function Settings() {
  const { toast } = useToast();
  const { user, isAuthenticated, isLoading } = useAuth();
  const queryClient = useQueryClient();
  
  const [isConnectionModalOpen, setIsConnectionModalOpen] = useState(false);
  const [editingConnection, setEditingConnection] = useState<DataConnection | null>(null);
  const [connectionType, setConnectionType] = useState<'database' | 'api'>('database');
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    dbType: 'postgresql',
    host: '',
    port: 5432,
    database: '',
    username: '',
    password: '',
    connectionString: '',
    apiUrl: '',
    method: 'GET',
    headers: {},
    body: '',
    authType: 'none',
    authConfig: {},
  });
  const [customHeaders, setCustomHeaders] = useState<Array<{ key: string; value: string }>>([]);

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

  // Fetch data connections
  const { data: connections = [], refetch: refetchConnections } = useQuery({
    queryKey: ['/api/data-connections'],
    enabled: isAuthenticated,
    retry: false,
  });

  // Create/Update connection mutation
  const saveConnectionMutation = useMutation({
    mutationFn: async (data: any) => {
      const endpoint = editingConnection ? `/api/data-connections/${editingConnection.id}` : '/api/data-connections';
      const method = editingConnection ? 'PUT' : 'POST';
      
      const headers = customHeaders.reduce((acc, header) => {
        if (header.key && header.value) {
          acc[header.key] = header.value;
        }
        return acc;
      }, {} as Record<string, string>);
      
      const payload = {
        ...data,
        type: connectionType,
        headers,
        port: connectionType === 'database' ? parseInt(data.port.toString()) : undefined,
      };
      
      const response = await apiRequest(method, endpoint, payload);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/data-connections'] });
      toast({
        title: "Success",
        description: `Connection ${editingConnection ? 'updated' : 'created'} successfully`,
      });
      setIsConnectionModalOpen(false);
      resetForm();
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

  // Delete connection mutation
  const deleteConnectionMutation = useMutation({
    mutationFn: async (connectionId: number) => {
      const response = await apiRequest('DELETE', `/api/data-connections/${connectionId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/data-connections'] });
      toast({
        title: "Success",
        description: "Connection deleted successfully",
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

  // Test connection mutation
  const testConnectionMutation = useMutation({
    mutationFn: async (connectionId: number) => {
      const response = await apiRequest('POST', `/api/data-connections/${connectionId}/test`);
      return response.json();
    },
    onSuccess: (result, connectionId) => {
      toast({
        title: result.success ? "Connection Successful" : "Connection Failed",
        description: result.message,
        variant: result.success ? "default" : "destructive",
      });
      refetchConnections();
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
        title: "Connection Test Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleLogout = () => {
    window.location.href = "/api/logout";
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      dbType: 'postgresql',
      host: '',
      port: 5432,
      database: '',
      username: '',
      password: '',
      connectionString: '',
      apiUrl: '',
      method: 'GET',
      headers: {},
      body: '',
      authType: 'none',
      authConfig: {},
    });
    setCustomHeaders([]);
    setEditingConnection(null);
    setConnectionType('database');
  };

  const openConnectionModal = (connection?: DataConnection) => {
    if (connection) {
      setEditingConnection(connection);
      setConnectionType(connection.type);
      setFormData({
        name: connection.name || '',
        description: connection.description || '',
        dbType: connection.dbType || 'postgresql',
        host: connection.host || '',
        port: connection.port || 5432,
        database: connection.database || '',
        username: connection.username || '',
        password: '',
        connectionString: '',
        apiUrl: connection.apiUrl || '',
        method: connection.method || 'GET',
        headers: connection.headers || {},
        body: connection.body || '',
        authType: connection.authType || 'none',
        authConfig: {},
      });
      
      if (connection.headers) {
        const headerArray = Object.entries(connection.headers).map(([key, value]) => ({ key, value }));
        setCustomHeaders(headerArray);
      }
    } else {
      resetForm();
    }
    setIsConnectionModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveConnectionMutation.mutate(formData);
  };

  const addCustomHeader = () => {
    setCustomHeaders([...customHeaders, { key: '', value: '' }]);
  };

  const updateCustomHeader = (index: number, field: 'key' | 'value', value: string) => {
    const updated = [...customHeaders];
    updated[index][field] = value;
    setCustomHeaders(updated);
  };

  const removeCustomHeader = (index: number) => {
    setCustomHeaders(customHeaders.filter((_, i) => i !== index));
  };

  if (isLoading || !isAuthenticated) {
    return null;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar />
        
        <main className="flex-1 overflow-auto p-6">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-semibold text-slate-800 mb-2">Settings</h1>
            <p className="text-sm text-slate-500">
              Manage your account settings and preferences
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Profile Card */}
            <div className="lg:col-span-1">
              <Card className="border border-slate-200">
                <CardHeader>
                  <CardTitle className="text-lg font-semibold text-slate-800 flex items-center">
                    <User className="w-5 h-5 mr-2" />
                    Profile
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col items-center text-center">
                    <Avatar className="w-20 h-20 mb-4">
                      <AvatarImage 
                        src={user?.profileImageUrl} 
                        alt={`${user?.firstName} ${user?.lastName}`}
                        className="object-cover"
                      />
                      <AvatarFallback className="text-lg">
                        {user?.firstName?.[0]}{user?.lastName?.[0]}
                      </AvatarFallback>
                    </Avatar>
                    
                    <h3 className="text-lg font-semibold text-slate-800 mb-1">
                      {user?.firstName} {user?.lastName}
                    </h3>
                    
                    <p className="text-sm text-slate-500 mb-3">
                      {user?.email}
                    </p>
                    
                    <Badge 
                      variant={user?.role === "admin" ? "default" : "secondary"}
                      className="mb-4"
                    >
                      {user?.role === "admin" ? "Administrator" : "User"}
                    </Badge>
                    
                    <Button 
                      variant="outline"
                      onClick={handleLogout}
                      className="w-full"
                    >
                      <LogOut className="w-4 h-4 mr-2" />
                      Sign Out
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Settings Sections */}
            <div className="lg:col-span-2 space-y-6">
              {/* Account Settings */}
              <Card className="border border-slate-200">
                <CardHeader>
                  <CardTitle className="text-lg font-semibold text-slate-800 flex items-center">
                    <SettingsIcon className="w-5 h-5 mr-2" />
                    Account Settings
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                      <div>
                        <h4 className="text-sm font-medium text-slate-800">Profile Information</h4>
                        <p className="text-xs text-slate-500">Update your personal information</p>
                      </div>
                      <Button variant="outline" size="sm" disabled>
                        Edit Profile
                      </Button>
                    </div>
                    
                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                      <div>
                        <h4 className="text-sm font-medium text-slate-800">Email Preferences</h4>
                        <p className="text-xs text-slate-500">Manage email notifications</p>
                      </div>
                      <Button variant="outline" size="sm" disabled>
                        Configure
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Security Settings */}
              <Card className="border border-slate-200">
                <CardHeader>
                  <CardTitle className="text-lg font-semibold text-slate-800 flex items-center">
                    <Shield className="w-5 h-5 mr-2" />
                    Security & Privacy
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                      <div>
                        <h4 className="text-sm font-medium text-slate-800">Access Control</h4>
                        <p className="text-xs text-slate-500">Manage document access permissions</p>
                      </div>
                      <Button variant="outline" size="sm" disabled>
                        Manage Access
                      </Button>
                    </div>
                    
                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                      <div>
                        <h4 className="text-sm font-medium text-slate-800">API Keys</h4>
                        <p className="text-xs text-slate-500">Manage API keys for integrations</p>
                      </div>
                      <Button variant="outline" size="sm" disabled>
                        <Key className="w-4 h-4 mr-2" />
                        View Keys
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Notification Settings */}
              <Card className="border border-slate-200">
                <CardHeader>
                  <CardTitle className="text-lg font-semibold text-slate-800 flex items-center">
                    <Bell className="w-5 h-5 mr-2" />
                    Notifications
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                      <div>
                        <h4 className="text-sm font-medium text-slate-800">Document Processing</h4>
                        <p className="text-xs text-slate-500">Get notified when documents are processed</p>
                      </div>
                      <Badge variant="outline">Enabled</Badge>
                    </div>
                    
                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                      <div>
                        <h4 className="text-sm font-medium text-slate-800">AI Assistant Updates</h4>
                        <p className="text-xs text-slate-500">Notifications about AI features and updates</p>
                      </div>
                      <Badge variant="outline">Enabled</Badge>
                    </div>
                    
                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                      <div>
                        <h4 className="text-sm font-medium text-slate-800">System Alerts</h4>
                        <p className="text-xs text-slate-500">Important system notifications</p>
                      </div>
                      <Badge variant="outline">Enabled</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Data Connections */}
              <Card className="border border-slate-200">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-semibold text-slate-800 flex items-center">
                      <Database className="w-5 h-5 mr-2" />
                      Data Connections
                    </CardTitle>
                    <Button 
                      onClick={() => openConnectionModal()}
                      size="sm"
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Connection
                    </Button>
                  </div>
                  <p className="text-sm text-slate-500 mt-1">
                    Configure database and API connections for enhanced AI chat capabilities
                  </p>
                </CardHeader>
                <CardContent>
                  {connections.length === 0 ? (
                    <div className="text-center py-8 text-slate-500">
                      <Database className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p className="font-medium">No data connections configured</p>
                      <p className="text-xs mt-1">Connect to databases or APIs to enable chat-with-data functionality</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {connections.map((connection: DataConnection) => (
                        <div key={connection.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200">
                          <div className="flex items-center space-x-3">
                            <div className="p-2 bg-white rounded-lg">
                              {connection.type === 'database' ? (
                                <Database className="w-5 h-5 text-blue-600" />
                              ) : (
                                <Globe className="w-5 h-5 text-green-600" />
                              )}
                            </div>
                            <div>
                              <h4 className="text-sm font-medium text-slate-800">{connection.name}</h4>
                              <div className="flex items-center space-x-2 mt-1">
                                <Badge 
                                  variant={connection.type === 'database' ? 'default' : 'secondary'}
                                  className="text-xs"
                                >
                                  {connection.type === 'database' ? connection.dbType?.toUpperCase() : connection.method}
                                </Badge>
                                <Badge 
                                  variant={connection.isActive ? 'default' : 'destructive'}
                                  className="text-xs"
                                >
                                  {connection.isActive ? 'Active' : 'Inactive'}
                                </Badge>
                                {connection.testStatus && (
                                  <Badge 
                                    variant={connection.testStatus === 'success' ? 'default' : 'destructive'}
                                    className="text-xs"
                                  >
                                    {connection.testStatus === 'success' ? 'Connected' : 'Failed'}
                                  </Badge>
                                )}
                              </div>
                              {connection.description && (
                                <p className="text-xs text-slate-500 mt-1">{connection.description}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => testConnectionMutation.mutate(connection.id)}
                              disabled={testConnectionMutation.isPending}
                            >
                              {testConnectionMutation.isPending ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <TestTube className="w-4 h-4" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openConnectionModal(connection)}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteConnectionMutation.mutate(connection.id)}
                              disabled={deleteConnectionMutation.isPending}
                            >
                              {deleteConnectionMutation.isPending ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Trash2 className="w-4 h-4 text-red-600" />
                              )}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </div>

      {/* Data Connection Modal */}
      <Dialog open={isConnectionModalOpen} onOpenChange={setIsConnectionModalOpen}>
        <DialogContent className="max-w-4xl w-full max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              {connectionType === 'database' ? <Database className="w-5 h-5" /> : <Globe className="w-5 h-5" />}
              <span>{editingConnection ? 'Edit' : 'Add'} Data Connection</span>
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-6">
            <Tabs value={connectionType} onValueChange={(value) => setConnectionType(value as 'database' | 'api')}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="database" className="flex items-center space-x-2">
                  <Database className="w-4 h-4" />
                  <span>Database</span>
                </TabsTrigger>
                <TabsTrigger value="api" className="flex items-center space-x-2">
                  <Globe className="w-4 h-4" />
                  <span>API</span>
                </TabsTrigger>
              </TabsList>

              <div className="grid grid-cols-2 gap-4 mt-6">
                <div>
                  <Label htmlFor="name">Connection Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="My Database Connection"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="description">Description (Optional)</Label>
                  <Input
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Production database for analytics"
                  />
                </div>
              </div>

              <TabsContent value="database" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Server className="w-5 h-5" />
                      <span>Database Configuration</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="dbType">Database Type</Label>
                      <Select value={formData.dbType} onValueChange={(value) => setFormData({ ...formData, dbType: value })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {databaseTypes.map((db) => (
                            <SelectItem key={db.value} value={db.value}>
                              <div className="flex items-center space-x-2">
                                <db.icon className="w-4 h-4" />
                                <span>{db.label}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div className="col-span-2">
                        <Label htmlFor="host">Host</Label>
                        <Input
                          id="host"
                          value={formData.host}
                          onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                          placeholder="localhost"
                        />
                      </div>
                      <div>
                        <Label htmlFor="port">Port</Label>
                        <Input
                          id="port"
                          type="number"
                          value={formData.port}
                          onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value) || 5432 })}
                          placeholder="5432"
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="database">Database Name</Label>
                      <Input
                        id="database"
                        value={formData.database}
                        onChange={(e) => setFormData({ ...formData, database: e.target.value })}
                        placeholder="my_database"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="username">Username</Label>
                        <Input
                          id="username"
                          value={formData.username}
                          onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                          placeholder="database_user"
                        />
                      </div>
                      <div>
                        <Label htmlFor="password">Password</Label>
                        <Input
                          id="password"
                          type="password"
                          value={formData.password}
                          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                          placeholder="••••••••"
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="connectionString">Connection String (Optional)</Label>
                      <Textarea
                        id="connectionString"
                        value={formData.connectionString}
                        onChange={(e) => setFormData({ ...formData, connectionString: e.target.value })}
                        placeholder="postgresql://user:password@host:port/database"
                        rows={2}
                      />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="api" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Globe className="w-5 h-5" />
                      <span>API Configuration</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="apiUrl">API URL</Label>
                      <Input
                        id="apiUrl"
                        value={formData.apiUrl}
                        onChange={(e) => setFormData({ ...formData, apiUrl: e.target.value })}
                        placeholder="https://api.example.com/data"
                      />
                    </div>

                    <div>
                      <Label htmlFor="method">HTTP Method</Label>
                      <Select value={formData.method} onValueChange={(value) => setFormData({ ...formData, method: value })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {httpMethods.map((method) => (
                            <SelectItem key={method} value={method}>
                              <Badge variant="outline">{method}</Badge>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Label>Custom Headers</Label>
                        <Button type="button" variant="outline" size="sm" onClick={addCustomHeader}>
                          <Plus className="w-4 h-4 mr-1" />
                          Add Header
                        </Button>
                      </div>
                      {customHeaders.map((header, index) => (
                        <div key={index} className="flex items-center space-x-2 mb-2">
                          <Input
                            placeholder="Header name"
                            value={header.key}
                            onChange={(e) => updateCustomHeader(index, 'key', e.target.value)}
                          />
                          <Input
                            placeholder="Header value"
                            value={header.value}
                            onChange={(e) => updateCustomHeader(index, 'value', e.target.value)}
                          />
                          <Button type="button" variant="ghost" size="sm" onClick={() => removeCustomHeader(index)}>
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>

                    {formData.method !== 'GET' && (
                      <div>
                        <Label htmlFor="body">Request Body</Label>
                        <Textarea
                          id="body"
                          value={formData.body}
                          onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                          placeholder='{"key": "value"}'
                          rows={4}
                        />
                      </div>
                    )}

                    <div>
                      <Label htmlFor="authType">Authentication</Label>
                      <Select value={formData.authType} onValueChange={(value) => setFormData({ ...formData, authType: value })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {authTypes.map((auth) => (
                            <SelectItem key={auth.value} value={auth.value}>
                              <div className="flex items-center space-x-2">
                                <Shield className="w-4 h-4" />
                                <span>{auth.label}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            <div className="flex items-center justify-between pt-4 border-t">
              <div></div>
              <div className="flex items-center space-x-2">
                <Button type="button" variant="outline" onClick={() => setIsConnectionModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saveConnectionMutation.isPending}>
                  {saveConnectionMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {editingConnection ? 'Updating...' : 'Creating...'}
                    </>
                  ) : (
                    <>
                      {editingConnection ? 'Update' : 'Create'} Connection
                    </>
                  )}
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
