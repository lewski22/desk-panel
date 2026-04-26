function SkeletonEl({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse bg-zinc-100 rounded-lg ${className ?? ''}`}
      style={{ animationDuration: '1.5s' }}
    />
  );
}

export function SkeletonRows({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2 mt-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3 border border-zinc-100 rounded-xl">
          <SkeletonEl className="w-8 h-8 rounded-full shrink-0" />
          <div className="flex-1 space-y-1.5">
            <SkeletonEl className="h-3.5 w-2/3" />
            <SkeletonEl className="h-2.5 w-1/3" />
          </div>
          <SkeletonEl className="h-6 w-16 rounded-full" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonKpi({ count = 4 }: { count?: number }) {
  return (
    <div className={`grid grid-cols-2 gap-2 sm:gap-3 mb-5 md:grid-cols-${count}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="border border-zinc-100 rounded-xl p-4 space-y-2">
          <SkeletonEl className="h-8 w-16" />
          <SkeletonEl className="h-2.5 w-24" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonCards({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3 mt-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="border border-zinc-100 rounded-xl p-4 space-y-2">
          <div className="flex justify-between">
            <SkeletonEl className="h-4 w-1/3" />
            <SkeletonEl className="h-5 w-20 rounded-full" />
          </div>
          <SkeletonEl className="h-3 w-1/2" />
          <SkeletonEl className="h-3 w-1/4" />
        </div>
      ))}
    </div>
  );
}
