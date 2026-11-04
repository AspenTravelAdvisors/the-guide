// Everything on the homepage below The Guide and the globe.
//
// A server component on purpose: it is the part of the homepage a crawler and
// a skimming reader see, so it ships as HTML in the static prerender, and only
// the two buttons in components/HomeAsk.tsx hydrate. The content and the rules
// that pick it live in lib/home-sections.js.

import Link from "next/link";
import { homeSections, homeQuestions, EDITION } from "@/lib/home-sections";
import { ATLASES } from "@/lib/atlas-config";
import SiteFooter from "@/components/SiteFooter";
import AnswerAdvisorCta from "@/components/AnswerAdvisorCta";
import { HomeAsk, HomeBackToGuide, HomeThumb } from "@/components/HomeAsk";

const initials = (s) =>
  String(s)
    .replace(/^(A&K Sanctuary|Four Seasons (Hotel|Resort)( and Residences)?)\s*/i, "")
    .split(/[\s–,-]+/)
    .filter((w) => /^[A-Z]/.test(w))
    .slice(0, 2)
    .map((w) => w[0])
    .join("") || "·";

function Card({ card, answers }) {
  if (!card) return null;
  return (
    <aside className="home-op">
      <p className="home-op-eyebrow">{card.eyebrow}</p>
      <h3>{card.name}</h3>
      {card.text ? <p className="home-op-text">{card.text}</p> : null}
      {card.facts?.length > 0 && (
        <dl className="home-op-facts">
          {card.facts.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      )}
      {card.perks?.length > 0 && (
        <ul className="home-op-perks">
          {card.perks.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}
      {answers.map((a) => (
        <Link key={a.slug} className="home-op-q" href={a.href}>
          {a.text}
        </Link>
      ))}
      <Link className="home-op-cta" href={card.cta.href}>
        {card.cta.label} →
      </Link>
    </aside>
  );
}

export default function HomeSections() {
  const sections = homeSections();
  const questions = homeQuestions();
  const reviewed = new Date(`${EDITION.reviewed}T00:00:00Z`).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  return (
    <div className="home-below">
      <nav className="home-jump" aria-label="Collections">
        {sections.map((s) => (
          <a key={s.id} href={`#${s.id}`} style={{ "--tc": ATLASES[s.collection]?.color }}>
            <i aria-hidden="true" />
            {s.label}
          </a>
        ))}
        <a href="#questions">Questions</a>
      </nav>

      <section className="home-season">
        <p className="home-eyebrow">{EDITION.label}</p>
        <div>
          <p className="home-season-text">{EDITION.season}</p>
          <p className="home-season-sig">Aspen Travel Advisors, {reviewed}</p>
        </div>
      </section>

      {sections.map((s) => (
        <section key={s.id} id={s.id} className="home-coll" style={{ "--tc": ATLASES[s.collection]?.color }}>
          <header className="home-coll-head">
            <p className="home-eyebrow home-eyebrow--tc">
              {s.label} · {ATLASES[s.collection]?.count?.toLocaleString("en-US")} on the atlas
            </p>
            <h2>{s.headline}</h2>
            <p className="home-coll-body">{s.body}</p>
            <Link className="home-coll-atlas" href={s.atlas}>
              Open the atlas →
            </Link>
          </header>
          <div className="home-coll-grid">
            <Card card={s.card} answers={s.answers} />
            {s.destinations ? (
              <ul className="home-dest">
                {s.destinations.map((d) => (
                  <li key={d.href}>
                    <Link href={d.href}>{d.name}</Link>
                  </li>
                ))}
              </ul>
            ) : (
              <ul className="home-rows">
                {s.rows.map((r) => (
                  <li key={r.href} className="home-row">
                    <Link href={r.href} className="home-row-link">
                      <span className="home-row-thumb" data-ini={initials(r.title)}>
                        {r.thumb ? <HomeThumb src={r.thumb} /> : null}
                      </span>
                      <span className="home-row-text">
                        <span className="home-row-name">{r.title}</span>
                        <span className="home-row-meta">{r.meta}</span>
                      </span>
                      {r.when ? (
                        <span className="home-row-when">
                          <b>{r.when.main}</b>
                          {r.when.sub ? <span>{r.when.sub}</span> : null}
                        </span>
                      ) : null}
                    </Link>
                    <HomeAsk text={r.ask} section={s.id} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      ))}

      <section id="questions" className="home-qs">
        <p className="home-eyebrow">Questions travelers ask</p>
        <h2>Answered by the people who book them</h2>
        <ul className="home-qgrid">
          {questions.map((q) => (
            <li key={q.slug}>
              <Link href={q.href}>
                <small>{q.tag}</small>
                {q.text}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="home-aspen">
        <p className="home-eyebrow">Booking with Aspen Travel Advisors</p>
        <h2>The hotel’s own rate, with more included</h2>
        <p className="home-aspen-text">
          Aspen Travel Advisors is a Virtuoso member and a Four Seasons Preferred Partner. Book through us and the hotel
          or cruise line adds amenities you would not get booking direct, such as an upgrade when one is free, daily
          breakfast and a property credit. The Guide holds no rates; your advisor quotes current prices for your dates.{" "}
          <Link href="/answers/virtuoso-perks-vs-booking-direct">How that compares with booking direct</Link>.
        </p>
        <div className="home-advisor">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/advisors/brian-harris.jpg" alt="Brian Harris" width={88} height={88} loading="lazy" />
          <div>
            <p className="home-advisor-name">Brian Harris</p>
            <p className="home-advisor-role">Aspen Travel Advisors</p>
          </div>
        </div>
        <AnswerAdvisorCta lead="Know where you want to go? Brian or one of the Aspen team will check dates and price it with the amenities included." />
        <p className="home-aspen-links">
          <Link href="/hotels/brands">Hotel brands and operators</Link> · <Link href="/journeys">Every journey</Link> ·{" "}
          <Link href="/hotels">Every hotel</Link> · <Link href="/villas">Every villa</Link> · <Link href="/answers">All questions</Link>
        </p>
      </section>

      <SiteFooter />
      <HomeBackToGuide />
    </div>
  );
}
