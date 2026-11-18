import type { VisitedProperty } from "@/lib/visited";

/**
 * "Aspen Travel Advisors has been here."
 *
 * One mark, three sizes. `card` sits under a listing's name, `mini` in a
 * text list, `detail` on the property page where a future note or photo has
 * room to show. Uncertain entries never reach this component: the lookup
 * drops them.
 */
export default function VisitedBadge({
  visits,
  variant = "card",
}: {
  visits: VisitedProperty[];
  variant?: "card" | "detail" | "mini";
}) {
  if (!visits.length) return null;

  const notes = [...new Set(visits.map((v) => (v.notes || "").trim()).filter(Boolean))];
  const when = [...new Set(visits.map((v) => (v.visited || "").trim()).filter(Boolean))];
  const photos = visits.flatMap((v) => v.photos || []).filter(Boolean);

  if (variant === "mini") {
    return (
      <span className="visited-badge visited-badge--mini" title="Aspen Travel Advisors has been here">
        Been here
      </span>
    );
  }

  return (
    <div className={variant === "detail" ? "visited-detail" : "visited-inline"}>
      <p className="visited-badge">
        <span className="visited-badge-kicker">Aspen Travel Advisors</span> has been here
      </p>
      {variant === "detail" && (when.length > 0 || notes.length > 0) && (
        <p className="visited-note">
          {when.length > 0 ? `Visited ${when.join(", ")}. ` : ""}
          {notes.join(" ")}
        </p>
      )}
      {variant === "detail" && photos.length > 0 && (
        <div className="visited-photos">
          {photos.map((src) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={src} src={src} alt="" />
          ))}
        </div>
      )}
    </div>
  );
}
