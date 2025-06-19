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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { 
  Building,
  Plus,
  Edit,
  Trash2,
  TestTube,
  CheckCircle,
  XCircle,
  Loader2,
  ExternalLink,
  Shield,
  Zap
} from "lucide-react";

interface EnterpriseIntegration {
  id: number;
  name: string;
  description?: string;
  type: 'enterprise';
  enterpriseType: string;
  instanceUrl?: string;
  clientId?: string;
  username?: string;
  isActive: boolean;
  testStatus?: string;
  lastTested?: string;
  createdAt: string;
}

const enterprisePlatforms = [
  {
    id: 'salesforce',
    name: 'Salesforce CRM',
    description: 'Customer Relationship Management platform for sales, service, and marketing data',
    logo: '🏢',
    color: 'bg-blue-600',
    category: 'CRM',
    features: ['Customer Data', 'Sales Analytics', 'Lead Management', 'Opportunity Tracking']
  },
  {
    id: 'sap',
    name: 'SAP Business Suite',
    description: 'Enterprise Resource Planning system for business processes and financial data',
    logo: '💼',
    color: 'bg-blue-800',
    category: 'ERP',
    features: ['Financial Data', 'Supply Chain', 'Human Resources', 'Business Intelligence']
  },
  {
    id: 'oracle_erp',
    name: 'Oracle ERP Cloud',
    description: 'Cloud-based ERP solution for financial and operational management',
    logo: '🔶',
    color: 'bg-red-600',
    category: 'ERP',
    features: ['Financial Management', 'Procurement', 'Project Management', 'Risk Management']
  },
  {
    id: 'microsoft_dynamics',
    name: 'Microsoft Dynamics 365',
    description: 'Business applications platform combining CRM and ERP capabilities',
    logo: '🔷',
    color: 'bg-blue-500',
    category: 'CRM/ERP',
    features: ['Sales Automation', 'Customer Service', 'Finance & Operations', 'Power BI']
  },
  {
    id: 'workday',
    name: 'Workday HCM',
    description: 'Human Capital Management platform for HR and financial management',
    logo: '👥',
    color: 'bg-yellow-600',
    category: 'HCM',
    features: ['HR Analytics', 'Payroll', 'Talent Management', 'Workforce Planning']
  },
  {
    id: 'servicenow',
    name: 'ServiceNow',
    description: 'Digital workflow platform for IT service management and business processes',
    logo: '⚙️',
    color: 'bg-green-600',
    category: 'ITSM',
    features: ['IT Service Management', 'HR Service Delivery', 'Customer Service', 'Security Operations']
  }
];

