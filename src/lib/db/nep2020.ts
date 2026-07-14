export interface NepStageDetails {
  stageName: string;
  grades: string;
  ages: string;
  focus: string;
  pedagogicalPrinciples: string[];
}

export const NEP_STAGES: Record<string, NepStageDetails> = {
  FOUNDATIONAL: {
    stageName: "Foundational Stage",
    grades: "Anganwadi/Preschool/Balvatika, Class 1 & 2",
    ages: "3 to 8 years",
    focus: "Foundational Literacy & Numeracy (FLN) and play/activity-based learning",
    pedagogicalPrinciples: [
      "Flexible, multi-faceted, multi-level, play-based, activity-based, and inquiry-based learning.",
      "Focus on developing basic cognitive, physical, socio-emotional-ethical development, and early language, literacy, and numeracy.",
      "No formal examinations; assessment is completely qualitative and observation-based.",
      "Learning should emphasize counting, shapes, colors, puzzles, logical thinking, drawing, painting, music, and physical movement."
    ]
  },
  PREPARATORY: {
    stageName: "Preparatory Stage",
    grades: "Class 3 to 5",
    ages: "8 to 11 years",
    focus: "Transition to interactive classroom learning, discovery-based pedagogy",
    pedagogicalPrinciples: [
      "Gradual transition from play-based to more structured, interactive classroom learning.",
      "Introduction to light textbooks in reading, writing, speaking, physical education, art, languages, science, and mathematics.",
      "Focus on active discovery, hands-on exploration, and activity-based pedagogy.",
      "Emphasis on conceptual understanding rather than rote learning."
    ]
  },
  MIDDLE: {
    stageName: "Middle Stage",
    grades: "Class 6 to 8",
    ages: "11 to 14 years",
    focus: "Experiential learning, subject-oriented pedagogy, and vocational exposure",
    pedagogicalPrinciples: [
      "Experiential learning within each subject, exploring relations across different subjects.",
      "Introduction of subject-oriented pedagogical styles with specialized subject teachers.",
      "Focus on more abstract concepts in sciences, mathematics, arts, social sciences, and humanities.",
      "Integration of vocational crafts (e.g., carpentry, electric work, gardening, pottery) including a 10-day bagless period."
    ]
  },
  SECONDARY: {
    stageName: "Secondary Stage",
    grades: "Class 9 to 12",
    ages: "14 to 18 years",
    focus: "Multidisciplinary study, critical thinking, flexibility, and student choice",
    pedagogicalPrinciples: [
      "Multidisciplinary study with greater depth, critical thinking, and attention to student life aspirations.",
      "Increased flexibility and choice of subjects (no hard separation between arts, sciences, vocational, or academic streams).",
      "Pedagogy focused on deep analysis, logical decision-making, and conceptual clarity.",
      "Preparation for semester-based or modular assessment systems."
    ]
  }
};

export function getNepGuidelines(grade: string): { stage: NepStageDetails; matched: boolean } {
  const normalized = grade.toLowerCase();

  // Foundational matches
  if (
    normalized.includes("nursery") ||
    normalized.includes("lkg") ||
    normalized.includes("ukg") ||
    normalized.includes("kg") ||
    normalized.includes("kindergarten") ||
    normalized.includes("balvatika") ||
    /\b(1|2|one|two)(st|nd)?\s*(grade|class|std|std\.)\b/.test(normalized) ||
    normalized.includes("class 1") || normalized.includes("class 2") ||
    normalized.includes("grade 1") || normalized.includes("grade 2")
  ) {
    return { stage: NEP_STAGES.FOUNDATIONAL, matched: true };
  }

  // Middle matches
  if (
    /\b(6|7|8|six|seven|eight)(th)?\s*(grade|class|std|std\.)\b/.test(normalized) ||
    normalized.includes("class 6") || normalized.includes("class 7") || normalized.includes("class 8") ||
    normalized.includes("grade 6") || normalized.includes("grade 7") || normalized.includes("grade 8") ||
    normalized.includes("middle school")
  ) {
    return { stage: NEP_STAGES.MIDDLE, matched: true };
  }

  // Secondary matches
  if (
    /\b(9|10|11|12|nine|ten|eleven|twelve)(th)?\s*(grade|class|std|std\.)\b/.test(normalized) ||
    normalized.includes("class 9") || normalized.includes("class 10") || normalized.includes("class 11") || normalized.includes("class 12") ||
    normalized.includes("grade 9") || normalized.includes("grade 10") || normalized.includes("grade 11") || normalized.includes("grade 12") ||
    normalized.includes("high school") || normalized.includes("secondary")
  ) {
    return { stage: NEP_STAGES.SECONDARY, matched: true };
  }

  // Preparatory matches (defaulting grades 3, 4, 5 here, or fallback)
  if (
    /\b(3|4|5|three|four|five)(rd|th)?\s*(grade|class|std|std\.)\b/.test(normalized) ||
    normalized.includes("class 3") || normalized.includes("class 4") || normalized.includes("class 5") ||
    normalized.includes("grade 3") || normalized.includes("grade 4") || normalized.includes("grade 5")
  ) {
    return { stage: NEP_STAGES.PREPARATORY, matched: true };
  }

  // Fallback default: Preparatory (or general stage details)
  return { stage: NEP_STAGES.PREPARATORY, matched: false };
}
