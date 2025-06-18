import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Brain, Upload, Search, MessageSquare, Shield, Zap } from "lucide-react";

export default function Landing() {
  const handleLogin = () => {
    window.location.href = "/api/login";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="container mx-auto px-4 py-16">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="flex items-center justify-center space-x-3 mb-6">
            <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center">
              <Brain className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-4xl font-bold text-slate-800">AI-KMS</h1>
          </div>
          <p className="text-xl text-slate-600 mb-8 max-w-2xl mx-auto">
            Intelligent Knowledge Management System powered by AI. Upload, classify, and discover your documents with ease.
          </p>
          <Button onClick={handleLogin} size="lg" className="px-8 py-3 text-lg">
            Get Started
          </Button>
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
          <Card className="border-2 border-slate-200 hover:border-primary/50 transition-colors">
            <CardHeader>
              <Upload className="w-8 h-8 text-primary mb-2" />
              <CardTitle>Smart Upload</CardTitle>
              <CardDescription>
                Bulk upload documents with automatic classification and tagging using AI
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-slate-600 space-y-1">
                <li>• Multiple file format support</li>
                <li>• Drag-and-drop interface</li>
                <li>• Auto-classification</li>
              </ul>
            </CardContent>
          </Card>

          <Card className="border-2 border-slate-200 hover:border-primary/50 transition-colors">
            <CardHeader>
              <Search className="w-8 h-8 text-primary mb-2" />
              <CardTitle>Semantic Search</CardTitle>
              <CardDescription>
                Find documents using natural language queries and semantic understanding
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-slate-600 space-y-1">
                <li>• Keyword & semantic search</li>
                <li>• Relevance scoring</li>
                <li>• Advanced filtering</li>
              </ul>
            </CardContent>
          </Card>

          <Card className="border-2 border-slate-200 hover:border-primary/50 transition-colors">
            <CardHeader>
              <MessageSquare className="w-8 h-8 text-primary mb-2" />
              <CardTitle>AI Assistant</CardTitle>
              <CardDescription>
                Chat with your knowledge base and get instant answers from your documents
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-slate-600 space-y-1">
                <li>• Natural language queries</li>
                <li>• Source citations</li>
                <li>• Context-aware responses</li>
              </ul>
            </CardContent>
          </Card>

          <Card className="border-2 border-slate-200 hover:border-primary/50 transition-colors">
            <CardHeader>
              <Shield className="w-8 h-8 text-primary mb-2" />
              <CardTitle>Access Control</CardTitle>
              <CardDescription>
                Manage user roles and document permissions with fine-grained access control
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-slate-600 space-y-1">
                <li>• Role-based permissions</li>
                <li>• Document-level access</li>
                <li>• User management</li>
              </ul>
            </CardContent>
          </Card>

          <Card className="border-2 border-slate-200 hover:border-primary/50 transition-colors">
            <CardHeader>
              <Zap className="w-8 h-8 text-primary mb-2" />
              <CardTitle>Vector Database</CardTitle>
              <CardDescription>
                Store document embeddings for lightning-fast semantic search and retrieval
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-slate-600 space-y-1">
                <li>• Document embeddings</li>
                <li>• Similarity search</li>
                <li>• Instant retrieval</li>
              </ul>
            </CardContent>
          </Card>

          <Card className="border-2 border-slate-200 hover:border-primary/50 transition-colors">
            <CardHeader>
              <Brain className="w-8 h-8 text-primary mb-2" />
              <CardTitle>Auto-Classification</CardTitle>
              <CardDescription>
                Automatically categorize and tag documents based on their content
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-slate-600 space-y-1">
                <li>• AI-powered categorization</li>
                <li>• Automatic tagging</li>
                <li>• Content analysis</li>
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* CTA */}
        <div className="text-center">
          <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
            <CardContent className="pt-6">
              <h2 className="text-2xl font-bold text-slate-800 mb-4">
                Ready to revolutionize your document management?
              </h2>
              <p className="text-slate-600 mb-6">
                Join thousands of users who have transformed their knowledge management with AI-KMS.
              </p>
              <Button onClick={handleLogin} size="lg" className="px-8 py-3">
                Start Your Journey
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
