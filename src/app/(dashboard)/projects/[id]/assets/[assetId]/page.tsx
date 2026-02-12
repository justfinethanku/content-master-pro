"use client";

import { use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AssetEditor } from "@/components/projects/asset-editor";
import { useAsset } from "@/hooks/use-assets";
import { useProject } from "@/hooks/use-projects";
import { ASSET_TYPE_LABELS, ASSET_STATUS_CONFIG } from "@/components/projects/asset-card";
import { ArrowLeft, Loader2 } from "lucide-react";
import { SidebarAutoCollapse } from "@/components/sidebar-auto-collapse";

interface AssetEditorPageProps {
  params: Promise<{ id: string; assetId: string }>;
}

export default function AssetEditorPage({ params }: AssetEditorPageProps) {
  const { id: projectId, assetId } = use(params);
  const router = useRouter();

  const { data: project, isLoading: projectLoading } = useProject(projectId);
  const { data: asset, isLoading: assetLoading } = useAsset(assetId);

  const handleNavigateAway = () => {
    router.push(`/projects/${projectId}`);
  };

  if (projectLoading || assetLoading) {
    return (
      <div className="flex items-center justify-center h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!project || !asset) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-foreground">
          Asset not found
        </h2>
        <p className="text-muted-foreground mt-2">
          The asset you&apos;re looking for doesn&apos;t exist or you don&apos;t have access.
        </p>
        <Button asChild className="mt-4">
          <Link href={`/projects/${projectId}`}>Back to Project</Link>
        </Button>
      </div>
    );
  }

  const typeLabel = ASSET_TYPE_LABELS[asset.asset_type] || asset.asset_type;
  const statusConfig = ASSET_STATUS_CONFIG[asset.status];

  return (
    <div className="space-y-6">
      <SidebarAutoCollapse />
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button asChild variant="ghost" size="icon">
          <Link href={`/projects/${projectId}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-foreground">
              {asset.title || typeLabel}
            </h1>
            <Badge variant="secondary" className={statusConfig.bgClass}>
              {statusConfig.label}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {project.title} &middot; {typeLabel} &middot; Version {asset.current_version}
          </p>
        </div>
      </div>

      {/* Editor */}
      <AssetEditor
        assetId={assetId}
        projectId={projectId}
        onNavigateAway={handleNavigateAway}
      />
    </div>
  );
}
