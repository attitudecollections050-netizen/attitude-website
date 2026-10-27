import { ProductGridSkeleton, Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="container-luxe py-16" role="status" aria-label="Loading">
      <Skeleton className="h-3 w-32" />
      <Skeleton className="mt-6 h-14 w-80 max-w-full" />
      <div className="mt-12">
        <ProductGridSkeleton count={8} />
      </div>
    </div>
  );
}
