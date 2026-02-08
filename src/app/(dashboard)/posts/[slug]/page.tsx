import { createServiceClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { PostViewer } from "./post-viewer";

interface PostContentRow {
  id: string;
  post_id: string;
  content_type: string;
  version: number;
  content: string;
  name: string | null;
  description: string | null;
  environment: string | null;
  prompt_count: number | null;
  created_at: string;
}

interface PostDetailPageProps {
  params: Promise<{ slug: string }>;
}

export default async function PostDetailPage({ params }: PostDetailPageProps) {
  const { slug } = await params;
  const supabase = await createServiceClient();

  // Fetch post by slug
  const { data: post, error: postError } = await supabase
    .from("nate_posts")
    .select("*")
    .eq("slug", slug)
    .single();

  if (postError || !post) {
    notFound();
  }

  // Fetch all content for this post
  const { data: contentRows } = await supabase
    .from("nate_post_content")
    .select("*")
    .eq("post_id", post.id)
    .order("content_type", { ascending: true })
    .order("version", { ascending: true });

  // Group by content_type
  const content: Record<string, PostContentRow[]> = {};
  for (const row of contentRows || []) {
    if (!content[row.content_type]) {
      content[row.content_type] = [];
    }
    content[row.content_type].push(row);
  }

  return (
    <PostViewer
      post={post}
      content={content}
    />
  );
}
