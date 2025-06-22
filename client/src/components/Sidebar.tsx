import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
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
} from "lucide-react";

const navigation = [
  { name: "Dashboard", href: "/", icon: Home },
  { name: "Upload Documents", href: "/upload", icon: Upload },
  { name: "My Documents", href: "/documents", icon: FolderOpen },
  { name: "Search & Discovery", href: "/search", icon: Search },
  { name: "AI Assistant", href: "/ai-assistant", icon: MessageSquare },
  { name: "Integrations", href: "/integrations", icon: Building },
  { name: "Categories & Tags", href: "/categories", icon: Tags },
  { name: "User Management", href: "/users", icon: Users },
  { name: "Live Chat Widget", href: "/live-chat-widget", icon: MessageSquare },
  { name: "Settings", href: "/settings", icon: Settings },
];

export default function Sidebar() {
  const [location] = useLocation();

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
