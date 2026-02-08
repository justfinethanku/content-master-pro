"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  FileEdit,
  Plus,
  Loader2,
  Package,
  ChevronRight,
} from "lucide-react";

interface PostSummary {
  id: string;
  title: string;
  slug: string;
  post_number: number;
  status: string;
  batch_date: string;
  latest_post_version: number;
  has_prompt_pack: boolean;
}

export default function PostsPage() {
  const router = useRouter();
  const [posts, setPosts] = useState<PostSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");

  useEffect(() => {
    fetchPosts();
  }, []);

  async function fetchPosts() {
    try {
      const res = await fetch("/api/posts");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setPosts(data.posts);
    } catch {
      setError("Failed to load posts");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    if (!newTitle.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle.trim() }),
      });
      if (!res.ok) throw new Error("Failed to create");
      const data = await res.json();
      router.push(`/posts/${data.post.slug}`);
    } catch {
      setError("Failed to create post");
      setCreating(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Posts</h1>
          <p className="text-muted-foreground text-sm">
            Draft posts and companion prompt packs
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => setShowNewForm(true)}
          disabled={showNewForm}
        >
          <Plus className="h-4 w-4 mr-1" />
          New Post
        </Button>
      </div>

      {/* New post form */}
      {showNewForm && (
        <div className="flex items-center gap-2 p-4 bg-card border border-border rounded-lg">
          <Input
            placeholder="Post title..."
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreate();
              if (e.key === "Escape") {
                setShowNewForm(false);
                setNewTitle("");
              }
            }}
            autoFocus
            className="flex-1"
          />
          <Button
            size="sm"
            onClick={handleCreate}
            disabled={!newTitle.trim() || creating}
          >
            {creating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Create"
            )}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setShowNewForm(false);
              setNewTitle("");
            }}
          >
            Cancel
          </Button>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="text-center py-12">
          <p className="text-destructive">{error}</p>
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-12">
          <FileEdit className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <h3 className="font-medium text-foreground mb-1">No posts yet</h3>
          <p className="text-sm text-muted-foreground">
            Create your first post to get started
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {posts.map((post) => (
            <Link
              key={post.id}
              href={`/posts/${post.slug}`}
              className="flex items-center justify-between p-4 bg-card border border-border rounded-lg hover:border-primary/30 transition-colors group"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium text-foreground truncate">
                    {post.title}
                  </h3>
                </div>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-xs text-muted-foreground">
                    #{post.post_number}
                  </span>
                  {post.latest_post_version > 0 && (
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-primary/10 text-primary">
                      v{post.latest_post_version}
                    </span>
                  )}
                  {post.has_prompt_pack && (
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-green-500/10 text-green-700 dark:text-green-400 flex items-center gap-1">
                      <Package className="h-3 w-3" />
                      Prompts
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {post.batch_date}
                  </span>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors flex-shrink-0" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
