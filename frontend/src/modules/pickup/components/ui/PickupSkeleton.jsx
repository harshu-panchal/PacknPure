import React from "react";
import { cn } from "../../utils/cn";

export const PickupSkeleton = ({ className }) => (
  <div className={cn("pickup-skeleton", className)} aria-hidden />
);

export const AssignmentCardSkeleton = () => (
  <div className="space-y-4 rounded-2xl border border-slate-100 bg-white p-4 sm:rounded-3xl">
    <div className="flex items-center gap-3">
      <PickupSkeleton className="h-11 w-11 shrink-0 rounded-2xl" />
      <div className="min-w-0 flex-1 space-y-2">
        <PickupSkeleton className="h-4 w-3/5" />
        <PickupSkeleton className="h-3 w-2/5" />
      </div>
    </div>
    <PickupSkeleton className="h-24 w-full rounded-2xl" />
    <PickupSkeleton className="h-14 w-full rounded-2xl" />
  </div>
);

export const ProfileSkeleton = () => (
  <div className="space-y-4">
    <PickupSkeleton className="h-32 w-full rounded-3xl" />
    <PickupSkeleton className="h-28 w-full rounded-3xl" />
    <PickupSkeleton className="h-64 w-full rounded-3xl" />
  </div>
);

export const StatsSkeleton = () => (
  <div className="grid grid-cols-3 gap-2">
    {[0, 1, 2].map((i) => (
      <PickupSkeleton key={i} className="h-20 rounded-2xl" />
    ))}
  </div>
);