export default function Integrations() {
  const { toast } = useToast();
  const { user, isAuthenticated, isLoading } = useAuth();
  const queryClient = useQueryClient();
  
  const [isIntegrationModalOpen, setIsIntegrationModalOpen] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<typeof enterprisePlatforms[0] | null>(null);
  const [editingIntegration, setEditingIntegration] = useState<EnterpriseIntegration | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    instanceUrl: '',
    username: '',
    password: '',
    clientId: '',
    clientSecret: '',
  });

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

  // Fetch enterprise integrations
  const { data: integrations = [], refetch: refetchIntegrations } = useQuery({
    queryKey: ['/api/data-connections'],
    enabled: isAuthenticated,
    retry: false,
    select: (data: any[]) => data.filter(item => item.type === 'enterprise'),
  }) as { data: EnterpriseIntegration[], refetch: () => void };

  // Create/Update integration mutation
  const saveIntegrationMutation = useMutation({
    mutationFn: async (data: any) => {
      const endpoint = editingIntegration ? `/api/data-connections/${editingIntegration.id}` : '/api/data-connections';
      const method = editingIntegration ? 'PUT' : 'POST';
      
      const payload = {
        ...data,
        type: 'enterprise',
        enterpriseType: selectedPlatform?.id,
      };
      
      const response = await apiRequest(method, endpoint, payload);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/data-connections'] });
      toast({
        title: "Success",
        description: `Integration ${editingIntegration ? 'updated' : 'created'} successfully`,
      });
      setIsIntegrationModalOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
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
        description: "Failed to save integration",
        variant: "destructive",
      });
    },
  });

  // Delete integration mutation
  const deleteIntegrationMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest('DELETE', `/api/data-connections/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/data-connections'] });
      toast({
        title: "Success",
        description: "Integration deleted successfully",
      });
    },
    onError: (error: Error) => {
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
        description: "Failed to delete integration",
        variant: "destructive",
      });
    },
  });

  // Test integration mutation
  const testIntegrationMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest('POST', `/api/data-connections/${id}/test`);
      return response.json();
    },
    onSuccess: () => {
      refetchIntegrations();
      toast({
        title: "Test Completed",
        description: "Integration test completed successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Test Failed",
        description: "Integration test failed",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      instanceUrl: '',
      username: '',
      password: '',
      clientId: '',
      clientSecret: '',
    });
    setSelectedPlatform(null);
    setEditingIntegration(null);
  };

  const openIntegrationModal = (platform?: typeof enterprisePlatforms[0], integration?: EnterpriseIntegration) => {
    if (integration) {
      setEditingIntegration(integration);
      setSelectedPlatform(enterprisePlatforms.find(p => p.id === integration.enterpriseType) || null);
      setFormData({
        name: integration.name || '',
        description: integration.description || '',
        instanceUrl: integration.instanceUrl || '',
        username: integration.username || '',
        password: '',
        clientId: integration.clientId || '',
        clientSecret: '',
      });
    } else if (platform) {
      setSelectedPlatform(platform);
      setFormData(prev => ({
        ...prev,
        name: platform.name,
        description: platform.description,
      }));
    } else {
      resetForm();
    }
    setIsIntegrationModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveIntegrationMutation.mutate(formData);
  };

  if (isLoading) {
    return (
      <div className="flex h-screen bg-slate-50">
        <Sidebar />
        <div className="flex-1 flex flex-col">
          <TopBar />
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <TopBar />
        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-6xl mx-auto">
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-slate-800 mb-2">Enterprise Integrations</h1>
              <p className="text-slate-600">
                Connect with enterprise platforms to access business data and analytics through AI chat
              </p>
            </div>

            {/* Platform Selection Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              {enterprisePlatforms.map((platform) => {
                const existingIntegration = integrations.find(i => i.enterpriseType === platform.id);
                
                return (
                  <Card key={platform.id} className="group hover:shadow-lg transition-all duration-200 border border-slate-200">
                    <CardHeader className="pb-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-3">
                          <div className={`w-12 h-12 rounded-lg ${platform.color} flex items-center justify-center text-white text-2xl`}>
                            {platform.logo}
                          </div>
                          <div>
                            <CardTitle className="text-lg font-semibold text-slate-800">
                              {platform.name}
                            </CardTitle>
                            <Badge variant="outline" className="mt-1">
                              {platform.category}
                            </Badge>
                          </div>
                        </div>
                        {existingIntegration && (
                          <div className="flex items-center space-x-1">
                            <Badge 
                              variant={existingIntegration.isActive ? 'default' : 'destructive'}
                              className="text-xs"
                            >
                              {existingIntegration.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                            {existingIntegration.testStatus && (
                              <Badge 
                                variant={existingIntegration.testStatus === 'success' ? 'default' : 'destructive'}
                                className="text-xs"
                              >
                                {existingIntegration.testStatus === 'success' ? 'Connected' : 'Failed'}
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-slate-600 mb-4">{platform.description}</p>
                      
                      <div className="space-y-2 mb-4">
                        <p className="text-xs font-medium text-slate-700">Key Features:</p>
                        <div className="flex flex-wrap gap-1">
                          {platform.features.map((feature, index) => (
                            <Badge key={index} variant="secondary" className="text-xs">
                              {feature}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        {existingIntegration ? (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => testIntegrationMutation.mutate(existingIntegration.id)}
                              disabled={testIntegrationMutation.isPending}
                            >
                              {testIntegrationMutation.isPending ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <TestTube className="w-4 h-4" />
                              )}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openIntegrationModal(platform, existingIntegration)}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => deleteIntegrationMutation.mutate(existingIntegration.id)}
                              disabled={deleteIntegrationMutation.isPending}
                            >
                              {deleteIntegrationMutation.isPending ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Trash2 className="w-4 h-4 text-red-600" />
                              )}
                            </Button>
                          </>
                        ) : (
                          <Button
                            onClick={() => openIntegrationModal(platform)}
                            size="sm"
                            className="w-full"
                          >
                            <Plus className="w-4 h-4 mr-2" />
                            Connect
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Existing Integrations Summary */}
            {integrations.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Building className="w-5 h-5" />
                    <span>Active Integrations</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {integrations.map((integration) => {
                      const platform = enterprisePlatforms.find(p => p.id === integration.enterpriseType);
                      return (
                        <div key={integration.id} className="flex items-center space-x-3 p-3 bg-slate-50 rounded-lg">
                          <div className={`w-10 h-10 rounded-lg ${platform?.color || 'bg-gray-500'} flex items-center justify-center text-white text-lg`}>
                            {platform?.logo || '🏢'}
                          </div>
                          <div className="flex-1">
                            <h4 className="font-medium text-slate-800">{integration.name}</h4>
                            <p className="text-xs text-slate-500">
                              {integration.lastTested ? `Last tested: ${new Date(integration.lastTested).toLocaleDateString()}` : 'Not tested'}
                            </p>
                          </div>
                          <div className="flex items-center space-x-1">
                            {integration.testStatus === 'success' ? (
                              <CheckCircle className="w-4 h-4 text-green-600" />
                            ) : integration.testStatus === 'failed' ? (
                              <XCircle className="w-4 h-4 text-red-600" />
                            ) : (
                              <Zap className="w-4 h-4 text-yellow-600" />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Integration Configuration Modal */}
      <Dialog open={isIntegrationModalOpen} onOpenChange={setIsIntegrationModalOpen}>
        <DialogContent className="max-w-2xl w-full">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Building className="w-5 h-5" />
              <span>{editingIntegration ? 'Edit' : 'Configure'} {selectedPlatform?.name}</span>
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Integration Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Enter a name for this integration"
                  required
                />
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe the purpose of this integration"
                  rows={2}
                />
              </div>

              <div>
                <Label htmlFor="instanceUrl">Instance URL</Label>
                <Input
                  id="instanceUrl"
                  value={formData.instanceUrl}
                  onChange={(e) => setFormData({ ...formData, instanceUrl: e.target.value })}
                  placeholder={`https://${selectedPlatform?.id === 'salesforce' ? 'your-instance.salesforce.com' : 'your-instance.com'}`}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    placeholder="Username or email"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="Password"
                    required={!editingIntegration}
                  />
                </div>
              </div>

              {selectedPlatform?.id === 'salesforce' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="clientId">Client ID (Optional)</Label>
                    <Input
                      id="clientId"
                      value={formData.clientId}
                      onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
                      placeholder="Connected App Client ID"
                    />
                  </div>
                  <div>
                    <Label htmlFor="clientSecret">Client Secret (Optional)</Label>
                    <Input
                      id="clientSecret"
                      type="password"
                      value={formData.clientSecret}
                      onChange={(e) => setFormData({ ...formData, clientSecret: e.target.value })}
                      placeholder="Connected App Client Secret"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-3">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setIsIntegrationModalOpen(false)}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={saveIntegrationMutation.isPending}
              >
                {saveIntegrationMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Plus className="w-4 h-4 mr-2" />
                )}
                {editingIntegration ? 'Update' : 'Connect'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}