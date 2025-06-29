import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trophy, Medal, Crown, Star, Target, Zap, BookOpen, Heart, MessageCircle, Search, Flame, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

// Icon mapping
const iconMap: Record<string, any> = {
  BookOpen, Trophy, Medal, Crown, Star, Target, Zap, Heart, MessageCircle, Search, Flame, Sparkles,
  Library: BookOpen,
  GraduationCap: Trophy,
  ThumbsUp: Star,
  Award: Crown,
  Bookmark: Heart,
  FolderHeart: Heart,
  Calendar: Target,
  CalendarDays: Target,
  Coins: Medal,
  Bot: MessageCircle
};

// Color mapping
const colorMap: Record<string, string> = {
  blue: "bg-blue-500",
  purple: "bg-purple-500", 
  gold: "bg-yellow-500",
  green: "bg-green-500",
  orange: "bg-orange-500",
  red: "bg-red-500",
  cyan: "bg-cyan-500",
  indigo: "bg-indigo-500",
  violet: "bg-violet-500",
  lime: "bg-lime-500",
  yellow: "bg-yellow-500",
  amber: "bg-amber-500",
  pink: "bg-pink-500",
  rose: "bg-rose-500",
  fuchsia: "bg-fuchsia-500",
  emerald: "bg-emerald-500",
  teal: "bg-teal-500",
  sky: "bg-sky-500",
  slate: "bg-slate-500",
  zinc: "bg-zinc-500",
  neutral: "bg-neutral-500",
  rainbow: "bg-gradient-to-r from-red-500 via-yellow-500 to-blue-500",
  gradient: "bg-gradient-to-r from-purple-500 to-pink-500"
};

