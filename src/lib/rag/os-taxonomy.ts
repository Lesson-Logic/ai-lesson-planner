import fs from "fs";
import path from "path";

export interface MicroTopic {
  id: string;
  type: string;
  subject: string;
  domain: string;
  name: string;
  description: string;
  ageRangeStart: number;
  ageRangeEnd: number;
  evidence: string[];
  assessmentPrompt?: string;
  standards?: string[];
}

export interface DependencyEdge {
  topicId: string;
  prerequisiteId: string;
  strength: "hard" | "soft";
  reason: string;
}

export interface ClusterSummary {
  subject: string;
  domain: string;
  ageRangeStart: number;
  summary: string;
}

let topicsCache: MicroTopic[] | null = null;
let dependenciesCache: DependencyEdge[] | null = null;
let clustersCache: ClusterSummary[] | null = null;
let topicByIdMapCache: Map<string, MicroTopic> | null = null;

function loadTaxonomyData() {
  if (topicsCache && dependenciesCache && clustersCache && topicByIdMapCache) {
    return {
      topics: topicsCache,
      dependencies: dependenciesCache,
      clusters: clustersCache,
      topicByIdMap: topicByIdMapCache
    };
  }

  const dataDir = path.join(process.cwd(), "src", "lib", "rag", "data");
  
  const topicsRaw = JSON.parse(fs.readFileSync(path.join(dataDir, "topics.json"), "utf-8"));
  const depsRaw = JSON.parse(fs.readFileSync(path.join(dataDir, "dependencies.json"), "utf-8"));
  const clustersRaw = JSON.parse(fs.readFileSync(path.join(dataDir, "clusters.json"), "utf-8"));

  const loadedTopics: MicroTopic[] = topicsRaw.topics || [];
  const loadedDeps: DependencyEdge[] = depsRaw.dependencies || [];
  const loadedClusters: ClusterSummary[] = clustersRaw.clusters || [];

  const loadedMap = new Map<string, MicroTopic>();
  loadedTopics.forEach(t => loadedMap.set(t.id, t));

  topicsCache = loadedTopics;
  dependenciesCache = loadedDeps;
  clustersCache = loadedClusters;
  topicByIdMapCache = loadedMap;

  return {
    topics: loadedTopics,
    dependencies: loadedDeps,
    clusters: loadedClusters,
    topicByIdMap: loadedMap
  };
}

/**
 * Helper to convert Grade string (e.g. "Grade 3", "3rd Grade", "Class 5", "UK Year 2", "K") to estimated age range.
 */
function parseAgeFromGrade(gradeStr: string): { ageMin: number; ageMax: number } {
  const normalized = gradeStr.toLowerCase().trim();
  if (normalized.includes("k") || normalized.includes("kindergarten")) return { ageMin: 5, ageMax: 6 };
  if (normalized.includes("nursery") || normalized.includes("pre")) return { ageMin: 3, ageMax: 5 };

  const match = normalized.match(/\d+/);
  if (match) {
    const gradeNum = parseInt(match[0], 10);
    const baseAge = 5 + gradeNum;
    return { ageMin: baseAge, ageMax: baseAge + 1 };
  }
  return { ageMin: 5, ageMax: 12 };
}

/**
 * Search micro-topics by subject and keywords in objectives
 */
export function searchMicroTopics(
  query: string,
  subjectFilter?: string,
  limit: number = 5
): MicroTopic[] {
  const { topics } = loadTaxonomyData();
  const queryTerms = query.toLowerCase().split(/\W+/).filter(t => t.length > 2);
  const normalizedSubject = subjectFilter?.toLowerCase().trim();

  const scored = topics.map(topic => {
    let score = 0;

    // Subject bonus
    if (normalizedSubject && topic.subject.toLowerCase().includes(normalizedSubject)) {
      score += 10;
    } else if (normalizedSubject && normalizedSubject.includes(topic.subject.toLowerCase())) {
      score += 8;
    }

    const nameLower = topic.name.toLowerCase();
    const descLower = topic.description.toLowerCase();
    const domainLower = topic.domain.toLowerCase();

    for (const term of queryTerms) {
      if (nameLower.includes(term)) score += 15;
      if (domainLower.includes(term)) score += 8;
      if (descLower.includes(term)) score += 3;
    }

    return { topic, score };
  });

  return scored
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(item => item.topic);
}

