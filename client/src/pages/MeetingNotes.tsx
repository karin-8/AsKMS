import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import Sidebar from "@/components/Sidebar";
import { MeetingItem } from "@/components/MeetingItem";
import { 
  Calendar,
  Clock,
  Users,
  FileText,
  Download,
  Copy,
  ExternalLink,
  AlertCircle,
  CheckCircle,
  RefreshCw
} from "lucide-react";

interface User {
  name: string;
  email: string;
  user_id: string;
}

interface Meeting {
  id: string;
  subject: string;
  start: {
    dateTime: string;
    timeZone: string;
  };
  end: {
    dateTime: string;
    timeZone: string;
  };
  attendees: Array<{
    emailAddress: {
      name: string;
      address: string;
    };
  }>;
  isOnlineMeeting: boolean;
  onlineMeetingProvider?: string;
}

interface MeetingNotes {
  meeting_id: string;
  notes: string;
  source: string;
  last_modified: string;
}

const TEAMS_API_BASE = "http://localhost:8000"; // Teams Meeting Notes API

export default function MeetingNotes() {
  const [user, setUser] = useState<User | null>(null);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const { toast } = useToast();

  // Check for auth token in URL on component mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    const authError = urlParams.get('error');
    
    if (token) {
      setAuthToken(token);
      localStorage.setItem('teams_auth_token', token);
      // Clean URL
      window.history.replaceState({}, document.title, "/meeting-notes");
      toast({
        title: "Authentication successful",
        description: "Connected to Microsoft Teams successfully.",
      });
    } else if (authError) {
      setError(`Authentication failed: ${authError}`);
      toast({
        title: "Authentication failed",
        description: `Error: ${authError}`,
        variant: "destructive",
      });
    } else {
      // Check localStorage for existing token
      const savedToken = localStorage.getItem('teams_auth_token');
      if (savedToken) {
        setAuthToken(savedToken);
      }
    }
  }, [toast]);

  // Fetch user info and meetings when authenticated
  useEffect(() => {
    if (authToken) {
      fetchUserInfo();
      fetchMeetings();
    }
  }, [authToken]);

  const fetchUserInfo = async () => {
    try {
      const response = await fetch(`${TEAMS_API_BASE}/api/user`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
      } else {
        throw new Error('Failed to fetch user info');
      }
    } catch (err) {
      console.error('Error fetching user info:', err);
      setError('Failed to fetch user information');
    }
  };

  const fetchMeetings = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${TEAMS_API_BASE}/api/meetings?limit=10`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setMeetings(data.meetings || []);
      } else {
        throw new Error('Failed to fetch meetings');
      }
    } catch (err) {
      console.error('Error fetching meetings:', err);
      setError('Failed to fetch meetings');
      toast({
        title: "Error",
        description: "Failed to fetch meetings from Microsoft Teams.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleMicrosoftLogin = async () => {
    setAuthLoading(true);
    try {
      const response = await fetch(`${TEAMS_API_BASE}/auth/login`);
      const data = await response.json();
      
      if (data.auth_url) {
        // Open Microsoft OAuth in popup
        const popup = window.open(
          data.auth_url,
          'microsoft-auth',
          'width=500,height=600,scrollbars=yes,resizable=yes'
        );

        // Monitor popup for completion
        const checkClosed = setInterval(() => {
          if (popup?.closed) {
            clearInterval(checkClosed);
            setAuthLoading(false);
            // Check if authentication was successful by looking for token
            const savedToken = localStorage.getItem('teams_auth_token');
            if (savedToken) {
              setAuthToken(savedToken);
            }
          }
        }, 1000);
      }
    } catch (err) {
      console.error('Error initiating Microsoft login:', err);
      setAuthLoading(false);
      toast({
        title: "Error",
        description: "Failed to initiate Microsoft login.",
        variant: "destructive",
      });
    }
  };

  const handleLogout = () => {
    setAuthToken(null);
    setUser(null);
    setMeetings([]);
    localStorage.removeItem('teams_auth_token');
    toast({
      title: "Logged out",
      description: "Successfully disconnected from Microsoft Teams.",
    });
  };

  const fetchMeetingNotes = async (meetingId: string): Promise<MeetingNotes | null> => {
    try {
      const response = await fetch(`${TEAMS_API_BASE}/api/meeting-notes/${meetingId}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        return await response.json();
      } else {
        throw new Error('Failed to fetch meeting notes');
      }
    } catch (err) {
      console.error('Error fetching meeting notes:', err);
      toast({
        title: "Error",
        description: "Failed to fetch meeting notes.",
        variant: "destructive",
      });
      return null;
    }
  };

  const exportToPdf = async (meeting: Meeting, notes: string) => {
    try {
      const response = await fetch(`${TEAMS_API_BASE}/api/export-notes`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          meeting_id: meeting.id,
          notes: notes,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        // Create download link
        const link = document.createElement('a');
        link.href = `data:application/pdf;base64,${data.pdf_base64}`;
        link.download = data.filename;
        link.click();
        
        toast({
          title: "Export successful",
          description: "Meeting notes exported to PDF.",
        });
      } else {
        throw new Error('Failed to export PDF');
      }
    } catch (err) {
      console.error('Error exporting PDF:', err);
      toast({
        title: "Error",
        description: "Failed to export meeting notes to PDF.",
        variant: "destructive",
      });
    }
  };

  const copyToClipboard = async (notes: string) => {
    try {
      await navigator.clipboard.writeText(notes);
      toast({
        title: "Copied to clipboard",
        description: "Meeting notes copied to clipboard.",
      });
    } catch (err) {
      console.error('Error copying to clipboard:', err);
      toast({
        title: "Error",
        description: "Failed to copy notes to clipboard.",
        variant: "destructive",
      });
    }
  };

  const formatDateTime = (dateTimeString: string) => {
    const date = new Date(dateTimeString);
    return {
      date: date.toLocaleDateString(),
      time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="flex">
        <Sidebar />
        
        <div className="flex-1 p-8">
          <div className="max-w-6xl mx-auto">
            {/* Header */}
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                Meeting Notes
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Access and manage your Microsoft Teams meeting notes
              </p>
            </div>

            {error && (
              <Alert className="mb-6" variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Authentication Section */}
            {!authToken ? (
              <Card className="mb-8">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ExternalLink className="h-5 w-5" />
                    Connect to Microsoft Teams
                  </CardTitle>
                  <CardDescription>
                    Sign in with your Microsoft account to access your Teams meetings and notes
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button 
                    onClick={handleMicrosoftLogin}
                    disabled={authLoading}
                    className="w-full sm:w-auto"
                  >
                    {authLoading ? (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        Connecting...
                      </>
                    ) : (
                      <>
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Sign in with Microsoft
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* User Info */}
                {user && (
                  <Card className="mb-8">
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-5 w-5 text-green-500" />
                          Connected to Microsoft Teams
                        </div>
                        <Button variant="outline" onClick={handleLogout}>
                          Disconnect
                        </Button>
                      </CardTitle>
                      <CardDescription>
                        Signed in as {user.name} ({user.email})
                      </CardDescription>
                    </CardHeader>
                  </Card>
                )}

                {/* Meetings Section */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-5 w-5" />
                        Recent Meetings
                      </div>
                      <Button 
                        variant="outline" 
                        onClick={fetchMeetings}
                        disabled={loading}
                      >
                        {loading ? (
                          <>
                            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                            Loading...
                          </>
                        ) : (
                          <>
                            <RefreshCw className="mr-2 h-4 w-4" />
                            Refresh
                          </>
                        )}
                      </Button>
                    </CardTitle>
                    <CardDescription>
                      Your last 10 Teams meetings with notes
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {loading ? (
                      <div className="space-y-4">
                        {[1, 2, 3].map((i) => (
                          <div key={i} className="animate-pulse">
                            <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                            <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                          </div>
                        ))}
                      </div>
                    ) : meetings.length > 0 ? (
                      <div className="space-y-4">
                        {meetings.map((meeting) => (
                          <MeetingItem
                            key={meeting.id}
                            meeting={meeting}
                            onFetchNotes={fetchMeetingNotes}
                            onExportPdf={exportToPdf}
                            onCopyToClipboard={copyToClipboard}
                            formatDateTime={formatDateTime}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                        <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No meetings found</p>
                        <p className="text-sm">Your recent Teams meetings will appear here</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}