import { getUsersPage } from "@/app/(dashboard)/users/action";
import { Pagination } from "@/components/shared/pagination";
import { USER_TYPE_LABELS } from "@/db/label";
import Link from "next/link";

type UsersTableProps = {
  search?: string;
  page?: string;
};

// One row per person, with the three numbers that decide whether you open them:
// what they have ordered, what they have raised, and what is sitting unbought in
// their basket. All three are aggregated in SQL — a count per row would be a
// query per user.

export const UsersTable = async ({ search, page }: UsersTableProps) => {
  const result = await getUsersPage({ search, page });

  if (result.items.length === 0) {
    return (
      <p className="rounded-card border border-dashed border-hairline px-4 py-10 text-center text-sm text-faint">
        {search ? `Nobody matches “${search}”.` : "No users yet."}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-x-auto rounded-card border border-hairline bg-surface">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-hairline text-xs tracking-wide text-faint uppercase">
            <tr>
              <th className="px-4 py-3 font-semibold">Name</th>
              <th className="px-4 py-3 font-semibold">Type</th>
              <th className="px-4 py-3 font-semibold">Contact</th>
              <th className="px-4 py-3 text-right font-semibold">Orders</th>
              <th className="px-4 py-3 text-right font-semibold">BOQs</th>
              <th className="px-4 py-3 text-right font-semibold">In basket</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {result.items.map((user) => (
              <tr key={user.uuid} className="hover:bg-hover">
                <td className="px-4 py-3">
                  <Link
                    href={`/users/${user.uuid}`}
                    className="font-medium text-ink hover:text-primary"
                  >
                    {user.fullName}
                  </Link>
                  {user.companyName && (
                    <p className="text-xs text-muted">{user.companyName}</p>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className="text-xs text-secondary">
                    {user.type ? USER_TYPE_LABELS[user.type] : "—"}
                  </span>
                  {/* A rejected application is a different fact from no
                      application, so the status is shown rather than a flag. */}
                  {user.partnerStatus && (
                    <p className="text-[11px] text-primary">
                      Partner · {user.partnerStatus}
                    </p>
                  )}
                </td>
                <td className="px-4 py-3">
                  <p className="text-xs text-secondary">{user.email ?? "—"}</p>
                  <p className="text-[11px] text-muted">{user.phone ?? "—"}</p>
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {user.orderCount}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {user.boqCount}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {user.cartItemCount > 0 ? (
                    <span className="text-amber-500">{user.cartItemCount}</span>
                  ) : (
                    <span className="text-faint">0</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pagination {...result} />
    </div>
  );
};
