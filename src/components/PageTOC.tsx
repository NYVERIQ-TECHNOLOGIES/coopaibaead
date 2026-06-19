import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, List } from "lucide-react";
import { cn } from "@/lib/utils";

type Item = { id: string; label: string };

/**
 * Floating sticky table-of-contents for long pages.
 * Auto-discovers any element with `data-toc-section`, an `id`, and `data-toc-label`.
 * Hidden on small screens (< lg).
 */
export default function PageTOC() {
  const [items, setItems] = useState<Item[]>([]);
  const [active, setActive] = useState<string>("");
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const scan = () => {
      const nodes = Array.from(
        document.querySelectorAll<HTMLElement>("[data-toc-section][id]")
      );
      setItems(
        nodes.map((n) => ({
          id: n.id,
          label: n.getAttribute("data-toc-label") || n.id,
        }))
      );
    };
    scan();
    const mo = new MutationObserver(scan);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => mo.disconnect();
  }, []);

  useEffect(() => {
    if (items.length === 0) return;
    // Find the nearest scrollable ancestor of the first section so IntersectionObserver works
    // inside layouts where the main element scrolls (not the window).
    const first = document.getElementById(items[0].id);
    let root: Element | null = null;
    let node: HTMLElement | null = first?.parentElement ?? null;
    while (node) {
      const style = getComputedStyle(node);
      if (/(auto|scroll)/.test(style.overflowY)) {
        root = node;
        break;
      }
      node = node.parentElement;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { root, rootMargin: "-30% 0px -60% 0px", threshold: [0, 0.25, 0.5, 1] }
    );
    items.forEach((i) => {
      const el = document.getElementById(i.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [items]);

  if (items.length < 2) return null;

  const go = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <aside
      className={cn(
        "hidden lg:flex fixed right-4 top-1/2 -translate-y-1/2 z-30",
        "flex-col gap-2"
      )}
      aria-label="Índice da página"
    >
      <div
        className={cn(
          "bg-card/95 backdrop-blur border border-border rounded-xl shadow-elevated",
          "transition-all duration-200 overflow-hidden",
          collapsed ? "w-10" : "w-56"
        )}
      >
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="w-full flex items-center justify-between gap-2 px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
          aria-label={collapsed ? "Expandir índice" : "Recolher índice"}
        >
          <span className="flex items-center gap-2">
            <List className="w-4 h-4" />
            {!collapsed && <span>Nesta página</span>}
          </span>
          {collapsed ? (
            <ChevronLeft className="w-3.5 h-3.5" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5" />
          )}
        </button>
        {!collapsed && (
          <nav className="max-h-[60vh] overflow-y-auto py-1">
            {items.map((i) => (
              <button
                key={i.id}
                onClick={() => go(i.id)}
                className={cn(
                  "w-full text-left text-xs px-3 py-2 truncate border-l-2 transition-colors",
                  active === i.id
                    ? "border-primary bg-primary/5 text-foreground font-medium"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40"
                )}
                title={i.label}
              >
                {i.label}
              </button>
            ))}
          </nav>
        )}
      </div>
    </aside>
  );
}
