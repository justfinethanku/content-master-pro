"use client";

import { useState, useEffect, useRef } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  GripVertical,
  ChevronUp,
  MessageSquare,
  Plus,
  Trash2,
  Loader2,
  Send,
  Lightbulb,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import {
  useRoadmapItems,
  useCreateRoadmapItem,
  useDeleteRoadmapItem,
  useReorderRoadmapItems,
  useToggleVote,
  useRoadmapComments,
  useAddComment,
  useDeleteComment,
} from "@/hooks/use-roadmap";
import type { RoadmapItemWithDetails, RoadmapCommentWithUser } from "@/lib/types";

function displayName(
  profiles: { email: string | null; display_name: string | null } | null
): string {
  if (!profiles) return "Unknown";
  return profiles.display_name || profiles.email?.split("@")[0] || "Unknown";
}

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return date.toLocaleDateString();
}

// --------------- Sortable Item Card ---------------

function SortableItemCard({
  item,
  expandedId,
  onToggleExpand,
  currentUserId,
}: {
  item: RoadmapItemWithDetails;
  expandedId: string | null;
  onToggleExpand: (id: string) => void;
  currentUserId: string;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const toggleVote = useToggleVote();
  const deleteItem = useDeleteRoadmapItem();
  const isExpanded = expandedId === item.id;
  const isSubmitter = item.submitted_by === currentUserId;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-lg border border-border bg-card transition-shadow ${
        isDragging ? "shadow-lg opacity-75 z-50" : ""
      }`}
    >
      <div className="flex items-start gap-3 p-4">
        {/* Drag handle */}
        <button
          className="mt-1 cursor-grab text-muted-foreground hover:text-foreground active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-5 w-5" />
        </button>

        {/* Vote button */}
        <button
          className={`mt-0.5 flex flex-col items-center gap-0.5 rounded-md px-1.5 py-1 transition-colors ${
            item.user_has_voted
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
          onClick={() =>
            toggleVote.mutate(
              { itemId: item.id, hasVoted: item.user_has_voted },
              {
                onError: () => toast.error("Failed to toggle vote"),
              }
            )
          }
          disabled={toggleVote.isPending}
        >
          <ChevronUp className="h-4 w-4" />
          <span className="text-xs font-semibold">{item.vote_count}</span>
        </button>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <button
            className="w-full text-left"
            onClick={() => onToggleExpand(item.id)}
          >
            <h3 className="font-medium text-foreground">{item.title}</h3>
            {item.description && !isExpanded && (
              <p className="mt-0.5 line-clamp-1 text-sm text-muted-foreground">
                {item.description}
              </p>
            )}
          </button>

          {isExpanded && (
            <div className="mt-3 space-y-4">
              {item.description && (
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                  {item.description}
                </p>
              )}
              <CommentSection itemId={item.id} currentUserId={currentUserId} />
            </div>
          )}

          {/* Meta row */}
          <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
            <span>{displayName(item.profiles)}</span>
            <span>{timeAgo(item.created_at)}</span>
            <button
              className="flex items-center gap-1 hover:text-foreground"
              onClick={() => onToggleExpand(item.id)}
            >
              <MessageSquare className="h-3 w-3" />
              {item.comment_count}
            </button>
          </div>
        </div>

        {/* Delete (submitter only) */}
        {isSubmitter && (
          <button
            className="mt-1 text-muted-foreground hover:text-destructive"
            onClick={() =>
              deleteItem.mutate(item.id, {
                onSuccess: () => toast.success("Item deleted"),
                onError: () => toast.error("Failed to delete item"),
              })
            }
            disabled={deleteItem.isPending}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}

// --------------- Comment Section ---------------

function CommentSection({
  itemId,
  currentUserId,
}: {
  itemId: string;
  currentUserId: string;
}) {
  const { data: comments, isLoading } = useRoadmapComments(itemId);
  const addComment = useAddComment();
  const deleteComment = useDeleteComment();
  const [newComment, setNewComment] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = () => {
    const content = newComment.trim();
    if (!content) return;

    addComment.mutate(
      { item_id: itemId, content },
      {
        onSuccess: () => {
          setNewComment("");
          inputRef.current?.focus();
        },
        onError: () => toast.error("Failed to add comment"),
      }
    );
  };

  return (
    <div className="space-y-3 border-t border-border pt-3">
      {isLoading && (
        <div className="flex justify-center py-2">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      )}

      {comments && comments.length > 0 && (
        <div className="space-y-2">
          {comments.map((comment: RoadmapCommentWithUser) => (
            <div
              key={comment.id}
              className="group flex items-start gap-2 text-sm"
            >
              <div className="min-w-0 flex-1">
                <span className="font-medium text-foreground">
                  {displayName(comment.profiles)}
                </span>
                <span className="ml-2 text-muted-foreground">
                  {comment.content}
                </span>
                <span className="ml-2 text-xs text-muted-foreground">
                  {timeAgo(comment.created_at)}
                </span>
              </div>
              {comment.user_id === currentUserId && (
                <button
                  className="text-muted-foreground opacity-0 hover:text-destructive group-hover:opacity-100"
                  onClick={() =>
                    deleteComment.mutate(
                      { commentId: comment.id, itemId },
                      {
                        onError: () =>
                          toast.error("Failed to delete comment"),
                      }
                    )
                  }
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add comment form */}
      <div className="flex gap-2">
        <Textarea
          ref={inputRef}
          placeholder="Add a comment..."
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
          }}
          rows={1}
          className="min-h-[36px] resize-none"
        />
        <Button
          size="icon"
          variant="ghost"
          onClick={handleSubmit}
          disabled={!newComment.trim() || addComment.isPending}
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// --------------- Add Item Dialog ---------------

function AddItemDialog() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const createItem = useCreateRoadmapItem();

  const handleSubmit = () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;

    createItem.mutate(
      { title: trimmedTitle, description: description.trim() || null },
      {
        onSuccess: () => {
          setTitle("");
          setDescription("");
          setOpen(false);
          toast.success("Item added to the roadmap");
        },
        onError: () => toast.error("Failed to create item"),
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add item
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Suggest a feature</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div>
            <Input
              placeholder="Feature title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSubmit();
              }}
              autoFocus
            />
          </div>
          <div>
            <Textarea
              placeholder="Describe the feature (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!title.trim() || createItem.isPending}
            >
              {createItem.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Submit
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// --------------- Main Page ---------------

export default function RoadmapPage() {
  const { data: items, isLoading, error } = useRoadmapItems();
  const reorder = useReorderRoadmapItems();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string>("");

  // Get current user id on first load
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setCurrentUserId(user.id);
    });
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !items) return;

    const oldIndex = items.findIndex((i) => i.id === active.id);
    const newIndex = items.findIndex((i) => i.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(items, oldIndex, newIndex);
    const updates = reordered.map((item, index) => ({
      id: item.id,
      sort_order: index,
    }));

    reorder.mutate(updates, {
      onError: () => toast.error("Failed to save order"),
    });
  };

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Roadmap</h1>
        </div>
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-destructive">
          Failed to load roadmap items.
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Roadmap</h1>
          <p className="mt-1 text-muted-foreground">
            Vote on features and suggest new ones
          </p>
        </div>
        <AddItemDialog />
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && items && items.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border py-16 text-center">
          <Lightbulb className="h-10 w-10 text-muted-foreground" />
          <div>
            <p className="font-medium text-foreground">No items yet</p>
            <p className="text-sm text-muted-foreground">
              Be the first to suggest a feature
            </p>
          </div>
        </div>
      )}

      {/* Sortable list */}
      {items && items.length > 0 && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={items.map((i) => i.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {items.map((item) => (
                <SortableItemCard
                  key={item.id}
                  item={item}
                  expandedId={expandedId}
                  onToggleExpand={toggleExpand}
                  currentUserId={currentUserId}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}
