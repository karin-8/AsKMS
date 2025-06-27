import { useState } from "react";
import { useLocation } from "wouter";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Home,
  Upload,
  FolderOpen,
  Search,
  MessageSquare,
  Calendar,
  Settings,
  Database,
  Tags,
  Users,
  BarChart3,
  Menu,
  X,
  BookType,
  ChevronRight,
  Building2,
  Shield,
  Activity,
  UserCog,
  ChevronDown,
  Bot,
  TrendingUp,
} from "lucide-react";
import kingPowerLogo from "@assets/kingpower_1750867302870.webp";

interface SidebarProps {
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
  onOpenChat?: () => void;
}

const navigation = [
  { name: "Home", href: "/", icon: Home },
  { name: "Upload Documents", href: "/upload", icon: Upload },
  { name: "My Documents", href: "/documents", icon: FolderOpen },
  { name: "Search & Discovery", href: "/search", icon: Search },
  { name: "AI Assistant", href: "/ai-assistant", icon: MessageSquare },
  { name: "Meeting Notes", href: "/meeting-notes", icon: Calendar },
  { name: "Integrations", href: "/integrations", icon: Database },
  { name: "Categories & Tags", href: "/categories", icon: Tags },
];

const dashboardMenus = [
  { name: "AI Interaction", href: "/dashboards/ai-interaction", icon: Bot },
  { name: "Customer Survey", href: "/dashboards/customer-survey", icon: TrendingUp },
];

const adminNavigation = [
  { name: "Admin Panel", href: "/admin", icon: Shield },
  { name: "User Management", href: "/user-management", icon: UserCog },
  { name: "Live Chat Widget", href: "/live-chat-widget", icon: MessageSquare },
  { name: "Survey", href: "/survey", icon: BarChart3 },
  { name: "Audit Monitoring", href: "/audit-monitoring", icon: Activity },
  {
    name: "Document Demand Insights",
    href: "/document-demand-insights",
    icon: BarChart3,
  },
  { name: "Settings", href: "/settings", icon: Settings },
];

export default function Sidebar({
  isMobileOpen,
  onMobileClose,
  onOpenChat,
}: SidebarProps = {}) {
  const [location] = useLocation();
  const [isDashboardsOpen, setIsDashboardsOpen] = useState(false);

  return (
    <div className="w-64 bg-white border-r border-slate-200 flex flex-col">
      {/* King Power Logo */}
      <div className="p-6 flex justify-center">
        <img
          src={kingPowerLogo}
          alt="King Power"
          className="w-48 h-auto object-contain"
        />
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        {navigation.map((item) => {
          const isActive = location === item.href;
          return (
            <Link key={item.name} href={item.href}>
              <span
                className={cn(
                  "flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer",
                  isActive
                    ? "bg-primary text-white"
                    : "text-slate-700 hover:bg-slate-100",
                )}
              >
                <item.icon className="w-4 h-4" />
                <span>{item.name}</span>
              </span>
            </Link>
          );
        })}

        {/* Dashboards Section with Submenu */}
        <div className="space-y-1">
          <button
            onClick={() => setIsDashboardsOpen(!isDashboardsOpen)}
            className="w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-slate-700 hover:bg-slate-100"
          >
            <BarChart3 className="w-4 h-4" />
            <span>Dashboards</span>
            {isDashboardsOpen ? (
              <ChevronDown className="w-4 h-4 ml-auto" />
            ) : (
              <ChevronRight className="w-4 h-4 ml-auto" />
            )}
          </button>

          {isDashboardsOpen && (
            <div className="ml-6 space-y-1">
              {dashboardMenus.map((item) => {
                const isActive = location === item.href;
                return (
                  <Link key={item.name} href={item.href}>
                    <span
                      className={cn(
                        "flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer",
                        isActive
                          ? "bg-primary text-white"
                          : "text-slate-700 hover:bg-slate-100",
                      )}
                    >
                      <item.icon className="w-4 h-4" />
                      <span>{item.name}</span>
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Admin Section */}
        <div className="pt-6 mt-6 border-t border-slate-200">
          <div className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Administration
          </div>
          {adminNavigation.map((item) => {
            const isActive = location === item.href;
            return (
              <Link key={item.name} href={item.href}>
                <span
                  className={cn(
                    "flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer",
                    isActive
                      ? "bg-primary text-white"
                      : "text-slate-700 hover:bg-slate-100",
                  )}
                >
                  <item.icon className="w-4 h-4" />
                  <span>{item.name}</span>
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
