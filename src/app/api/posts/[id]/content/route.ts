import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

interface SaveContentBody {
  post_id: string;
  content_type: string;
  content: string;
  name?: string;
  description?: string;
  environment?: string;
  prompt_count?: number;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = (await request.json()) as SaveContentBody;

    if (!body.content_type || !body.content) {
      return NextResponse.json(
        { error: "content_type and content are required" },
        { status: 400 }
      );
    }

    const supabase = await createServiceClient();

    // Get the max version for this post_id + content_type
    const { data: existing } = await supabase
      .from("nate_post_content")
      .select("version")
      .eq("post_id", id)
      .eq("content_type", body.content_type)
      .order("version", { ascending: false })
      .limit(1);

    const nextVersion = existing && existing.length > 0 ? existing[0].version + 1 : 1;

    const { data: newContent, error } = await supabase
      .from("nate_post_content")
      .insert({
        post_id: id,
        content_type: body.content_type,
        version: nextVersion,
        content: body.content,
        name: body.name || null,
        description: body.description || null,
        environment: body.environment || null,
        prompt_count: body.prompt_count || null,
      })
      .select()
      .single();

    if (error) {
      console.error("Failed to save content:", error);
      return NextResponse.json(
        { error: "Failed to save content" },
        { status: 500 }
      );
    }

    return NextResponse.json({ content: newContent }, { status: 201 });
  } catch (error) {
    console.error("Content POST error:", error);
    return NextResponse.json(
      { error: "Failed to save content" },
      { status: 500 }
    );
  }
}
