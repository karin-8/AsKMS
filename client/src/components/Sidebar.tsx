import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import {
  Home,
  Upload,
  FolderOpen,
  Search,
  MessageSquare,
  Tags,
  Users,
  Settings,
  Brain,
  BookType,
  Building,
  Video,
  Bot,
  BarChart3,
} from "lucide-react";

const allNavigation = [
  { name: "Home", href: "/", icon: Home, roles: ["admin", "user"] },
  // { name: "Upload Documents", href: "/upload", icon: Upload, roles: ["admin", "user"] },
  // { name: "My Documents", href: "/documents", icon: FolderOpen, roles: ["admin", "user"] },
  // { name: "Search & Discovery", href: "/search", icon: Search, roles: ["admin", "user"] },
  // { name: "AI Assistant", href: "/ai-assistant", icon: MessageSquare, roles: ["admin", "user"] },
  {
    name: "Meeting Notes",
    href: "/meeting-notes",
    icon: Video,
    roles: ["admin", "user"],
  },
  {
    name: "Agent Chatbots",
    href: "/agent-chatbots",
    icon: Bot,
    roles: ["admin", "user"],
  },
  {
    name: "Integrations",
    href: "/integrations",
    icon: Building,
    roles: ["admin", "user"],
  },
  {
    name: "Categories & Tags",
    href: "/categories",
    icon: Tags,
    roles: ["admin", "user"],
  },
  {
    name: "User Management",
    href: "/user-management",
    icon: Users,
    roles: ["admin"],
  },
  {
    name: "Role Management",
    href: "/role-management",
    icon: Users,
    roles: ["admin"],
  },
  {
    name: "Live Chat Widget",
    href: "/live-chat-widget",
    icon: MessageSquare,
    roles: ["admin"],
  },
  // {
  //   name: "User Feedback",
  //   href: "/user-feedback",
  //   icon: BarChart3,
  //   roles: ["admin"],
  // },
  { name: "Settings", href: "/settings", icon: Settings, roles: ["admin"] },
];

export default function Sidebar() {
  const [location] = useLocation();
  const { user } = useAuth();

  // Filter navigation based on user role - default to "user" role
  const userRole = (user as any)?.role || "user";
  const navigation = allNavigation.filter((item) => {
    return item.roles.includes(userRole);
  });

  return (
    <div className="w-64 bg-white border-r border-slate-200 flex flex-col">
      {/* Logo & Brand */}
      <div className="p-6 border-b border-slate-200">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <BookType className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-slate-800">
              4urney- AI-KMS
            </h1>
            <p className="text-xs text-slate-500">Knowledge Management</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        {navigation.map((item) => {
          const isActive = location === item.href;
          return (
            <Link key={item.name} href={item.href}>
              <a
                className={cn(
                  "flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-white"
                    : "text-slate-700 hover:bg-slate-100",
                )}
              >
                <item.icon className="w-4 h-4" />
                <span>{item.name}</span>
              </a>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
