/**
 * Routing Rules Config API
 *
 * GET /api/routing/config/rules - List rules
 * POST /api/routing/config/rules - Create rule
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getRoutingRules,
  createRoutingRule,
  reorderRoutingRules,
} from "@/lib/routing";
import type { RoutingRuleInsert } from "@/lib/routing";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const activeOnly = searchParams.get("active") === "true";

    const rules = await getRoutingRules(supabase, { activeOnly });

    return NextResponse.json({ rules });
  } catch (error) {
    console.error("Get rules error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get rules" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    // Handle reorder request
    if (body.reorder && Array.isArray(body.rule_ids)) {
      await reorderRoutingRules(supabase, body.rule_ids);
      return NextResponse.json({
        success: true,
        message: "Rules reordered",
      });
    }

    // Validate required fields
    if (!body.name || !body.conditions || !body.routes_to) {
      return NextResponse.json(
        { error: "name, conditions, and routes_to are required" },
        { status: 400 }
      );
    }

    const input: RoutingRuleInsert = {
      name: body.name,
      description: body.description,
      priority: body.priority ?? 100,
      conditions: body.conditions,
      routes_to: body.routes_to,
      youtube_version: body.youtube_version ?? "tbd",
      is_active: body.is_active ?? true,
    };

    const rule = await createRoutingRule(supabase, input);

    return NextResponse.json({
      success: true,
      rule,
    });
  } catch (error) {
    console.error("Create rule error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create rule" },
      { status: 500 }
    );
  }
}
