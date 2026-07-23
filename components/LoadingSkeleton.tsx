"use client";

function SkeletonBar({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-md bg-muted ${className}`}
    />
  );
}

export function SkeletonCard() {
  return (
    <div className="rounded-md border bg-card p-4">
      <SkeletonBar className="mb-3 h-4 w-3/4" />
      <SkeletonBar className="mb-2 h-3 w-full" />
      <SkeletonBar className="mb-2 h-3 w-5/6" />
      <SkeletonBar className="h-3 w-2/3" />
    </div>
  );
}

export function SkeletonTraceDetail() {
  return (
    <div className="mx-auto max-w-4xl p-4 sm:p-8">
      <SkeletonBar className="mb-4 h-5 w-48" />
      <SkeletonBar className="mb-6 h-3 w-72" />
      <div className="mb-6 flex gap-4">
        <SkeletonBar className="h-8 w-20" />
        <SkeletonBar className="h-8 w-24" />
        <SkeletonBar className="h-8 w-16" />
        <SkeletonBar className="h-8 w-24" />
        <SkeletonBar className="h-8 w-20" />
      </div>
      <SkeletonCard />
      <div className="mt-4">
        <SkeletonCard />
      </div>
    </div>
  );
}

export function SkeletonList() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

export function SkeletonBatchProgress() {
  return (
    <div>
      <SkeletonBar className="mb-3 h-2 w-full" />
      <div className="space-y-1">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2">
            <SkeletonBar className="h-4 w-4 rounded-full" />
            <SkeletonBar className="h-4 flex-1" />
            <SkeletonBar className="h-4 w-12" />
          </div>
        ))}
      </div>
    </div>
  );
}
