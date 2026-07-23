export function GallerySkeleton() {
  return (
    <div className="columns-1 sm:columns-2 xl:columns-3 2xl:columns-4 gap-3 sm:gap-4 animate-pulse">
      {Array.from({ length: 8 }).map((_, index) => (
        <div
          key={index}
          className="mb-5 break-inside-avoid rounded-lg bg-white/8"
          style={{ height: `${180 + (index % 3) * 60}px` }}
        />
      ))}
    </div>
  );
}
