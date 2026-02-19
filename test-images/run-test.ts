/**
 * Live integration test: fire prompts at image models with reference image support
 * and save the results for visual comparison.
 *
 * Usage: npx tsx test-images/run-test.ts
 *
 * Test 5: Reference image test — 2 prompts × 3 models = 6 images in test5/
 */

import fs from "node:fs";
import path from "node:path";

const SUPABASE_URL = "https://uaiiskuioqirpcaliljh.supabase.co";
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhaWlza3Vpb3FpcnBjYWxpbGpoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4Njk5OTAsImV4cCI6MjA4MjQ0NTk5MH0.Zq7eYT4oRZ7AAK2qFk2Tr4cXrz3NBr_IKbySVIlNPl8";

const TEST_EMAIL = "jon@contentionmedia.com";
const TEST_PASSWORD = "Tiny&Pink2018";

// ── Test Configuration ──────────────────────────────────────────────
const TEST_NUMBER = 15;
const TEST_WORD = "FIFTEEN";
const TEST_DIR = `test${TEST_NUMBER}`;

// Reference image path (relative to this script)
const REFERENCE_IMAGE_PATH = path.join(
  path.resolve(new URL(".", import.meta.url).pathname),
  "reference-image",
  "nate reference image.jpeg"
);

// Models to test
const MODELS: Array<{ id: string; displayName: string }> = [
  { id: "google/gemini-3-pro-image", displayName: "Gemini 3 Pro Image" },
  { id: "bfl/flux-kontext-pro", displayName: "FLUX Kontext Pro" },
  { id: "bfl/flux-kontext-max", displayName: "FLUX Kontext Max" },
];

// Prompts to test — each gets a suffix appended to the filename
interface TestPrompt {
  slug: string; // appended to filename, e.g. "rambo" → "bfl-flux-kontext-pro-rambo.jpg"
  build: (modelDisplayName: string) => string;
}

const PROMPTS: TestPrompt[] = [
  {
    slug: "boxing",
    build: (modelDisplayName) =>
      `Hyper-realistic cinematic medium shot inside a dimly lit, gritty boxing arena. Using the uploaded reference image as a strict face and identity reference: the man from the reference photo — same face, glasses, blue beanie, grey-streaked beard — is the referee standing in the center of the ring, wearing a classic black-and-white striped referee shirt, one arm raised mid-count pointing down at the defeated fighter on the canvas. On the left side of the ring, a battered humanoid robot with the words "Google 3.1 Pro" displayed prominently on its chest plate in cracked chrome lettering, clearly visible, is slumped against the ropes — dented, sparking with broken circuits, chunks missing from its torso, oil leaking onto the canvas. The "3" on its chest is cracked nearly in half, the "1" is bent at an angle. Sweat-like condensation and scuff marks cover its chrome surface. On the right side of the ring, a sleek, powerful humanoid figure with the word "FLUX" displayed prominently in glowing electric blue neon across its chest plate, clearly visible, stands victorious with both fists raised in triumph, a championship belt slung over one shoulder, completely unscathed and radiating confidence. In the background between the ropes, a beautiful ring card girl is walking across the ring holding up a large white round card above her head with "TEST ${TEST_WORD}" written on it in bold black text, exactly like the round number cards in real boxing matches. She is wearing a fitted crop top with "LEJ" printed across the chest. The ring canvas is splattered with oil and debris from the destroyed Google bot. Above the ring, a large illuminated arena jumbotron displays "${modelDisplayName}" in bright glowing text. Overhead arena lights cast harsh dramatic pools of light with deep shadows. The crowd in the background is a dark blur of silhouettes going wild. Shot on 35mm lens, f/2.0, shallow depth of field. Gritty, fight-night atmosphere with warm tungsten and cool blue rim lighting. Visible grain. 16:9 aspect ratio, 4K resolution.`,
  },
];

const ROOT_DIR = path.resolve(new URL(".", import.meta.url).pathname);
const OUT_DIR = path.join(ROOT_DIR, TEST_DIR);

interface TestResult {
  model: string;
  displayName: string;
  promptSlug: string;
  success: boolean;
  durationMs: number;
  error?: string;
  filePath?: string;
  fileSizeKB?: number;
  storageUrl?: string;
}

