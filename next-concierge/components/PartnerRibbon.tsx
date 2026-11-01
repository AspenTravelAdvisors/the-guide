"use client";

// components/PartnerRibbon.tsx — "Shared with you by …", for a visitor who
// arrived on a referral partner's link (lib/referral.ts).
//
// The ribbon is what makes a partner's link a gift rather than a URL: their
// client lands on a page that names the person who sent it, and the partner can
// see that it does. It shows only for partners listed in data/partners.json —
// an unknown code is still credited on the lead, but no name is ever taken from
// the address bar and printed on the page.
//
// Hidden on the flyover reel, which is a film and has its own end card, and
// dismissible for the rest of the visit.

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { partnerFor, partnerLabel, referralCode, type Partner } from "@/lib/referral";

const DISMISS_KEY = "ebl.referral.dismissed";

export default function PartnerRibbon() {
  const pathname = usePathname();
  const [partner, setPartner] = useState<Partner | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const sync = () => setPartner(partnerFor(referralCode()));
    sync();
    try {
      setDismissed(window.sessionStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      /* storage unavailable: show it */
    }
    // ArrivalCapture may record the code after this effect has run.
    window.addEventListener("ebl:referral", sync);
    return () => window.removeEventListener("ebl:referral", sync);
  }, []);

  if (!partner || dismissed || pathname?.startsWith("/demo")) return null;

  return (
    <div className="partner-ribbon" role="note">
      <span>
        Shared with you by <b>{partnerLabel(partner)}</b>. Anything you send an advisor from
        here reaches Aspen Travel Advisors with their introduction.
      </span>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => {
          setDismissed(true);
          try {
            window.sessionStorage.setItem(DISMISS_KEY, "1");
          } catch {
            /* fine: dismissed for this page only */
          }
        }}
      >
        ✕
      </button>
    </div>
  );
}