export default function Achievements() {
  const [selectedCategory, setSelectedCategory] = useState("all");

  // Fetch all achievements
  const { data: achievements = [], isLoading: achievementsLoading } = useQuery({
    queryKey: ["/api/achievements"]
  });

  // Fetch user achievements
  const { data: userAchievements = [], isLoading: userAchievementsLoading } = useQuery({
    queryKey: ["/api/achievements/user"]
  });

  // Fetch user stats
  const { data: userStats, isLoading: statsLoading } = useQuery({
    queryKey: ["/api/achievements/stats"]
  });

  // Fetch leaderboard
  const { data: leaderboard = [], isLoading: leaderboardLoading } = useQuery({
    queryKey: ["/api/achievements/leaderboard"]
  });

  const isLoading = achievementsLoading || userAchievementsLoading || statsLoading;

  // Create a map of unlocked achievements
  const unlockedAchievements = new Set(userAchievements.map((ua: any) => ua.achievementId));

  // Filter achievements by category
  const filteredAchievements = achievements.filter((achievement: any) => 
    selectedCategory === "all" || achievement.category === selectedCategory
  );

  // Group achievements by category
  const achievementsByCategory = achievements.reduce((acc: any, achievement: any) => {
    if (!acc[achievement.category]) {
      acc[achievement.category] = [];
    }
    acc[achievement.category].push(achievement);
    return acc;
  }, {});

  const categories = ["all", ...Object.keys(achievementsByCategory)];

  // Calculate progress for each achievement type
  const getProgress = (achievement: any) => {
    if (!userStats) return 0;
    
    let current = 0;
    switch (achievement.type) {
      case 'document_read':
        current = userStats.documentsRead || 0;
        break;
      case 'search':
        current = userStats.searchesPerformed || 0;
        break;
      case 'chat':
        current = userStats.chatInteractions || 0;
        break;
      case 'feedback':
        current = userStats.feedbackProvided || 0;
        break;
      case 'favorite':
        current = userStats.favoritesAdded || 0;
        break;
      case 'streak':
        current = userStats.longestStreak || 0;
        break;
      case 'points':
        current = userStats.totalPoints || 0;
        break;
      default:
        current = 0;
    }
    
    return Math.min(100, (current / achievement.pointsRequired) * 100);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-48 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Achievements</h1>
          <p className="text-gray-600">Track your learning progress and unlock rewards</p>
        </div>
        
        {userStats && (
          <Card className="w-64">
            <CardContent className="p-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{userStats.totalPoints}</div>
                <div className="text-sm text-gray-500">Total Points</div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <Tabs defaultValue="achievements" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="achievements">Achievements</TabsTrigger>
          <TabsTrigger value="stats">Statistics</TabsTrigger>
          <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
        </TabsList>

        <TabsContent value="achievements" className="space-y-6">
          {/* Category Filter */}
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <Badge
                key={category}
                variant={selectedCategory === category ? "default" : "outline"}
                className="cursor-pointer capitalize"
                onClick={() => setSelectedCategory(category)}
              >
                {category}
              </Badge>
            ))}
          </div>

          {/* Achievements Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredAchievements.map((achievement: any) => {
              const isUnlocked = unlockedAchievements.has(achievement.id);
              const progress = getProgress(achievement);
              const IconComponent = iconMap[achievement.icon] || Star;
              const colorClass = colorMap[achievement.color] || "bg-gray-500";

              return (
                <Card 
                  key={achievement.id} 
                  className={cn(
                    "relative overflow-hidden transition-all duration-200",
                    isUnlocked 
                      ? "ring-2 ring-yellow-400 shadow-lg transform scale-105" 
                      : "hover:shadow-md"
                  )}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className={cn(
                        "w-12 h-12 rounded-full flex items-center justify-center text-white",
                        colorClass
                      )}>
                        <IconComponent className="w-6 h-6" />
                      </div>
                      
                      {isUnlocked && (
                        <Trophy className="w-6 h-6 text-yellow-500 fill-yellow-400" />
                      )}
                    </div>
                    
                    <div>
                      <CardTitle className={cn(
                        "text-lg",
                        isUnlocked ? "text-gray-900" : "text-gray-600"
                      )}>
                        {achievement.name}
                      </CardTitle>
                      <CardDescription className="text-sm">
                        {achievement.description}
                      </CardDescription>
                    </div>
                  </CardHeader>

                  <CardContent className="pt-0">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">Progress</span>
                        <span className="font-medium">
                          {Math.floor(progress)}%
                        </span>
                      </div>
                      
                      <Progress 
                        value={progress} 
                        className="h-2"
                      />
                      
                      <div className="flex items-center justify-between text-sm">
                        <Badge variant="outline" className="capitalize">
                          {achievement.category}
                        </Badge>
                        <span className="text-gray-500">
                          Level {achievement.level}
                        </span>
                      </div>
                    </div>
                  </CardContent>

                  {isUnlocked && (
                    <div className="absolute top-0 right-0 w-0 h-0 border-l-[60px] border-l-transparent border-t-[60px] border-t-yellow-400">
                      <div className="absolute -top-12 -right-1 text-white text-xs font-bold rotate-45">
                        ✓
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="stats" className="space-y-6">
          {userStats && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-500">Documents Read</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-600">{userStats.documentsRead}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-500">Searches Performed</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">{userStats.searchesPerformed}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-500">Chat Interactions</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-purple-600">{userStats.chatInteractions}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-500">Current Streak</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-orange-600">{userStats.currentStreak} days</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-500">Feedback Provided</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-pink-600">{userStats.feedbackProvided}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-500">Favorites Added</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">{userStats.favoritesAdded}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-500">Longest Streak</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-indigo-600">{userStats.longestStreak} days</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-500">Total Points</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-yellow-600">{userStats.totalPoints}</div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="leaderboard" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Top Performers</CardTitle>
              <CardDescription>See how you rank among other users</CardDescription>
            </CardHeader>
            <CardContent>
              {leaderboardLoading ? (
                <div className="space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="animate-pulse flex items-center space-x-4">
                      <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
                      <div className="flex-1 h-4 bg-gray-200 rounded"></div>
                      <div className="w-16 h-4 bg-gray-200 rounded"></div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  {leaderboard.map((user: any, index: number) => (
                    <div key={user.userId} className="flex items-center justify-between p-3 rounded-lg border">
                      <div className="flex items-center space-x-4">
                        <div className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center font-bold text-white",
                          index === 0 ? "bg-yellow-500" :
                          index === 1 ? "bg-gray-400" :
                          index === 2 ? "bg-amber-600" :
                          "bg-gray-300"
                        )}>
                          {index + 1}
                        </div>
                        <div>
                          <div className="font-medium">{user.userName}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-blue-600">{user.totalPoints}</div>
                        <div className="text-sm text-gray-500">points</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}