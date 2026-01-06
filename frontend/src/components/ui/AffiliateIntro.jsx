import React, { useEffect } from "react";
import { ArrowRight } from "lucide-react";

export function AffiliateIntro({ onLaunch, onLabs, isMember }) {
  useEffect(() => {
    if (isMember) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("reveal-visible");
          }
        });
      },
      { threshold: 0.1 }
    );
    document.querySelectorAll(".affiliate-hero__section").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [isMember]);

  useEffect(() => {
    if (isMember) return;
    const carousels = [
      {
        id: "affiliate-carousel-1",
        slides: [
          "/affiliate/assets/IMG_2591.PNG",
          "/affiliate/assets/IMG_2605.PNG",
          "/affiliate/assets/IMG_2606.PNG",
          "/affiliate/assets/can-before.jpg",
        ],
        caption: "Studio-quality product shots from a sloppy drinking phone pic.",
      },
      {
        id: "affiliate-carousel-2",
        slides: [
          "/affiliate/assets/sculpture_pink.jpg",
          "/affiliate/assets/sculpture_red.jpg",
          "/affiliate/assets/sculpture_charcoal.jpg",
          "/affiliate/assets/sculpture_before.jpg",
        ],
        caption: "Chrome tests everything — light, reflection, patience. nudio brought order to the chaos.",
      },
    ];

    carousels.forEach((carousel) => {
      const container = document.getElementById(carousel.id);
      if (!container) return;
      const track = container.querySelector(".affiliate-carousel__track");
      const dots = Array.from(container.querySelectorAll(".affiliate-carousel__dot"));
      let index = 0;
      let timer;

      const update = () => {
        track.style.transform = `translateX(-${index * 100}%)`;
        dots.forEach((dot, i) => dot.classList.toggle("active", i === index));
      };

      const next = () => {
        index = (index + 1) % carousel.slides.length;
        update();
      };
      const prev = () => {
        index = (index - 1 + carousel.slides.length) % carousel.slides.length;
        update();
      };
      const start = () => (timer = setInterval(next, 3500));
      const reset = () => {
        clearInterval(timer);
        start();
      };

      container.addEventListener("click", (event) => {
        const rect = container.getBoundingClientRect();
        const x = event.clientX - rect.left;
        if (x < rect.width / 2) prev();
        else next();
        reset();
      });

      let startX = 0;
      container.addEventListener("touchstart", (event) => {
        startX = event.touches[0].clientX;
      });
      container.addEventListener(
        "touchend",
        (event) => {
          const diff = startX - event.changedTouches[0].clientX;
          if (Math.abs(diff) > 50) {
            if (diff > 0) next();
            else prev();
            reset();
          }
        },
        { passive: true }
      );

      start();
    });
  }, [isMember]);

  const sliders = [
    { title: "Stoneware plate", tagline: "studio polish", before: "/affiliate/assets/plate-before.jpg", after: "/affiliate/assets/plate-after.jpg" },
    { title: "Book cover", tagline: "color fidelity", before: "/affiliate/assets/book-before.jpg", after: "/affiliate/assets/book-after.jpg" },
    { title: "Label accuracy", tagline: "UPC clarity", before: "/affiliate/assets/charmin-before.jpg", after: "/affiliate/assets/charmin-after.jpg" },
    { title: "Ceramic vase", tagline: "texture preserved", before: "/affiliate/assets/vase-before.jpg", after: "/affiliate/assets/vase-after.jpg" },
    { title: "Workbench stool", tagline: "natural shadows", before: "/affiliate/assets/stool-before.jpg", after: "/affiliate/assets/stool-after.jpg" },
    { title: "Antique cannon", tagline: "museum ready", before: "/affiliate/assets/cannon-before.jpg", after: "/affiliate/assets/cannon-after.jpg" },
    { title: "Game ball", tagline: "studio drama", before: "/affiliate/assets/football-before.jpg", after: "/affiliate/assets/football-after.jpg" },
    { title: "Produce realism", tagline: "blemishes stay", before: "/affiliate/assets/potato-before.jpg", after: "/affiliate/assets/potato-after.jpg" },
  ];

  useEffect(() => {
    if (isMember) return;
    const frames = document.querySelectorAll(".affiliate-slider-frame");
    const cleanups = [];
    frames.forEach((frame) => {
      const beforeImg = frame.querySelector(".affiliate-slider-before");
      const handle = frame.querySelector(".affiliate-slider-handle");
      if (!beforeImg || !handle) return;
      const update = (clientX) => {
        const rect = frame.getBoundingClientRect();
        let pos = ((clientX - rect.left) / rect.width) * 100;
        pos = Math.min(100, Math.max(0, pos));
        beforeImg.style.clipPath = `inset(0 ${100 - pos}% 0 0)`;
        handle.style.left = `${pos}%`;
      };
      const onMouseMove = (event) => update(event.clientX);
      const onTouchMove = (event) => {
        event.preventDefault();
        update(event.touches[0].clientX);
      };
      frame.addEventListener("mousemove", onMouseMove);
      frame.addEventListener("touchmove", onTouchMove, { passive: false });
      handle.style.left = "50%";
      beforeImg.style.clipPath = "inset(0 50% 0 0)";
      cleanups.push(() => {
        frame.removeEventListener("mousemove", onMouseMove);
        frame.removeEventListener("touchmove", onTouchMove);
      });
    });
    return () => cleanups.forEach((fn) => fn());
  }, [isMember]);

  if (isMember) return null;

  return (
    <section className="affiliate-gate" style={{ backgroundColor: "#050305", color: "#f8f8ff" }}>
      <div className="affiliate-hero">
        <div className="affiliate-hero__overlay">
          <div className="affiliate-hero__content">
            <img src="/affiliate/assets/NudioOverClear.png" alt="nudio logotype" className="affiliate-hero__logo" />
            <h1>
              <span className="affiliate-highlight-white">It is time to </span>
              <span className="affiliate-highlight-gold">re-light the web.</span>
            </h1>
            <div className="affiliate-hero__statement">
              nudio is bringing <strong>clarity</strong> and <span className="affiliate-highlight-gold">artistry</span> to the images that define how we sell, share, and show the world our work.
            </div>
            <p className="affiliate-hero__body">
              nudio is an easy to use AI-powered mobile product photography studio built with integrity guardrails. While other tools seek to persuade through retouching or illusion, we focus on preserving what’s real — the honest details, textures, and character that give objects their
              story.
            </p>
            <div className="affiliate-hero__cta">
              <button type="button" onClick={onLaunch} className="affiliate-hero__cta-primary">
                Start nudio <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="affiliate-content">
        <div className="affiliate-content__wrap">
          <section className="affiliate-hero__section">
            <h2>
              See the <span className="affiliate-highlight-gold">nudio effect</span>
            </h2>
            <div className="affiliate-carousel" id="affiliate-carousel-1">
              <div className="affiliate-carousel__track">
                <img src="/affiliate/assets/IMG_2591.PNG" alt="Can after pink" />
                <img src="/affiliate/assets/IMG_2605.PNG" alt="Can after red" />
                <img src="/affiliate/assets/IMG_2606.PNG" alt="Can after bone" />
                <img src="/affiliate/assets/can-before.jpg" alt="Can before nudio" />
              </div>
              <div className="affiliate-carousel__dots">
                <span className="affiliate-carousel__dot active" />
                <span className="affiliate-carousel__dot" />
                <span className="affiliate-carousel__dot" />
                <span className="affiliate-carousel__dot" />
              </div>
            </div>
            <p className="affiliate-carousel__caption">Studio-quality product shots from a sloppy drinking phone pic.</p>
          </section>

          <section className="affiliate-hero__section">
            <h2>
              Art of the <span className="affiliate-highlight-gold">impossible</span>
            </h2>
            <div className="affiliate-carousel" id="affiliate-carousel-2">
              <div className="affiliate-carousel__track">
                <img src="/affiliate/assets/sculpture_pink.jpg" alt="Chrome pink" />
                <img src="/affiliate/assets/sculpture_red.jpg" alt="Chrome red" />
                <img src="/affiliate/assets/sculpture_charcoal.jpg" alt="Chrome charcoal" />
                <img src="/affiliate/assets/sculpture_before.jpg" alt="Chrome before" />
              </div>
              <div className="affiliate-carousel__dots">
                <span className="affiliate-carousel__dot active" />
                <span className="affiliate-carousel__dot" />
                <span className="affiliate-carousel__dot" />
                <span className="affiliate-carousel__dot" />
              </div>
            </div>
            <p className="affiliate-carousel__caption">Chrome tests everything — light, reflection, patience. nudio brought order to the chaos.</p>
          </section>

          <section className="affiliate-hero__section">
            <h2>
              After <span className="affiliate-highlight-gold">&amp;</span> Before
            </h2>
            <div className="affiliate-slider-grid">
              {sliders.map((item) => (
                <div className="affiliate-slider-card" key={item.title}>
                  <div className="affiliate-slider-frame">
                    <img className="affiliate-slider-after" src={item.after} alt={`${item.title} after`} />
                    <img className="affiliate-slider-before" src={item.before} alt={`${item.title} before`} />
                    <div className="affiliate-slider-handle" />
                  </div>
                  <div className="affiliate-slider-meta">
                    <span>{item.title}</span>
                    <span className="affiliate-highlight-gold">{item.tagline}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="affiliate-hero__section">
            <h2>
              The honest <span className="affiliate-highlight-gold">potato</span>
            </h2>
            <p className="affiliate-hero__lede-sub">—blemishes, sprouts, and all.</p>
            <p>
              nudio smooths the lighting and color to give it marketplace-ready polish, but leaves the reality intact. Patina-rich historical items like the cannon keep every mark too, but nudio glows up with gallery-grade lighting instead of funky phone flash.
            </p>
          </section>

          <section className="affiliate-hero__section">
            <h2>
              The movement:
              <br />
              Keep it real. <span className="affiliate-highlight-gold">Make it nudio.</span>
            </h2>
            <p className="affiliate-hero__lede-sub">
              With nudio, product photography becomes <strong>nudioing</strong>.
            </p>
            <p>
              It is the moment ordinary turns beautifully honest — your fast lane from phone shot to polished, studio-lit <strong>nudio</strong>.
            </p>
          </section>

          <section className="affiliate-hero__section">
            <h2>
              Innovation <span className="affiliate-highlight-gold">roadmap</span>
            </h2>
            <p>Our Labs section explores more experimental features that don’t yet meet our standards of accuracy but offer a glimpse into what’s next.</p>
          </section>
        </div>
      </div>

      <footer className="affiliate-landing__footer">
        <a href="/terms-of-service">Terms of Service</a>
        <a href="/privacy-policy">Privacy Policy</a>
      </footer>
    </section>
  );
}
