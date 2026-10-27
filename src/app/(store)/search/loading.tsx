import { ProductGridSkeleton, Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <>
      <div className="bg-blush">
        <div className="container-luxe py-14">
          <Skeleton className="h-3 w-40" />
          <Skeleton className="mt-10 h-14 w-72" />
        </div>
      </div>
      <div className="container-luxe grid gap-14 py-10 lg:grid-cols-[15rem_1fr]">
        <div className="hidden space-y-4 lg:block">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
        <ProductGridSkeleton count={6} />
      </div>
    </>
  );
}
