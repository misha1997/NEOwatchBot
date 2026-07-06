// Community page (community.html): fully static — forum categories, photo
// gallery, weekly quiz leaderboard, observation diaries, local meetups.
// No /api calls (app.js absent on this page); pure JSX verbatim from template.
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import SectionHead from "../components/primitives/SectionHead";

export default function Community() {
  const { t } = useTranslation();
  useEffect(() => { document.title = t("title.community"); }, [t]);

  const CATS = [
    { ic: "🔭", h: t("community.cats.c1_h"), p: t("community.cats.c1_p"), n: t("community.cats.c1_n"), unit: t("community.units.themes"), last: t("community.last.min", { n: 12 }) },
    { ic: "🛠️", h: t("community.cats.c2_h"), p: t("community.cats.c2_p"), n: t("community.cats.c2_n"), unit: t("community.units.themes"), last: t("community.last.min", { n: 31 }) },
    { ic: "📷", h: t("community.cats.c3_h"), p: t("community.cats.c3_p"), n: t("community.cats.c3_n"), unit: t("community.units.themes"), last: t("community.last.hr", { n: 1 }) },
    { ic: "🚀", h: t("community.cats.c4_h"), p: t("community.cats.c4_p"), n: t("community.cats.c4_n"), unit: t("community.units.themes"), last: t("community.last.min", { n: 4 }) },
    { ic: "🌱", h: t("community.cats.c5_h"), p: t("community.cats.c5_p"), n: t("community.cats.c5_n"), unit: t("community.units.themes"), last: t("community.last.hr", { n: 2 }) },
    { ic: "📍", h: t("community.cats.c6_h"), p: t("community.cats.c6_p"), n: t("community.cats.c6_n"), unit: t("community.units.themesFew"), last: t("community.last.min", { n: 45 }) },
  ];

  const PHOTOS = [
    { bg: "linear-gradient(160deg,#1a2b4d,#0d0f1c)", t: t("community.photos.p1_t"), a: t("community.photos.p1_a") },
    { bg: "linear-gradient(160deg,#2d1a4d,#0d0f1c)", t: t("community.photos.p2_t"), a: t("community.photos.p2_a") },
    { bg: "linear-gradient(160deg,#1a4d3a,#0d0f1c)", t: t("community.photos.p3_t"), a: t("community.photos.p3_a") },
    { bg: "linear-gradient(160deg,#4d1a2b,#0d0f1c)", t: t("community.photos.p4_t"), a: t("community.photos.p4_a") },
  ];

  const LB = [
    { rank: 1, name: "olena_sky", pts: t("community.lb.pts", { n: "2 940" }) },
    { rank: 2, name: "astro_taras", pts: t("community.lb.pts", { n: "2 715" }) },
    { rank: 3, name: "max_orbit", pts: t("community.lb.pts", { n: "2 590" }) },
    { rank: 4, name: "nichna_varta", pts: t("community.lb.pts", { n: "2 402" }) },
    { rank: 5, name: "kosmoved", pts: t("community.lb.pts", { n: "2 188" }) },
  ];

  const QUIZ_OPTS = [t("community.quiz.opt1"), t("community.quiz.opt2"), t("community.quiz.opt3")];

  const DIARIES = [
    { user: t("community.diaries.d1_user"), when: t("community.diaries.d1_when"), text: t("community.diaries.d1_text") },
    { user: t("community.diaries.d2_user"), when: t("community.diaries.d2_when"), text: t("community.diaries.d2_text") },
  ];

  const MEETUPS = [
    { tag: t("community.meetups.m1_tag"), h: t("community.meetups.m1_h"), p: t("community.meetups.m1_p"), num: t("community.meetups.m1_num") },
    { tag: t("community.meetups.m2_tag"), h: t("community.meetups.m2_h"), p: t("community.meetups.m2_p"), num: t("community.meetups.m2_num") },
  ];

  return (
    <>
      <section className="hero">
        <div className="wrap">
          <div style={{ maxWidth: 680 }}>
            <div className="eyebrow">{t("community.hero.eyebrow")}</div>
            <h1 className="hero-title" dangerouslySetInnerHTML={{ __html: t("community.hero.title") }} />
            <p className="hero-sub">{t("community.hero.sub")}</p>
            <div className="hero-actions">
              <a href="#" className="btn primary">{t("community.hero.login")}</a>
              <a href="#forum" className="btn ghost">{t("community.hero.browse")}</a>
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="forum">
        <div className="wrap">
          <SectionHead eyebrow={t("community.s1.eyebrow")} title={t("community.s1.title")} linkHref="#" linkLabel={t("community.s1.link")} />
          <div className="cat-list">
            {CATS.map((c, i) => (
              <div className="cat" key={i}>
                <div className="ic">{c.ic}</div>
                <div><h4>{c.h}</h4><p>{c.p}</p></div>
                <div className="stat"><b>{c.n}</b>{c.unit}</div>
                <div className="last">{c.last}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section" id="gallery">
        <div className="wrap">
          <SectionHead eyebrow={t("community.s2.eyebrow")} title={t("community.s2.title")} linkHref="#" linkLabel={t("community.s2.link")} />
          <div className="gal">
            {PHOTOS.map((p, i) => (
              <div className="ph" key={i} style={{ background: p.bg }}>
                <div className="info"><b>{p.t}</b><span>{p.a}</span></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section" id="quiz">
        <div className="wrap">
          <SectionHead eyebrow={t("community.s3.eyebrow")} title={t("community.s3.title")} linkHref="#" linkLabel={t("community.s3.link")} />
          <div className="grid cols-2">
            <div className="card">
              <div className="lb">
                {LB.map((r) => (
                  <div className="lb-row" key={r.rank}>
                    <span className="rank">{r.rank}</span>
                    <span className="av" />
                    <span className="name">{r.name}</span>
                    <span className="pts">{r.pts}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="card">
              <div className="k">{t("community.quiz.qTitle")}</div>
              <div style={{ fontSize: "15.5px", fontWeight: 500, marginTop: 12, lineHeight: 1.5 }}>{t("community.quiz.q")}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 16 }}>
                {QUIZ_OPTS.map((o) => (
                  <div className="pill" key={o} style={{ textAlign: "left", padding: "10px 14px" }}>{o}</div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="diary">
        <div className="wrap">
          <SectionHead eyebrow={t("community.s4.eyebrow")} title={t("community.s4.title")} linkHref="#" linkLabel={t("community.s4.link")} />
          {DIARIES.map((d, i) => (
            <div className="diary" key={i}>
              <div className="meta">
                <div className="user"><span className="av" />{d.user}</div>
                <div className="when">{d.when}</div>
              </div>
              <p>{d.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <SectionHead eyebrow={t("community.s5.eyebrow")} title={t("community.s5.title")} />
          {MEETUPS.map((m, i) => (
            <div className="feat-row" key={i}>
              <div className="tag">{m.tag}</div>
              <div><h4>{m.h}</h4><p>{m.p}</p></div>
              <div className="num">{m.num}</div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}