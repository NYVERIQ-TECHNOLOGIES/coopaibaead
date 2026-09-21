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

const UUID_RE = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

export function courseIdFromParam(param: string | undefined): string | undefined {
  if (!param) return param;
  const match = param.match(UUID_RE);
  return match ? match[1] : param;
}
