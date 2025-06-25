import type { Express } from "express";
import { isAuthenticated } from "./replitAuth";

export function registerAnalyticsRoutes(app: Express) {
  // Search patterns analytics for Document Demand Analysis
  app.get('/api/analytics/search-patterns', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Generate mock search analytics data
      // In a real implementation, this would query the searchSessions table
      const mockData = {
        popularQueries: [
          { query: "financial reports", count: 45, trend: "up" },
          { query: "user manual", count: 32, trend: "stable" },
          { query: "meeting notes", count: 28, trend: "down" },
          { query: "project documents", count: 25, trend: "up" },
          { query: "technical specs", count: 20, trend: "stable" }
        ],
        searchTypes: {
          semantic: 65,
          keyword: 25,
          hybrid: 10
        },
        dailyStats: Array.from({ length: 14 }, (_, i) => {
          const date = new Date();
          date.setDate(date.getDate() - (13 - i));
          return {
            date: date.toISOString().split('T')[0],
            searches: Math.floor(Math.random() * 50) + 10,
            uniqueUsers: Math.floor(Math.random() * 20) + 5
          };
        })
      };

      res.json(mockData);
    } catch (error) {
      console.error("Error fetching search patterns:", error);
      res.status(500).json({ message: "Failed to fetch search patterns" });
    }
  });
}