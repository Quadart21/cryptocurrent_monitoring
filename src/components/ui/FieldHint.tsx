"use client";

/** Small «!» icon with hover/focus tooltip for field hints. */
export function FieldHint({ text }: { text: string }) {
  return (
    <span className="group relative inline-flex align-middle">
      <button
        type="button"
        tabIndex={0}
        aria-label="Подсказка"
        className="inline-flex size-4 shrink-0 items-center justify-center rounded-full border border-line bg-bg-soft text-[10px] font-bold leading-none text-ink-muted transition hover:border-accent hover:text-accent focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25"
      >
        !
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-[calc(100%+6px)] left-1/2 z-30 w-64 -translate-x-1/2 rounded-xl border border-line bg-bg-elevated px-3 py-2 text-left text-[11px] font-normal normal-case tracking-normal text-ink shadow-[var(--card-shadow)] opacity-0 transition duration-150 group-hover:opacity-100 group-focus-within:opacity-100 sm:w-72"
      >
        {text}
        <span
          aria-hidden
          className="absolute left-1/2 top-full -mt-px -translate-x-1/2 border-4 border-transparent border-t-[var(--line)]"
        />
      </span>
    </span>
  );
}
