"use client";

import { cn } from "@/lib/utils";
import { useEffect, useRef, useState } from "react";

type Step = {
  label: string;
  title: string;
  body: string;
};

const steps: Step[] = [
  {
    label: "Pre-sell · BOQ draft",
    title: "You request — we draft the BOQ",
    body: "Tell us what you need. We prepare a detailed Bill of Quantities draft — every device, cable and license, scoped to your site.",
  },
  {
    label: "The offer",
    title: "We send you a clear offer",
    body: "Your BOQ becomes an itemized commercial offer with transparent pricing. Review it, adjust it, approve it — no surprises.",
  },
  {
    label: "Installation",
    title: "We install the network",
    body: "Our engineers deploy and cable every layer on-site — gateway, switching, access points and edge devices, mounted and tested.",
  },
  {
    label: "Programming",
    title: "We program & configure it",
    body: "Routing, security, WiFi and policies — configured, tuned and tested. We hand over a network that's running, documented and yours.",
  },
];

export const HowItWorks = () => {
  const sectionRef = useRef<HTMLElement>(null);
  const stepRefs = useRef<(HTMLLIElement | null)[]>([]);
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState<boolean[]>(() =>
    steps.map(() => false),
  );

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    let frame = 0;

    const measure = () => {
      const rect = section.getBoundingClientRect();
      const referenceLine = window.innerHeight * 0.72;
      const raw = (referenceLine - rect.top) / rect.height;
      setProgress(Math.min(1, Math.max(0, raw)));
    };

    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const index = Number(entry.target.getAttribute("data-index"));
          setVisible((prev) => {
            if (prev[index]) return prev;
            const next = [...prev];
            next[index] = true;
            return next;
          });
          observer.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px -22% 0px", threshold: 0 },
    );

    stepRefs.current.forEach((el) => {
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      className="w-full border-y border-hairline bg-page pt-22 pb-26"
    >
      <header className="mx-auto max-w-xl px-6 text-center">
        <p className="font-grotesk text-xs font-bold tracking-widest text-primary uppercase">
          How it works
        </p>
        <h2 className="font-heading mt-4 text-4xl leading-tight text-ink">
          From request to a running network.
        </h2>
        <p className="font-grotesk mt-4 text-lg text-muted">
          Four steps. We handle every layer of the deployment — and you sign off
          at each checkpoint.
        </p>
      </header>

      <ol className="relative mx-auto mt-16 flex max-w-4xl flex-col gap-12 px-6 md:mt-20 md:gap-4">
        <div
          aria-hidden="true"
          className="absolute top-0 bottom-0 left-6 z-0 w-0.75 -translate-x-1/2 rounded-full bg-hairline md:left-1/2"
        >
          <div
            className="w-full rounded-full bg-linear-to-b from-violet-400 to-primary"
            style={{ height: `${progress * 100}%` }}
          />
        </div>

        {steps.map((step, index) => {
          const isLeft = index % 2 === 0;
          const isLast = index === steps.length - 1;
          const isVisible = visible[index];

          return (
            <li
              key={step.title}
              data-index={index}
              ref={(el) => {
                stepRefs.current[index] = el;
              }}
              className="relative pl-20 md:grid md:grid-cols-2 md:items-center md:gap-16 md:py-8 md:pl-0"
            >
              <span
                className={cn(
                  "absolute top-1/2 left-6 z-10 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-primary shadow-[0_8px_24px_-6px_rgba(124,58,237,0.5)] transition-all duration-500 motion-safe:ease-spring md:left-1/2",
                  isLast ? "bg-primary" : "bg-page",
                  isVisible ? "" : "motion-safe:scale-50 motion-safe:opacity-0",
                )}
              >
                <span
                  className={cn(
                    "font-heading text-2xl",
                    isLast ? "text-white" : "text-primary",
                  )}
                >
                  {index + 1}
                </span>
              </span>

              <div
                className={cn(
                  "transition-all duration-700 motion-safe:ease-out",
                  isLeft
                    ? "md:col-start-1 md:justify-self-end"
                    : "md:col-start-2 md:justify-self-start",
                  isVisible
                    ? ""
                    : "motion-safe:translate-y-11 motion-safe:opacity-0",
                )}
              >
                <div className="max-w-sm rounded-[18px] border border-hairline bg-surface p-6 shadow-[0_18px_40px_rgba(20,22,27,0.07)]">
                  <p className="font-grotesk text-xs font-semibold tracking-wider text-primary uppercase">
                    {step.label}
                  </p>
                  <h3 className="font-heading mt-2 text-xl text-ink">
                    {step.title}
                  </h3>
                  <p className="font-grotesk mt-2 text-sm leading-relaxed text-muted">
                    {step.body}
                  </p>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
};
