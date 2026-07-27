export function PageSkeleton() {
  return (
    <div className="animate-pulse space-y-5">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="card h-40 bg-bg-soft/80" />
          <div className="card h-40 bg-bg-soft/80" />
        </div>
        <div className="card h-72 bg-bg-soft/80" />
      </div>
      <div className="card h-64 bg-bg-soft/80" />
    </div>
  );
}
