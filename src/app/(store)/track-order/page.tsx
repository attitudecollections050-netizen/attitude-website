import type { Metadata } from "next";
import { TrackOrderForm } from "@/components/checkout/TrackOrderForm";

export const metadata: Metadata = { title: "Track your order", description: "Track your Attitude Collections order with your order number and email." };

export default async function TrackOrderPage({ searchParams }: PageProps<"/track-order">) {
  const { order } = await searchParams;
  return (
    <div className="container-luxe max-w-4xl pb-24 pt-14">
      <p className="eyebrow text-rose-deep">Order tracking</p>
      <h1 className="display mt-3 text-5xl sm:text-6xl">Track your order</h1>
      <p className="mt-4 max-w-lg text-sm text-plum-soft">Enter your order number (from your confirmation) and the email address you used at checkout.</p>
      <div className="mt-10">
        <TrackOrderForm initialOrder={typeof order === "string" ? order.slice(0, 20) : ""} />
      </div>
    </div>
  );
}
