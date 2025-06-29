import { db } from "./db";
import { achievements } from "@shared/schema";

export async function seedAchievements() {
  try {
    // Check if achievements already exist
    const existingAchievements = await db.select().from(achievements);
    if (existingAchievements.length > 0) {
      console.log("Achievements already seeded");
      return;
    }

    const achievementsData = [
      // Document Reading Achievements
      {
        name: "First Reader",
        description: "Read your first document",
        type: "document_read",
        category: "beginner",
        icon: "BookOpen",
        color: "blue",
        pointsRequired: 1,
        level: 1
      },
      {
        name: "Knowledge Seeker",
        description: "Read 10 documents",
        type: "document_read",
        category: "intermediate",
        icon: "Library",
        color: "purple",
        pointsRequired: 10,
        level: 2
      },
      {
        name: "Information Master",
        description: "Read 50 documents",
        type: "document_read",
        category: "advanced",
        icon: "GraduationCap",
        color: "gold",
        pointsRequired: 50,
        level: 3
      },

      // Search Achievements
      {
        name: "Curious Explorer",
        description: "Perform your first search",
        type: "search",
        category: "beginner",
        icon: "Search",
        color: "green",
        pointsRequired: 1,
        level: 1
      },
      {
        name: "Search Specialist",
        description: "Perform 25 searches",
        type: "search",
        category: "intermediate",
        icon: "Zap",
        color: "orange",
        pointsRequired: 25,
        level: 2
      },
      {
        name: "Research Expert",
        description: "Perform 100 searches",
        type: "search",
        category: "advanced",
        icon: "Target",
        color: "red",
        pointsRequired: 100,
        level: 3
      },

      // Chat Achievements
      {
        name: "First Conversation",
        description: "Start your first AI chat",
        type: "chat",
        category: "beginner",
        icon: "MessageCircle",
        color: "cyan",
        pointsRequired: 1,
        level: 1
      },
      {
        name: "Chat Enthusiast",
        description: "Have 20 AI conversations",
        type: "chat",
        category: "intermediate",
        icon: "MessageSquare",
        color: "indigo",
        pointsRequired: 20,
        level: 2
      },
      {
        name: "AI Collaborator",
        description: "Have 100 AI conversations",
        type: "chat",
        category: "advanced",
        icon: "Bot",
        color: "violet",
        pointsRequired: 100,
        level: 3
      },

      // Feedback Achievements
      {
        name: "Helpful Contributor",
        description: "Provide your first feedback",
        type: "feedback",
        category: "beginner",
        icon: "ThumbsUp",
        color: "lime",
        pointsRequired: 1,
        level: 1
      },
      {
        name: "Quality Reviewer",
        description: "Provide 10 pieces of feedback",
        type: "feedback",
        category: "intermediate",
        icon: "Star",
        color: "yellow",
        pointsRequired: 10,
        level: 2
      },
      {
        name: "Community Builder",
        description: "Provide 50 pieces of feedback",
        type: "feedback",
        category: "advanced",
        icon: "Award",
        color: "amber",
        pointsRequired: 50,
        level: 3
      },

      // Favorite Achievements
      {
        name: "Bookmark Beginner",
        description: "Add your first favorite",
        type: "favorite",
        category: "beginner",
        icon: "Heart",
        color: "pink",
        pointsRequired: 1,
        level: 1
      },
      {
        name: "Collection Curator",
        description: "Add 15 favorites",
        type: "favorite",
        category: "intermediate",
        icon: "Bookmark",
        color: "rose",
        pointsRequired: 15,
        level: 2
      },
      {
        name: "Knowledge Collector",
        description: "Add 50 favorites",
        type: "favorite",
        category: "advanced",
        icon: "FolderHeart",
        color: "fuchsia",
        pointsRequired: 50,
        level: 3
      },

      // Streak Achievements
      {
        name: "Daily User",
        description: "Use the system for 3 consecutive days",
        type: "streak",
        category: "beginner",
        icon: "Calendar",
        color: "emerald",
        pointsRequired: 3,
        level: 1
      },
      {
        name: "Dedicated Learner",
        description: "Use the system for 7 consecutive days",
        type: "streak",
        category: "intermediate",
        icon: "CalendarDays",
        color: "teal",
        pointsRequired: 7,
        level: 2
      },
      {
        name: "Knowledge Champion",
        description: "Use the system for 30 consecutive days",
        type: "streak",
        category: "advanced",
        icon: "Trophy",
        color: "sky",
        pointsRequired: 30,
        level: 3
      },

      // Points Achievements
      {
        name: "Point Collector",
        description: "Earn your first 100 points",
        type: "points",
        category: "beginner",
        icon: "Coins",
        color: "slate",
        pointsRequired: 100,
        level: 1
      },
      {
        name: "High Achiever",
        description: "Earn 1000 points",
        type: "points",
        category: "intermediate",
        icon: "Medal",
        color: "zinc",
        pointsRequired: 1000,
        level: 2
      },
      {
        name: "Legend",
        description: "Earn 5000 points",
        type: "points",
        category: "advanced",
        icon: "Crown",
        color: "neutral",
        pointsRequired: 5000,
        level: 3
      },

      // Special Achievements
      {
        name: "Early Adopter",
        description: "One of the first users to join",
        type: "special",
        category: "special",
        icon: "Sparkles",
        color: "rainbow",
        pointsRequired: 1,
        level: 1
      },
      {
        name: "Power User",
        description: "Use all major features in one day",
        type: "special",
        category: "special",
        icon: "Flame",
        color: "gradient",
        pointsRequired: 1,
        level: 3
      }
    ];

    await db.insert(achievements).values(achievementsData);
    console.log(`✅ Seeded ${achievementsData.length} achievements`);
  } catch (error) {
    console.error("Error seeding achievements:", error);
  }
}

// Run the seed function if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedAchievements().then(() => {
    console.log("Seeding completed");
    process.exit(0);
  }).catch((error) => {
    console.error("Seeding failed:", error);
    process.exit(1);
  });
}