"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Settings,
  ChevronDown,
  Save,
  Loader2,
  Check,
  AlertCircle,
  RotateCcw,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { GuidelinesManager } from "@/components/guidelines-manager";
import { NamespaceManager } from "@/components/namespace-manager";

interface AppSetting {
  id: string;
  category: string;
  key: string;
  value: { value: any };
  description: string | null;
  updated_at: string;
}

interface AIModel {
  id: string;
  model_id: string;
  display_name: string;
}

interface SettingsByCategory {
  [category: string]: AppSetting[];
}

// Default values for reset
const DEFAULTS: Record<string, any> = {
  parse_brain_dump_max_themes: 5,
  parse_brain_dump_model: "anthropic/claude-sonnet-4-5",
  generate_research_model: "perplexity/sonar-pro",
  generate_research_temperature: 0.3,
  generate_research_max_tokens: 4096,
  generate_outlines_model: "anthropic/claude-sonnet-4-5",
  generate_outlines_min_sections: 3,
  generate_outlines_max_sections: 6,
  generate_outlines_temperature: 0.7,
  draft_writer_model: "anthropic/claude-sonnet-4-5",
  draft_writer_target_words: 1500,
  draft_writer_temperature: 0.8,
  voice_checker_model: "anthropic/claude-haiku-4-5",
  voice_checker_threshold: 0.7,
  headline_generator_model: "anthropic/claude-sonnet-4-5",
  headline_generator_count: 5,
  image_generator_model: "google/gemini-3-pro-image",
  image_generator_fallback_model: "openai/dall-e-3",
  default_output_formats: ["substack", "youtube", "tiktok"],
  max_sessions_per_user: 100,
  ai_call_log_retention_days: 30,
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingsByCategory>({});
  const [models, setModels] = useState<AIModel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editedSettings, setEditedSettings] = useState<Record<string, any>>({});
  const [savingKeys, setSavingKeys] = useState<Set<string>>(new Set());
  const [savedKeys, setSavedKeys] = useState<Set<string>>(new Set());
  const [openCategories, setOpenCategories] = useState<Set<string>>(new Set(["edge_function"]));

  const supabase = createClient();

  const loadSettings = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { data: settingsData, error: settingsError } = await supabase
        .from("app_settings")
        .select("*")
        .order("category")
        .order("key");

      if (settingsError) throw settingsError;

      // Group by category
      const grouped: SettingsByCategory = {};
      for (const setting of settingsData || []) {
        if (!grouped[setting.category]) {
          grouped[setting.category] = [];
        }
        grouped[setting.category].push(setting);
      }
      setSettings(grouped);

      // Initialize edited values
      const initial: Record<string, any> = {};
      for (const setting of settingsData || []) {
        initial[setting.key] = setting.value?.value;
      }
      setEditedSettings(initial);

      // Load AI models
      const { data: modelsData, error: modelsError } = await supabase
        .from("ai_models")
        .select("id, model_id, display_name")
        .eq("is_available", true)
        .order("display_name");

      if (modelsError) throw modelsError;
      setModels(modelsData || []);
    } catch (err) {
      console.error("Failed to load settings:", err);
      setError(err instanceof Error ? err.message : "Failed to load settings");
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const saveSetting = async (setting: AppSetting) => {
    const key = setting.key;
    setSavingKeys((prev) => new Set(prev).add(key));
    setSavedKeys((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });

    try {
      const { error: updateError } = await supabase
        .from("app_settings")
        .update({
          value: { value: editedSettings[key] },
          updated_at: new Date().toISOString(),
        })
        .eq("id", setting.id);

      if (updateError) throw updateError;

      setSavedKeys((prev) => new Set(prev).add(key));
      setTimeout(() => {
        setSavedKeys((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      }, 2000);
    } catch (err) {
      console.error("Failed to save setting:", err);
      setError(err instanceof Error ? err.message : "Failed to save setting");
    } finally {
      setSavingKeys((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  const resetToDefault = (key: string) => {
    if (DEFAULTS[key] !== undefined) {
      setEditedSettings((prev) => ({ ...prev, [key]: DEFAULTS[key] }));
    }
  };

  const toggleCategory = (category: string) => {
    setOpenCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  const isModelSetting = (key: string): boolean => {
    return key.endsWith("_model");
  };

  const isTemperatureSetting = (key: string): boolean => {
    return key.endsWith("_temperature") || key.endsWith("_threshold");
  };

  const isNumberSetting = (key: string): boolean => {
    return (
      key.includes("max_") ||
      key.includes("min_") ||
      key.includes("_count") ||
      key.includes("_words") ||
      key.includes("_tokens") ||
      key.includes("_days") ||
      key.includes("_themes")
    );
  };

  const formatLabel = (key: string): string => {
    return key
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  const getCategoryTitle = (category: string): string => {
    switch (category) {
      case "edge_function":
        return "Edge Function Settings";
      case "general":
        return "General Settings";
      default:
        return category.charAt(0).toUpperCase() + category.slice(1);
    }
  };

  const getCategoryDescription = (category: string): string => {
    switch (category) {
      case "edge_function":
        return "Configure AI models, temperatures, and token limits for each pipeline stage";
      case "general":
        return "General application settings and limits";
      default:
        return "";
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Configure AI models, parameters, and application behavior.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive bg-destructive/10 p-4">
          <p className="text-sm text-destructive flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {error}
          </p>
        </div>
      )}

      {/* Brand Guidelines */}
      <GuidelinesManager className="mb-6" />

      {/* Pinecone Namespaces */}
      <NamespaceManager className="mb-6" />

      <div className="space-y-4">
        {Object.entries(settings).map(([category, categorySettings]) => (
          <Collapsible
            key={category}
            open={openCategories.has(category)}
            onOpenChange={() => toggleCategory(category)}
          >
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Settings className="h-5 w-5" />
                        {getCategoryTitle(category)}
                      </CardTitle>
                      <CardDescription>{getCategoryDescription(category)}</CardDescription>
                    </div>
                    <ChevronDown
                      className={`h-5 w-5 transition-transform ${
                        openCategories.has(category) ? "rotate-180" : ""
                      }`}
                    />
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="grid gap-6 md:grid-cols-2">
                  {categorySettings.map((setting) => (
                    <div key={setting.id} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor={setting.key}>{formatLabel(setting.key)}</Label>
                        <div className="flex items-center gap-1">
                          {DEFAULTS[setting.key] !== undefined && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => resetToDefault(setting.key)}
                              title="Reset to default"
                            >
                              <RotateCcw className="h-3 w-3" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => saveSetting(setting)}
                            disabled={savingKeys.has(setting.key)}
                          >
                            {savingKeys.has(setting.key) ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : savedKeys.has(setting.key) ? (
                              <Check className="h-3 w-3 text-green-500" />
                            ) : (
                              <Save className="h-3 w-3" />
                            )}
                          </Button>
                        </div>
                      </div>

                      {isModelSetting(setting.key) ? (
                        <Select
                          value={editedSettings[setting.key] || ""}
                          onValueChange={(value) =>
                            setEditedSettings((prev) => ({ ...prev, [setting.key]: value }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select model" />
                          </SelectTrigger>
                          <SelectContent>
                            {models.map((model) => (
                              <SelectItem key={model.id} value={model.model_id}>
                                {model.display_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : isTemperatureSetting(setting.key) ? (
                        <div className="flex items-center gap-3">
                          <Input
                            type="range"
                            min="0"
                            max="1"
                            step="0.1"
                            value={editedSettings[setting.key] || 0.7}
                            onChange={(e) =>
                              setEditedSettings((prev) => ({
                                ...prev,
                                [setting.key]: parseFloat(e.target.value),
                              }))
                            }
                            className="flex-1"
                          />
                          <span className="text-sm w-10 text-right">
                            {editedSettings[setting.key]?.toFixed(1) || "0.7"}
                          </span>
                        </div>
                      ) : isNumberSetting(setting.key) ? (
                        <Input
                          type="number"
                          id={setting.key}
                          value={editedSettings[setting.key] || ""}
                          onChange={(e) =>
                            setEditedSettings((prev) => ({
                              ...prev,
                              [setting.key]: parseInt(e.target.value) || 0,
                            }))
                          }
                        />
                      ) : Array.isArray(editedSettings[setting.key]) ? (
                        <Input
                          id={setting.key}
                          value={JSON.stringify(editedSettings[setting.key])}
                          onChange={(e) => {
                            try {
                              const parsed = JSON.parse(e.target.value);
                              setEditedSettings((prev) => ({ ...prev, [setting.key]: parsed }));
                            } catch {
                              // Invalid JSON, keep as string for now
                            }
                          }}
                          placeholder='["value1", "value2"]'
                        />
                      ) : (
                        <Input
                          id={setting.key}
                          value={editedSettings[setting.key] || ""}
                          onChange={(e) =>
                            setEditedSettings((prev) => ({
                              ...prev,
                              [setting.key]: e.target.value,
                            }))
                          }
                        />
                      )}

                      {setting.description && (
                        <p className="text-xs text-muted-foreground">{setting.description}</p>
                      )}
                    </div>
                  ))}
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        ))}
      </div>
    </div>
  );
}
