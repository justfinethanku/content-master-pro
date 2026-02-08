import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createServiceClient();

    const { data: posts, error } = await supabase
      .from("nate_posts")
      .select("*")
      .order("post_number", { ascending: false });

    if (error) {
      console.error("Failed to fetch posts:", error);
      return NextResponse.json({ error: "Failed to fetch posts" }, { status: 500 });
    }

    // For each post, get the latest post version and check if prompt_pack exists
    const postsWithMeta = await Promise.all(
      (posts || []).map(async (post) => {
        const { data: content } = await supabase
          .from("nate_post_content")
          .select("content_type, version")
          .eq("post_id", post.id)
          .order("version", { ascending: false });

        const postVersions = (content || []).filter((c) => c.content_type === "post");
        const hasPromptPack = (content || []).some((c) => c.content_type === "prompt_pack");
        const latestPostVersion = postVersions.length > 0 ? postVersions[0].version : 0;

        return {
          ...post,
          latest_post_version: latestPostVersion,
          has_prompt_pack: hasPromptPack,
        };
      })
    );

    return NextResponse.json({ posts: postsWithMeta });
  } catch (error) {
    console.error("Posts GET error:", error);
    return NextResponse.json({ error: "Failed to fetch posts" }, { status: 500 });
  }
}

interface CreatePostBody {
  title: string;
  slug?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CreatePostBody;

    if (!body.title || body.title.trim().length === 0) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    const supabase = await createServiceClient();

    // Generate slug from title if not provided
    const slug =
      body.slug ||
      body.title
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .slice(0, 80);

    // Get next post_number
    const { data: maxPost } = await supabase
      .from("nate_posts")
      .select("post_number")
      .order("post_number", { ascending: false })
      .limit(1)
      .single();

    const nextNumber = (maxPost?.post_number || 0) + 1;

    const { data: newPost, error } = await supabase
      .from("nate_posts")
      .insert({
        title: body.title.trim(),
        slug,
        post_number: nextNumber,
        status: "draft",
        batch_date: new Date().toISOString().split("T")[0],
      })
      .select()
      .single();

    if (error) {
      console.error("Failed to create post:", error);
      return NextResponse.json({ error: "Failed to create post" }, { status: 500 });
    }

    return NextResponse.json({ post: newPost }, { status: 201 });
  } catch (error) {
    console.error("Posts POST error:", error);
    return NextResponse.json({ error: "Failed to create post" }, { status: 500 });
  }
}
