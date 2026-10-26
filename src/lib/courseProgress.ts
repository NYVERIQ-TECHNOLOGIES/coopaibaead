export function lessonOpenAction(locked: boolean, hasContent: boolean): "blocked" | "open" | "none" {
  return locked ? "blocked" : hasContent ? "open" : "none";
}

export function courseProgress(totalUnits: number, completedUnits: number) {
  const complete = totalUnits > 0 && completedUnits >= totalUnits;
  // An unfinished course must never display 100%, even when rounding.
  const percent = totalUnits <= 0 ? 0 : complete ? 100 : Math.min(99, Math.round(completedUnits / totalUnits * 100));
  return { percent, complete };
}

export function canSyncCourseProgress(states: boolean[]) {
  return states.every(Boolean);
}

// Personal progress must use the viewer's records, never shared lesson flags or management privileges.
export function personalCourseUnits(
  lessons: { id: string }[],
  evaluations: { id: string }[],
  completedLessonIds: Set<string>,
  passedEvaluationIds: Set<string>,
) {
  return {
    lessons: lessons.filter((lesson) => completedLessonIds.has(lesson.id)).length,
    evaluations: evaluations.filter((evaluation) => passedEvaluationIds.has(evaluation.id)).length,
  };
}