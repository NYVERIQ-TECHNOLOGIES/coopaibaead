import { describe, expect, it } from "vitest";
import { lessonOpenAction, courseProgress, canSyncCourseProgress } from "@/lib/courseProgress";

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
});