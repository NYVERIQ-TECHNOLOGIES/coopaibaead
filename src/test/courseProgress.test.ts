import { describe, expect, it } from "vitest";
import { lessonOpenAction, courseProgress, canSyncCourseProgress, personalCourseUnits } from "@/lib/courseProgress";

describe("course completion", () => {
  it("opening a lesson only opens its content, never completes it", () => {
    expect(lessonOpenAction(false, true)).toBe("open");
    expect(courseProgress(4, 0)).toEqual({ percent: 0, complete: false });
  });
  it("does not open locked or missing content", () => {
    expect(lessonOpenAction(true, true)).toBe("blocked");
    expect(lessonOpenAction(false, false)).toBe("none");
  });
  it("requires all items to be completed before displaying 100%", () => {
    expect(courseProgress(4, 1)).toEqual({ percent: 25, complete: false });
    expect(courseProgress(4, 4)).toEqual({ percent: 100, complete: true });
    expect(courseProgress(201, 200)).toEqual({ percent: 99, complete: false });
    expect(courseProgress(0, 0)).toEqual({ percent: 0, complete: false });
  });
  it("never saves partial progress while any source is loading or failed", () => {
    expect(canSyncCourseProgress([true, true, false, true])).toBe(false);
    expect(canSyncCourseProgress([true, true, true, true])).toBe(true);
  });
  it("counts an administrator's watched lesson using personal completion, not shared lesson flags", () => {
    const lessons = [{ id: "watched", completed: false }, { id: "unwatched", completed: true }];
    const units = personalCourseUnits(lessons, [{ id: "exam" }], new Set(["watched"]), new Set());
    expect(units).toEqual({ lessons: 1, evaluations: 0 });
    expect(courseProgress(3, units.lessons + units.evaluations)).toEqual({ percent: 33, complete: false });
  });
  it("never presumes exams passed or lessons watched from course management access", () => {
    expect(personalCourseUnits([{ id: "lesson" }], [{ id: "exam" }], new Set(), new Set()))
      .toEqual({ lessons: 0, evaluations: 0 });
  });
  it("keeps each account's watched lessons separate", () => {
    const lessons = [{ id: "first" }, { id: "second" }, { id: "third" }, { id: "fourth" }];
    const watchedAccount = personalCourseUnits(lessons, [], new Set(["first"]), new Set());
    const otherAccount = personalCourseUnits(lessons, [], new Set(), new Set());
    expect(courseProgress(4, watchedAccount.lessons)).toEqual({ percent: 25, complete: false });
    expect(courseProgress(4, otherAccount.lessons)).toEqual({ percent: 0, complete: false });
  });
});