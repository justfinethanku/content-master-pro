export default function RoadmapPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Roadmap</h1>
        <p className="mt-1 text-muted-foreground">
          Things we plan on adding but haven't added yet.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-card p-6">
        <blockquote className="border-l-4 border-yellow-500 pl-4 italic text-muted-foreground">
          &ldquo;I am too tired right now to come up with this list, but stay
          tuned, and I will eventually put some shit in here.&rdquo;
        </blockquote>
      </div>
    </div>
  );
}
