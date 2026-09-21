// Builds a course URL that contains the course name in the path,
// e.g. /courses/economia-circular-7983c301-.... The course page parses
// the real id back out so plain ids keep working too.

export function slugifyCourseName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
}

export function courseUrl(courseId: string, courseName?: string | null): string {
  const slug = courseName ? slugifyCourseName(courseName) : "";
  return slug ? `/courses/${slug}-${courseId}` : `/courses/${courseId}`;
}

// Public origin used for shared links. Preview/sandbox hosts are not
// reachable by other people, so fall back to the published domain.
const PUBLIC_ORIGIN = "https://coopaibaead.lovable.app";

export function publicOrigin(): string {
  if (typeof window === "undefined") return PUBLIC_ORIGIN;
  const host = window.location.hostname;
  const isPreview =
    host === "localhost" ||
    host === "127.0.0.1" ||
    host.endsWith(".lovableproject.com") ||
    host.startsWith("id-preview--");
  return isPreview ? PUBLIC_ORIGIN : window.location.origin;
}

// Short shareable link, e.g. https://coopaibaead.lovable.app/c/8377109d
export function courseShortUrl(courseId: string): string {
  const code = courseId.replace(/-/g, "").slice(0, 8);
  return `${publicOrigin()}/c/${code}`;
}


const UUID_RE = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

export function courseIdFromParam(param: string | undefined): string | undefined {
  if (!param) return param;
  const match = param.match(UUID_RE);
  return match ? match[1] : param;
}
