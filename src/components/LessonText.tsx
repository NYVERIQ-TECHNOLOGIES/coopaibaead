import { Fragment } from "react";

/**
 * Renderizador leve de conteúdo didático em texto (markdown simplificado).
 * Suporta: # ## ### títulos, listas com "- ", listas numeradas, > destaques,
 * separador "---", **negrito** e parágrafos.
 */
function inline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) =>
    p.startsWith("**") && p.endsWith("**") ? (
      <strong key={i} className="font-semibold text-foreground">
        {p.slice(2, -2)}
      </strong>
    ) : (
      <Fragment key={i}>{p}</Fragment>
    )
  );
}

export default function LessonText({ content }: { content: string }) {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const blocks: JSX.Element[] = [];
  let list: string[] = [];
  let ordered = false;

  const flushList = (key: string) => {
    if (list.length === 0) return;
    const items = list;
    list = [];
    blocks.push(
      ordered ? (
        <ol key={key} className="list-decimal pl-5 space-y-1.5 text-sm sm:text-[0.95rem] text-muted-foreground">
          {items.map((it, i) => (
            <li key={i}>{inline(it)}</li>
          ))}
        </ol>
      ) : (
        <ul key={key} className="list-disc pl-5 space-y-1.5 text-sm sm:text-[0.95rem] text-muted-foreground">
          {items.map((it, i) => (
            <li key={i}>{inline(it)}</li>
          ))}
        </ul>
      )
    );
  };

  lines.forEach((raw, idx) => {
    const line = raw.trimEnd();
    const key = `b-${idx}`;

    if (/^\s*[-*]\s+/.test(line)) {
      if (ordered) flushList(`${key}-f`);
      ordered = false;
      list.push(line.replace(/^\s*[-*]\s+/, ""));
      return;
    }
    if (/^\s*\d+[.)]\s+/.test(line)) {
      if (!ordered) flushList(`${key}-f`);
      ordered = true;
      list.push(line.replace(/^\s*\d+[.)]\s+/, ""));
      return;
    }
    flushList(`${key}-f`);

    if (!line.trim()) return;

    if (line.startsWith("### ")) {
      blocks.push(
        <h4 key={key} className="font-heading font-semibold text-foreground text-sm sm:text-base mt-4">
          {inline(line.slice(4))}
        </h4>
      );
    } else if (line.startsWith("## ")) {
      blocks.push(
        <h3 key={key} className="font-heading font-bold text-foreground text-base sm:text-lg mt-6">
          {inline(line.slice(3))}
        </h3>
      );
    } else if (line.startsWith("# ")) {
      blocks.push(
        <h2 key={key} className="font-heading font-extrabold text-foreground text-lg sm:text-2xl mt-2">
          {inline(line.slice(2))}
        </h2>
      );
    } else if (line.startsWith("> ")) {
      blocks.push(
        <div
          key={key}
          className="rounded-xl border border-primary/25 bg-primary/5 px-4 py-3 text-sm text-foreground"
        >
          {inline(line.slice(2))}
        </div>
      );
    } else if (/^---+$/.test(line.trim())) {
      blocks.push(<hr key={key} className="border-border/70 my-4" />);
    } else {
      blocks.push(
        <p key={key} className="text-sm sm:text-[0.95rem] leading-relaxed text-muted-foreground">
          {inline(line)}
        </p>
      );
    }
  });
  flushList("b-final");

  return <article className="space-y-3 max-w-none">{blocks}</article>;
}
