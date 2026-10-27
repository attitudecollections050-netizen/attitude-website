import { Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="container-luxe grid gap-10 pb-24 pt-16 lg:grid-cols-[1.15fr_1fr] lg:gap-16" role="status" aria-label="Loading product">
      <Skeleton className="aspect-[3/4] w-full" />
      <div className="space-y-4">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-12 w-3/4" />
        <Skeleton className="h-6 w-32" />
        <Skeleton className="mt-8 h-10 w-2/3" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-14 w-full" />
      </div>
    </div>
  );
}