/**
 * Get prerequisite dependencies for a topic
 */
export function getPrerequisitesForTopic(topicId: string) {
  const { dependencies, topicByIdMap } = loadTaxonomyData();
  const prereqEdges = dependencies.filter(d => d.topicId === topicId);
  return prereqEdges.map(edge => {
    const prereqTopic = topicByIdMap.get(edge.prerequisiteId);
    return {
      edge,
      prereqTopic
    };
  }).filter(item => item.prereqTopic !== undefined);
}

/**
 * Retrieve comprehensive Marble OS-Taxonomy RAG context block
 */
export function getMarbleTaxonomyRAGContext(
  grade: string,
  subject: string,
  objectives: string
): string {
  const { clusters } = loadTaxonomyData();
  const { ageMin, ageMax } = parseAgeFromGrade(grade);
  const matchedTopics = searchMicroTopics(`${subject} ${objectives}`, subject, 4);

  if (matchedTopics.length === 0) {
    const fallbackTopics = searchMicroTopics(objectives, undefined, 3);
    matchedTopics.push(...fallbackTopics);
  }

  // Find matching domain clusters
  const matchedClusters = clusters.filter(c => {
    const subjectMatch = c.subject.toLowerCase() === subject.toLowerCase() ||
      c.subject.toLowerCase().includes(subject.toLowerCase());
    return subjectMatch && Math.abs(c.ageRangeStart - ageMin) <= 3;
  }).slice(0, 2);

  let contextMarkdown = `\n\n### 🧬 Marble OS-Taxonomy RAG Context Grounding\n`;
  contextMarkdown += `You are using the official Marble OS Skill Taxonomy (1,590 micro-topics, prerequisite graph, and mastery criteria).\n\n`;

  if (matchedClusters.length > 0) {
    contextMarkdown += `#### Domain Mastery Framework Summary:\n`;
    matchedClusters.forEach(c => {
      contextMarkdown += `- **${c.subject} (${c.domain})**: ${c.summary}\n`;
    });
    contextMarkdown += `\n`;
  }

  if (matchedTopics.length > 0) {
    contextMarkdown += `#### Matched Marble Micro-Topics & Prerequisite Chains:\n`;

    matchedTopics.forEach((topic, idx) => {
      contextMarkdown += `\n**Micro-Topic ${idx + 1}: ${topic.name}** (ID: \`${topic.id}\` | Type: ${topic.type} | Target Ages: ${topic.ageRangeStart}-${topic.ageRangeEnd})\n`;
      contextMarkdown += `- **Subject / Domain:** ${topic.subject} → ${topic.domain}\n`;
      contextMarkdown += `- **Core Concept Description:** ${topic.description}\n`;

      if (topic.evidence && topic.evidence.length > 0) {
        contextMarkdown += `- **Mastery Evidence Criteria:**\n`;
        topic.evidence.forEach(e => {
          contextMarkdown += `  * ${e}\n`;
        });
      }

      if (topic.assessmentPrompt) {
        contextMarkdown += `- **Standardized Assessment Prompt:** "${topic.assessmentPrompt}"\n`;
      }

      const prereqs = getPrerequisitesForTopic(topic.id);
      if (prereqs.length > 0) {
        contextMarkdown += `- **Prerequisite Dependencies:**\n`;
        prereqs.forEach(p => {
          contextMarkdown += `  * Needs **${p.prereqTopic!.name}** (${p.edge.strength} requirement): ${p.edge.reason}\n`;
        });
      }
    });
  } else {
    contextMarkdown += `*Note: Grounding with general domain taxonomy principles.*\n`;
  }

  contextMarkdown += `\n**STRICT RAG INSTRUCTIONS:**
1. Explicitly reference the retrieved Marble Micro-Topic names and prerequisite dependencies in your generated Lesson Plan.
2. Incorporate the Mastery Evidence Criteria directly into the Differentiated Worksheet tasks.
3. Replace the NEP section heading with "## Marble OS-Taxonomy Skill Graph Alignment" at the end of the lesson plan detailing how the prerequisite graph and micro-topic evidence were applied.
`;

  return contextMarkdown;
}
