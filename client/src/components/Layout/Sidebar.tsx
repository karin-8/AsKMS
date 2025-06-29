import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Link, useLocation } from "wouter";
import {
  Home,
  FileText,
  Clock,
  Star,
  Share2,
  Bot,
  X,
  Upload,
  Search,
  Settings,
  FolderOpen,
  BarChart3,
  ChevronDown,
  MessageSquare,
  ChevronRight,
  Trophy,
} from "lucide-react";

interface SidebarProps {
  isMobileOpen: boolean;
  onMobileClose: () => void;
  onOpenChat: () => void;
}

export default function Sidebar({
  isMobileOpen,
  onMobileClose,
  onOpenChat,
}: SidebarProps) {
  const [location] = useLocation();
  const [isDashboardExpanded, setIsDashboardExpanded] = useState(false);

  const { data: categories = [] } = useQuery({
    queryKey: ["/api/categories"],
  }) as { data: Array<{ id: number; name: string; documentCount?: number }> };

  const { data: stats } = useQuery({
    queryKey: ["/api/stats"],
  }) as { data: { totalDocuments: number } | undefined };

  const categoryColors = [
    "bg-blue-500",
    "bg-green-500",
    "bg-purple-500",
    "bg-yellow-500",
    "bg-red-500",
    "bg-indigo-500",
  ];

  const isActiveRoute = (path: string) => location === path;
  const isDashboardActive = location.startsWith("/dashboards");

  // Auto-expand dashboard menu if user is on a dashboard route
  useEffect(() => {
    if (isDashboardActive) {
      setIsDashboardExpanded(true);
    }
  }, [isDashboardActive]);

  return (
    <>
      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={onMobileClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed lg:static inset-y-0 left-0 z-50 w-64 bg-white shadow-sm border-r border-gray-200 transition-transform duration-300 ease-in-out lg:translate-x-0",
          isMobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex flex-col h-full">
          {/* Mobile Close Button */}
          <div className="lg:hidden flex justify-end p-4">
            <Button variant="ghost" size="sm" onClick={onMobileClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>

          <div className="flex-1 px-4 py-6 space-y-6">
            {/* Navigation Menu */}
            <nav className="space-y-2">
              <Link href="/" onClick={onMobileClose}>
                <Button
                  variant="ghost"
                  className={cn(
                    "w-full justify-start",
                    isActiveRoute("/")
                      ? "bg-blue-50 text-blue-600 hover:bg-blue-100"
                      : "text-gray-600 hover:text-gray-900 hover:bg-gray-50",
                  )}
                >
                  <Home className="w-5 h-5 mr-3" />
                  <span>Home</span>
                </Button>
              </Link>

              <Link href="/documents" onClick={onMobileClose}>
                <Button
                  variant="ghost"
                  className={cn(
                    "w-full justify-start",
                    isActiveRoute("/documents")
                      ? "bg-blue-50 text-blue-600 hover:bg-blue-100"
                      : "text-gray-600 hover:text-gray-900 hover:bg-gray-50",
                  )}
                >
                  <FileText className="w-5 h-5 mr-3" />
                  <span>All Documents</span>
                  <Badge variant="secondary" className="ml-auto">
                    {stats?.totalDocuments || 0}
                  </Badge>
                </Button>
              </Link>

              <Link href="/categories" onClick={onMobileClose}>
                <Button
                  variant="ghost"
                  className={cn(
                    "w-full justify-start",
                    isActiveRoute("/categories")
                      ? "bg-blue-50 text-blue-600 hover:bg-blue-100"
                      : "text-gray-600 hover:text-gray-900 hover:bg-gray-50",
                  )}
                >
                  <FolderOpen className="w-5 h-5 mr-3" />
                  <span>Categories</span>
                </Button>
              </Link>

              <Link href="/achievements" onClick={onMobileClose}>
                <Button
                  variant="ghost"
                  className={cn(
                    "w-full justify-start",
                    isActiveRoute("/achievements")
                      ? "bg-blue-50 text-blue-600 hover:bg-blue-100"
                      : "text-gray-600 hover:text-gray-900 hover:bg-gray-50",
                  )}
                >
                  <Trophy className="w-5 h-5 mr-3" />
                  <span>Achievements</span>
                </Button>
              </Link>

              {/* Dashboard Menu with Expandable Sub-items */}
              <div className="space-y-1">
                <Button
                  variant="ghost"
                  className={cn(
                    "w-full justify-start",
                    isDashboardActive
                      ? "bg-blue-50 text-blue-600 hover:bg-blue-100"
                      : "text-gray-600 hover:text-gray-900 hover:bg-gray-50",
                  )}
                  onClick={() => setIsDashboardExpanded(!isDashboardExpanded)}
                >
                  <BarChart3 className="w-5 h-5 mr-3" />
                  <span>Dashboards</span>
                  {isDashboardExpanded ? (
                    <ChevronDown className="w-4 h-4 ml-auto" />
                  ) : (
                    <ChevronRight className="w-4 h-4 ml-auto" />
                  )}
                </Button>

                {isDashboardExpanded && (
                  <div className="ml-6 space-y-1">
                    <Link
                      href="/dashboards/document-usage"
                      onClick={onMobileClose}
                    >
                      <Button
                        variant="ghost"
                        size="sm"
                        className={cn(
                          "w-full justify-start text-sm",
                          isActiveRoute("/dashboards/document-usage")
                            ? "bg-blue-50 text-blue-600 hover:bg-blue-100"
                            : "text-gray-500 hover:text-gray-700 hover:bg-gray-50",
                        )}
                      >
                        Document Usage Overview
                      </Button>
                    </Link>

                    <Link
                      href="/dashboards/ai-interaction"
                      onClick={onMobileClose}
                    >
                      <Button
                        variant="ghost"
                        size="sm"
                        className={cn(
                          "w-full justify-start text-sm",
                          isActiveRoute("/dashboards/ai-interaction")
                            ? "bg-blue-50 text-blue-600 hover:bg-blue-100"
                            : "text-gray-500 hover:text-gray-700 hover:bg-gray-50",
                        )}
                      >
                        AI Agent Interaction
                      </Button>
                    </Link>

                    <Link
                      href="/dashboards/user-activity"
                      onClick={onMobileClose}
                    >
                      <Button
                        variant="ghost"
                        size="sm"
                        className={cn(
                          "w-full justify-start text-sm",
                          isActiveRoute("/dashboards/user-activity")
                            ? "bg-blue-50 text-blue-600 hover:bg-blue-100"
                            : "text-gray-500 hover:text-gray-700 hover:bg-gray-50",
                        )}
                      >
                        User Activity Monitoring
                      </Button>
                    </Link>

                    <Link
                      href="/dashboards/system-health"
                      onClick={onMobileClose}
                    >
                      <Button
                        variant="ghost"
                        size="sm"
                        className={cn(
                          "w-full justify-start text-sm",
                          isActiveRoute("/dashboards/system-health")
                            ? "bg-blue-50 text-blue-600 hover:bg-blue-100"
                            : "text-gray-500 hover:text-gray-700 hover:bg-gray-50",
                        )}
                      >
                        System Health & AI Performance
                      </Button>
                    </Link>

                    <Link
                      href="/dashboards/security-governance"
                      onClick={onMobileClose}
                    >
                      <Button
                        variant="ghost"
                        size="sm"
                        className={cn(
                          "w-full justify-start text-sm",
                          isActiveRoute("/dashboards/security-governance")
                            ? "bg-blue-50 text-blue-600 hover:bg-blue-100"
                            : "text-gray-500 hover:text-gray-700 hover:bg-gray-50",
                        )}
                      >
                        Security & Governance
                      </Button>
                    </Link>

                    <Link
                      href="/dashboards/customer-survey"
                      onClick={onMobileClose}
                    >
                      <Button
                        variant="ghost"
                        size="sm"
                        className={cn(
                          "w-full justify-start text-sm",
                          isActiveRoute("/dashboards/customer-survey")
                            ? "bg-blue-50 text-blue-600 hover:bg-blue-100"
                            : "text-gray-500 hover:text-gray-700 hover:bg-gray-50",
                        )}
                      >
                        Customer Survey
                      </Button>
                    </Link>
                  </div>
                )}
              </div>

              <Link href="/settings" onClick={onMobileClose}>
                <Button
                  variant="ghost"
                  className={cn(
                    "w-full justify-start",
                    isActiveRoute("/settings")
                      ? "bg-blue-50 text-blue-600 hover:bg-blue-100"
                      : "text-gray-600 hover:text-gray-900 hover:bg-gray-50",
                  )}
                >
                  <Settings className="w-5 h-5 mr-3" />
                  <span>Settings</span>
                </Button>
              </Link>

              <Link href="/survey" onClick={onMobileClose}>
                <Button
                  variant="ghost"
                  className={cn(
                    "w-full justify-start",
                    isActiveRoute("/survey")
                      ? "bg-blue-50 text-blue-600 hover:bg-blue-100"
                      : "text-gray-600 hover:text-gray-900 hover:bg-gray-50",
                  )}
                >
                  <Bot className="w-5 h-5 mr-3" />
                  <span>Survey</span>
                </Button>
              </Link>
            </nav>

            {/* AI Assistant */}
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4">
              <div className="flex items-center space-x-3 mb-2">
                <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                  <Bot className="w-4 h-4 text-white" />
                </div>
                <h4 className="font-medium text-gray-900">AI Assistant</h4>
              </div>
              <p className="text-sm text-gray-600 mb-3">
                Ask questions about your documents
              </p>
              <Button
                className="w-full bg-blue-500 text-white hover:bg-blue-600"
                onClick={onOpenChat}
              >
                Start Chat
              </Button>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