async function authenticate(): Promise<string> {
  const res = await fetch(
    `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
    {
      method: "POST",
      headers: {
        apikey: ANON_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
    }
  );

  if (!res.ok) {
    throw new Error(`Auth failed: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  return data.access_token;
}

async function generateImage(
  token: string,
  model: { id: string; displayName: string },
  promptConfig: TestPrompt,
  referenceImageBase64: string | null
): Promise<TestResult> {
  const start = Date.now();
  const safeName = model.id.replace(/\//g, "-");
  const fileName = `${safeName}-${promptConfig.slug}`;
  const prompt = promptConfig.build(model.displayName);

  console.log(`\n🎨 ${model.displayName} — ${promptConfig.slug}...`);

  try {
    const bodyPayload: Record<string, unknown> = {
      prompt_slug: "image_generator",
      variables: { content: prompt },
      overrides: {
        model_id: model.id,
        aspect_ratio: "16:9",
      },
    };

    // Include reference image if available
    if (referenceImageBase64) {
      bodyPayload.reference_image = referenceImageBase64;
    }

    const res = await fetch(`${SUPABASE_URL}/functions/v1/generate`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(bodyPayload),
    });

    const durationMs = Date.now() - start;

    if (!res.ok) {
      const errText = await res.text();
      console.log(`   ❌ HTTP ${res.status} (${durationMs}ms)`);
      console.log(`   Error: ${errText.slice(0, 300)}`);
      return {
        model: model.id,
        displayName: model.displayName,
        promptSlug: promptConfig.slug,
        success: false,
        durationMs,
        error: `HTTP ${res.status}: ${errText.slice(0, 200)}`,
      };
    }

    const data = await res.json();

    if (!data.success) {
      console.log(`   ❌ API error (${durationMs}ms): ${data.error}`);
      return {
        model: model.id,
        displayName: model.displayName,
        promptSlug: promptConfig.slug,
        success: false,
        durationMs,
        error: data.error,
      };
    }

    if (!data.image?.base64) {
      console.log(`   ❌ No image data returned (${durationMs}ms)`);
      return {
        model: model.id,
        displayName: model.displayName,
        promptSlug: promptConfig.slug,
        success: false,
        durationMs,
        error: "No image data in response",
      };
    }

    // Determine file extension from media type
    const ext = data.image.media_type === "image/jpeg" ? "jpg" : "png";
    const filePath = path.join(OUT_DIR, `${fileName}.${ext}`);

    // Write the image
    const buf = Buffer.from(data.image.base64, "base64");
    fs.writeFileSync(filePath, buf);

    const sizeKB = Math.round(buf.length / 1024);
    console.log(
      `   ✅ Success (${durationMs}ms) — ${sizeKB} KB → ${TEST_DIR}/${fileName}.${ext}`
    );
    if (data.image.storage_url) {
      console.log(`   📦 Storage: ${data.image.storage_url}`);
    }

    return {
      model: model.id,
      displayName: model.displayName,
      promptSlug: promptConfig.slug,
      success: true,
      durationMs,
      filePath: `${fileName}.${ext}`,
      fileSizeKB: sizeKB,
      storageUrl: data.image.storage_url,
    };
  } catch (err) {
    const durationMs = Date.now() - start;
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`   ❌ Exception (${durationMs}ms): ${msg}`);
    return {
      model: model.id,
      displayName: model.displayName,
      promptSlug: promptConfig.slug,
      success: false,
      durationMs,
      error: msg,
    };
  }
}

async function main() {
  // Create output directory
  fs.mkdirSync(OUT_DIR, { recursive: true });

  // Load reference image
  let referenceImageBase64: string | null = null;
  if (fs.existsSync(REFERENCE_IMAGE_PATH)) {
    const imgBuffer = fs.readFileSync(REFERENCE_IMAGE_PATH);
    referenceImageBase64 = imgBuffer.toString("base64");
    const sizeKB = Math.round(imgBuffer.length / 1024);
    console.log(`📸 Reference image loaded: ${sizeKB} KB`);
  } else {
    console.log(`⚠️  No reference image found at: ${REFERENCE_IMAGE_PATH}`);
    console.log(`   Proceeding without reference image.`);
  }

  const totalTests = MODELS.length * PROMPTS.length;

  console.log("=".repeat(70));
  console.log(`REFERENCE IMAGE TEST — TEST ${TEST_WORD}`);
  console.log(`${MODELS.length} models × ${PROMPTS.length} prompts = ${totalTests} images`);
  console.log(`Prompts: ${PROMPTS.map((p) => p.slug).join(", ")}`);
  console.log(`Output directory: ${OUT_DIR}`);
  console.log("=".repeat(70));

  // Authenticate
  console.log("\n🔐 Authenticating...");
  const token = await authenticate();
  console.log("   ✅ Got auth token");

  // Run tests sequentially (to avoid rate limits)
  const results: TestResult[] = [];

  for (const model of MODELS) {
    for (const promptConfig of PROMPTS) {
      const result = await generateImage(token, model, promptConfig, referenceImageBase64);
      results.push(result);
    }
  }

  // Summary
  console.log("\n" + "=".repeat(70));
  console.log("RESULTS SUMMARY");
  console.log("=".repeat(70));

  const succeeded = results.filter((r) => r.success);
  const failed = results.filter((r) => !r.success);

  console.log(`\n✅ Succeeded: ${succeeded.length}/${results.length}`);
  for (const r of succeeded) {
    console.log(
      `   ${(r.model + " [" + r.promptSlug + "]").padEnd(50)} ${String(r.durationMs).padStart(6)}ms  ${String(r.fileSizeKB).padStart(5)} KB  ${r.filePath}`
    );
  }

  if (failed.length > 0) {
    console.log(`\n❌ Failed: ${failed.length}/${results.length}`);
    for (const r of failed) {
      console.log(
        `   ${(r.model + " [" + r.promptSlug + "]").padEnd(50)} ${String(r.durationMs).padStart(6)}ms  ${r.error}`
      );
    }
  }

  // Write results JSON
  const summaryPath = path.join(OUT_DIR, "results.json");
  fs.writeFileSync(summaryPath, JSON.stringify(results, null, 2));
  console.log(`\n📄 Full results: ${summaryPath}`);
}

main().catch(console.error);
