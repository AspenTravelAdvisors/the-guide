import type { VisitedProperty } from "@/lib/visited";

/**
 * "Aspen Travel Advisors has been here."
 *
 * One mark, three sizes. `card` sits under a listing's name, `mini` in a
 * text list, `detail` on the property page where a future note or photo has
 * room to show. Uncertain entries never reach this component: the lookup
 * drops them.
 */
/** The Aspen Travel Advisors seal, one image per theme (CSS shows one). */
function Seal() {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="visited-seal"
        src="/aspen-advisors-mark.png"
        srcSet="/aspen-advisors-mark.png 1x, /aspen-advisors-mark@2x.png 2x"
        alt="Aspen Travel Advisors"
        width={18}
        height={18}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="visited-seal visited-seal--light"
        src="/aspen-advisors-mark-light.png"
        srcSet="/aspen-advisors-mark-light.png 1x, /aspen-advisors-mark-light@2x.png 2x"
        alt=""
        aria-hidden="true"
        width={18}
        height={18}
      />
    </>
  );
}

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
        <Seal />
        Been here
      </span>
    );
  }

  return (
    <div className={variant === "detail" ? "visited-detail" : "visited-inline"}>
      <p className="visited-badge" title="Aspen Travel Advisors has been here">
        <Seal />
        <span className="visited-badge-text">Been here</span>
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
