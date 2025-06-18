import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { 
  User, 
  Settings as SettingsIcon, 
  LogOut,
  Shield,
  Bell,
  Database,
  Key
} from "lucide-react";

export default function Settings() {
  const { toast } = useToast();
  const { user, isAuthenticated, isLoading } = useAuth();

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

  const handleLogout = () => {
    window.location.href = "/api/logout";
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

              {/* Data & Storage */}
              <Card className="border border-slate-200">
                <CardHeader>
                  <CardTitle className="text-lg font-semibold text-slate-800 flex items-center">
                    <Database className="w-5 h-5 mr-2" />
                    Data & Storage
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                      <div>
                        <h4 className="text-sm font-medium text-slate-800">Vector Database</h4>
                        <p className="text-xs text-slate-500">Manage semantic search embeddings</p>
                      </div>
                      <Button variant="outline" size="sm" disabled>
                        Manage Vectors
                      </Button>
                    </div>
                    
                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                      <div>
                        <h4 className="text-sm font-medium text-slate-800">Export Data</h4>
                        <p className="text-xs text-slate-500">Download your documents and data</p>
                      </div>
                      <Button variant="outline" size="sm" disabled>
                        Export
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
