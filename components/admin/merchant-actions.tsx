"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function MerchantActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  async function update(nextStatus: string) { const response = await fetch(`/api/admin/merchants/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: nextStatus }) }); if (response.ok) router.refresh(); }
  return <div className="flex flex-wrap gap-2">{status === "PENDING" && <><Button size="sm" onClick={() => update("APPROVED")}>通过</Button><Button size="sm" variant="outline" onClick={() => update("REJECTED")}>拒绝</Button></>}{status === "APPROVED" && <Button size="sm" variant="outline" onClick={() => update("SUSPENDED")}>暂停</Button>}{status === "SUSPENDED" && <Button size="sm" onClick={() => update("APPROVED")}>恢复</Button>}{status === "REJECTED" && <Button size="sm" variant="outline" onClick={() => update("PENDING")}>重新审核</Button>}</div>;
}
