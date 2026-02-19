import { createClient } from "@supabase/supabase-js";
import * as path from "path";

async function main() {
  // Load .env.local
  const envPath = path.join(__dirname, "..", ".env.local");
  try {
    process.loadEnvFile(envPath);
  } catch {
    console.error(`Failed to load ${envPath}`);
    process.exit(1);
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabase
    .from("ai_models")
    .select("model_id, display_name, image_config")
    .in("model_id", [
      "bfl/flux-2-pro",
      "bfl/flux-kontext-pro",
      "bfl/flux-pro-1.1-ultra",
    ])
    .order("model_id");

  if (error) {
    console.error("Error:", error);
    process.exit(1);
  }

  console.log(JSON.stringify(data, null, 2));
}

main().catch(console.error);
