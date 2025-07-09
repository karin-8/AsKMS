import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  ExternalLink,
  Eye,
  MessageSquare,
  Clock,
  User,
  Filter,
  Activity,
} from "lucide-react";
import { format, isValid, parseISO } from "date-fns";

interface EventTrackingData {
  id: number;
  eventType: "image_click" | "url_redirect" | "message_open";
  userId: string;
  channelType: string;
  channelId: string;
  agentId: number;
  agentName?: string;
  messageId?: number;
  targetUrl?: string;
  imageUrl?: string;
  userAgent?: string;
  ipAddress?: string;
  referrer?: string;
  metadata?: any;
  createdAt: Date;
}

const safeFormatDate = (
  dateStr: string | null | undefined,
  formatStr: string = "MMM dd, HH:mm"
): string => {
  if (!dateStr) return "N/A";

  try {
    const date =
      typeof dateStr === "string" ? parseISO(dateStr) : new Date(dateStr);
    if (isValid(date)) {
      return format(date, formatStr);
    }
  } catch (error) {
    console.warn("Date formatting error:", error, dateStr);
  }

  return "Invalid Date";
};

export default function EventTracking() {
  const [eventTypeFilter, setEventTypeFilter] = useState<string>("all");
  const [channelFilter, setChannelFilter] = useState<string>("all");

  // Fetch event tracking data
  const { data: eventData, isLoading } = useQuery({
    queryKey: ["/api/event-tracking", eventTypeFilter, channelFilter],
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  const events: EventTrackingData[] = eventData || [];

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case "image_click":
        return <Eye className="w-4 h-4 text-blue-600" />;
      case "url_redirect":
        return <ExternalLink className="w-4 h-4 text-green-600" />;
      case "message_open":
        return <MessageSquare className="w-4 h-4 text-purple-600" />;
      default:
        return <Activity className="w-4 h-4 text-gray-600" />;
    }
  };

  const getEventBadge = (eventType: string) => {
    switch (eventType) {
      case "image_click":
        return <Badge variant="secondary" className="bg-blue-100 text-blue-800">Image Click</Badge>;
      case "url_redirect":
        return <Badge variant="secondary" className="bg-green-100 text-green-800">URL Redirect</Badge>;
      case "message_open":
        return <Badge variant="secondary" className="bg-purple-100 text-purple-800">Message Open</Badge>;
      default:
        return <Badge variant="outline">{eventType}</Badge>;
    }
  };

  const getChannelIcon = (channelType: string) => {
    switch (channelType) {
      case "lineoa":
        return <MessageSquare className="w-4 h-4 text-green-600" />;
      case "facebook":
        return <MessageSquare className="w-4 h-4 text-blue-600" />;
      case "tiktok":
        return <MessageSquare className="w-4 h-4 text-pink-600" />;
      default:
        return <MessageSquare className="w-4 h-4 text-gray-600" />;
    }
  };

  const filteredEvents = events.filter((event) => {
    if (eventTypeFilter !== "all" && event.eventType !== eventTypeFilter) {
      return false;
    }
    if (channelFilter !== "all" && event.channelType !== channelFilter) {
      return false;
    }
    return true;
  });

  // Calculate summary statistics
  const stats = {
    totalEvents: filteredEvents.length,
    imageClicks: filteredEvents.filter(e => e.eventType === "image_click").length,
    urlRedirects: filteredEvents.filter(e => e.eventType === "url_redirect").length,
    messageOpens: filteredEvents.filter(e => e.eventType === "message_open").length,
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Event Tracking</h1>
        <p className="text-gray-600 mt-1">
          Monitor user interactions with images and URL redirects sent by human agents
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Activity className="w-5 h-5 text-gray-600" />
              <div>
                <p className="text-sm text-gray-600">Total Events</p>
                <p className="text-2xl font-semibold">{stats.totalEvents}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Eye className="w-5 h-5 text-blue-600" />
              <div>
                <p className="text-sm text-gray-600">Image Clicks</p>
                <p className="text-2xl font-semibold text-blue-600">{stats.imageClicks}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <ExternalLink className="w-5 h-5 text-green-600" />
              <div>
                <p className="text-sm text-gray-600">URL Redirects</p>
                <p className="text-2xl font-semibold text-green-600">{stats.urlRedirects}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <MessageSquare className="w-5 h-5 text-purple-600" />
              <div>
                <p className="text-sm text-gray-600">Message Opens</p>
                <p className="text-2xl font-semibold text-purple-600">{stats.messageOpens}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Filter className="w-5 h-5" />
            <span>Filters</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex space-x-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Event Type</label>
              <Select value={eventTypeFilter} onValueChange={setEventTypeFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Events</SelectItem>
                  <SelectItem value="image_click">Image Clicks</SelectItem>
                  <SelectItem value="url_redirect">URL Redirects</SelectItem>
                  <SelectItem value="message_open">Message Opens</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Channel</label>
              <Select value={channelFilter} onValueChange={setChannelFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Channels</SelectItem>
                  <SelectItem value="lineoa">Line OA</SelectItem>
                  <SelectItem value="facebook">Facebook</SelectItem>
                  <SelectItem value="tiktok">TikTok</SelectItem>
                  <SelectItem value="web">Web</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Events Table */}
      <Card>
        <CardHeader>
          <CardTitle>Event Details</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filteredEvents.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              No events found matching the current filters.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Event</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Channel</TableHead>
                  <TableHead>Agent</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>IP Address</TableHead>
                  <TableHead>Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEvents.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        {getEventIcon(event.eventType)}
                        {getEventBadge(event.eventType)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <User className="w-4 h-4 text-gray-500" />
                        <span className="text-sm">{event.userId.slice(-4)}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        {getChannelIcon(event.channelType)}
                        <span className="text-sm capitalize">{event.channelType}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">
                        {event.agentName || `Agent ${event.agentId}`}
                      </span>
                    </TableCell>
                    <TableCell>
                      {event.targetUrl ? (
                        <a
                          href={event.targetUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline text-sm max-w-xs truncate inline-block"
                        >
                          {event.targetUrl}
                        </a>
                      ) : event.imageUrl ? (
                        <span className="text-sm text-gray-600">Image</span>
                      ) : (
                        <span className="text-sm text-gray-400">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-gray-600">
                        {event.ipAddress || "-"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-1 text-sm text-gray-600">
                        <Clock className="w-3 h-3" />
                        <span>{safeFormatDate(event.createdAt, "MMM dd, HH:mm")}</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}