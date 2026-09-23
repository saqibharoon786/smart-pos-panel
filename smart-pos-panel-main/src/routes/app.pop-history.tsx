import { createFileRoute } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useState } from "react";
import { usePopHistory } from "@/lib/store";

export const Route = createFileRoute("/app/pop-history")({
  head: () => ({
    meta: [
      { title: "POP History | Book POS" },
      { name: "description", content: "Search every inventory addition, deletion, and vendor return." },
      { property: "og:title", content: "POP History | Book POS" },
      { property: "og:description", content: "Search every inventory addition, deletion, and vendor return." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PopHistoryPage,
});

function PopHistoryPage() {
  const history = usePopHistory();
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const rows = history.filter((entry) =>
    [entry.name, entry.upc, entry.department, entry.vendor, entry.action, entry.note]
      .join(" ")
      .toLowerCase()
      .includes(needle),
  );

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold">POP History</h2>
        <p className="text-sm text-muted-foreground">Complete inventory movement history.</p>
      </div>
      <SearchBox value={query} onChange={setQuery} placeholder="Search name, UPC, department, vendor or action" />
      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full min-w-[920px] text-sm">
          <thead className="bg-secondary text-left text-xs text-muted-foreground">
            <tr>
              {["Date & Time", "Action", "Product", "UPC", "Department", "Vendor", "Qty", "Unit Cost", "Note"].map((label) => (
                <th key={label} className="px-4 py-3 font-medium">{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((entry) => (
              <tr key={entry.id} className="border-t border-border">
                <td className="whitespace-nowrap px-4 py-3">{new Date(entry.at).toLocaleString()}</td>
                <td className="px-4 py-3 font-semibold text-primary">{entry.action}</td>
                <td className="px-4 py-3 font-medium">{entry.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{entry.upc || "—"}</td>
                <td className="px-4 py-3">{entry.department || "—"}</td>
                <td className="px-4 py-3">{entry.vendor || "—"}</td>
                <td className="px-4 py-3">{entry.qty}</td>
                <td className="px-4 py-3">Rs {entry.price.toFixed(2)}</td>
                <td className="px-4 py-3 text-muted-foreground">{entry.note}</td>
              </tr>
            ))}
            {rows.length === 0 && <EmptyRow columns={9} text="No POP history found." />}
          </tbody>
        </table>
        <div className="border-t border-border px-4 py-2 text-xs text-muted-foreground">{rows.length} record(s)</div>
      </div>
    </div>
  );
}

function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <label className="flex items-center gap-2 rounded-lg border border-border bg-card px-3">
      <Search className="size-4 text-muted-foreground" />
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="h-11 w-full bg-transparent text-sm outline-none" />
    </label>
  );
}

function EmptyRow({ columns, text }: { columns: number; text: string }) {
  return <tr><td colSpan={columns} className="px-4 py-12 text-center text-muted-foreground">{text}</td></tr>;
}