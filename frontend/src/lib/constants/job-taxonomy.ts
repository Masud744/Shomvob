/**
 * সম্ভব (Shomvob) — Centralized Job Taxonomy & Metadata Normalization.
 * 
 * Provides unified, production-grade styling, label mapping, and skill
 * sanitation for job cards, details pages, and search filters.
 */

export const CATEGORY_LABELS: Record<string, string> = {
  government: 'Govt Circular',
  iot: 'IoT',
  embedded: 'Embedded Systems',
  firmware: 'Firmware',
  robotics: 'Robotics',
  ai: 'AI & ML',
  ml: 'Machine Learning',
  deep_learning: 'Deep Learning',
  computer_vision: 'Computer Vision',
  edge_ai: 'Edge AI',
  backend: 'Backend',
  full_stack: 'Full Stack',
  devops: 'DevOps & SRE',
  cloud: 'Cloud',
  cybersecurity: 'Cybersecurity',
  data_engineering: 'Data Engineering',
};

export function getCategoryLabel(category: string): string {
  if (!category) return '';
  const key = category.toLowerCase().trim();
  return (
    CATEGORY_LABELS[key] ||
    category
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

/**
 * Standardized badge styling. Avoids the 16-color rainbow clash
 * by utilizing restrained, high-contrast, accessible semantic tokens.
 */
export function getCategoryBadgeClass(category: string): string {
  const key = category?.toLowerCase().trim();
  if (key === 'government') {
    return 'bg-primary/10 text-primary border-primary/20 hover:bg-primary/15';
  }
  // Cohesive technical monochrome pill for all categories
  return 'bg-muted/70 text-foreground border-border hover:bg-muted';
}

export function getSourceBadge(source: string): { label: string; className: string } {
  switch (source) {
    case 'BD Govt Jobs':
      return {
        label: 'Govt Circular',
        className: 'border-border bg-muted/80 text-foreground font-medium',
      };
    case 'Bdjobs':
      return {
        label: 'Bdjobs',
        className: 'border-border bg-muted/50 text-foreground/80 font-medium',
      };
    case 'Jobicy':
      return {
        label: 'Jobicy',
        className: 'border-border bg-muted/50 text-foreground/80 font-medium',
      };
    case 'LinkedIn':
      return {
        label: 'LinkedIn',
        className: 'border-border bg-muted/50 text-foreground/80 font-medium',
      };
    case 'WeWorkRemotely':
      return {
        label: 'WWR',
        className: 'border-border bg-muted/50 text-foreground/80 font-medium',
      };
    case 'RemoteOK':
      return {
        label: 'RemoteOK',
        className: 'border-border bg-muted/50 text-foreground/80 font-medium',
      };
    case 'NextJobz':
      return {
        label: 'NextJobz',
        className: 'border-border bg-muted/50 text-foreground/80 font-medium',
      };
    default:
      return {
        label: source || 'Active',
        className: 'border-border bg-muted/50 text-foreground/80 font-medium',
      };
  }
}

/**
 * Filter out generic non-skills, job roles, seniority words, and locations
 * that raw job scrapers dump into skill tags.
 */
const NON_SKILL_WORDS = new Set([
  'engineer',
  'engineering',
  'developer',
  'programmer',
  'architect',
  'architecture',
  'lead',
  'technical lead',
  'tech lead',
  'team lead',
  'lead engineer',
  'vp engineering',
  'director',
  'senior',
  'mid',
  'junior',
  'intern',
  'internship',
  'full time',
  'part time',
  'remote',
  'onsite',
  'hybrid',
  'work from home',
  'bangladesh',
  'dhaka',
  'worldwide',
  'government',
  'public sector',
  'circular',
  'teletalk',
  'bpsc',
  'bcs',
  'software',
  'software engineer',
  'backend',
  'frontend',
  'fullstack',
  'full stack',
  'devops',
  'cloud',
  'infrastructure',
  'infra',
  'iot',
  'embedded',
  'firmware',
  'robotics',
  'ai',
  'ml',
  'ai/ml',
  'machine learning',
  'deep learning',
  'cybersecurity',
  'security',
  'data engineer',
  'data engineering',
  'data scientist',
  'data analyst',
  'system admin',
  'sysadmin',
  'linux admin',
  'tech',
  'it',
  'consultant',
  'consulting',
  'advisory',
  'adoption',
  'literacy',
  'specialist',
  'executive',
  'manager',
  'management',
  'cto',
  'ceo',
  'cfo',
  'officer',
  'analyst',
  'coordinator',
  'assistant',
  'expert',
  'experience',
  'skills',
  'responsibility',
  'requirements',
  'qualification',
  'candidate',
  'candidates',
  'job',
  'jobs',
  'role',
  'work',
  'career',
  'team',
  'project',
  'company',
  'location',
  'contract',
  'contractor',
]);

export const TECHNICAL_TAXONOMY_SKILLS = [
  'Python', 'JavaScript', 'TypeScript', 'React', 'Next.js', 'Vue', 'Angular',
  'Node.js', 'Express', 'FastAPI', 'Django', 'Flask', 'Go', 'Rust',
  'Java', 'Spring Boot', 'C++', 'C#', '.NET', 'PHP', 'Laravel',
  'Docker', 'Kubernetes', 'AWS', 'Azure', 'GCP', 'Terraform', 'Ansible',
  'CI/CD', 'Linux', 'Ubuntu', 'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'Elasticsearch',
  'GraphQL', 'REST APIs', 'Microservices', 'Kafka', 'RabbitMQ', 'Git',
  'PyTorch', 'TensorFlow', 'OpenCV', 'Scikit-Learn', 'LLMs', 'NLP', 'RAG',
  'Embedded C', 'RTOS', 'STM32', 'ESP32', 'ARM', 'FPGA', 'PCB Design',
  'Solidity', 'Web3', 'Cybersecurity', 'Penetration Testing', 'SIEM',
  'System Architecture', 'API Design', 'Prompt Engineering', 'MLOps',
  'SQL', 'Data Pipelines', 'ETL', 'Snowflake', 'BigQuery', 'Airflow',
  'Tailwind CSS', 'Redux',
];

export const CATEGORY_DEFAULT_SKILLS: Record<string, string[]> = {
  ai: ['Machine Learning', 'Python', 'LLMs', 'Model Evaluation'],
  ml: ['PyTorch', 'TensorFlow', 'Python', 'Scikit-Learn'],
  deep_learning: ['Deep Neural Networks', 'PyTorch', 'TensorFlow', 'GPU Optimization'],
  computer_vision: ['OpenCV', 'PyTorch', 'Computer Vision', 'Image Processing'],
  backend: ['REST APIs', 'PostgreSQL', 'Microservices', 'Docker'],
  full_stack: ['React', 'TypeScript', 'Node.js', 'PostgreSQL'],
  devops: ['Docker', 'Kubernetes', 'CI/CD', 'Terraform'],
  cloud: ['AWS', 'Cloud Architecture', 'Kubernetes', 'Terraform'],
  data_engineering: ['Data Pipelines', 'SQL', 'ETL', 'PostgreSQL'],
  cybersecurity: ['Network Security', 'Penetration Testing', 'SIEM', 'Compliance'],
  embedded: ['Embedded C', 'RTOS', 'Firmware', 'Hardware Debugging'],
  iot: ['IoT Protocols', 'MQTT', 'Embedded Systems', 'Edge Computing'],
  robotics: ['ROS', 'C++', 'Control Systems', 'Robotics Simulation'],
  government: ['Public Administration', 'Official Protocols', 'Civil Service Guidelines'],
};

export function cleanJobSkills(
  skills?: string[] | null,
  title?: string,
  categories?: any[],
  description?: string,
  requirements?: string
): string[] {
  const titleWords = new Set(
    (title || '')
      .toLowerCase()
      .split(/[\s,/-]+/)
      .filter((w) => w.length > 2)
  );

  const categoryList = (categories || []).map((c) =>
    (typeof c === 'string' ? c : c?.category || '').toLowerCase()
  );
  const categoryWords = new Set(categoryList);

  const seen = new Set<string>();
  const cleaned: string[] = [];

  // 1. First pass: clean provided skills
  if (skills && Array.isArray(skills)) {
    for (const raw of skills) {
      if (!raw || typeof raw !== 'string') continue;
      const trimmed = raw.trim();
      const normalized = trimmed.toLowerCase();

      // Reject empty, too short, or known generic role words
      if (trimmed.length < 2 || trimmed.length > 30) continue;
      if (NON_SKILL_WORDS.has(normalized)) continue;

      // Avoid exact duplicate of existing classified category
      if (categoryWords.has(normalized)) continue;

      // Avoid duplicating exact title words unless it's a known language/framework
      const isTechAcronym = /^[A-Z0-9+#.]+$/.test(trimmed) || trimmed.length <= 4;
      if (!isTechAcronym && titleWords.has(normalized)) continue;

      if (!seen.has(normalized)) {
        seen.add(normalized);
        cleaned.push(trimmed);
      }
    }
  }

  // 2. Second pass: If fewer than 3 skills, scan title, description, and requirements for recognizable tech skills
  if (cleaned.length < 3) {
    const combinedText = `${title || ''} ${description || ''} ${requirements || ''}`.toLowerCase();
    for (const tech of TECHNICAL_TAXONOMY_SKILLS) {
      const lowerTech = tech.toLowerCase();
      // Match word boundaries
      const regex = new RegExp(`(^|[^a-zA-Z0-9+#])${lowerTech.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-zA-Z0-9+#]|$)`, 'i');
      if (regex.test(combinedText) && !seen.has(lowerTech)) {
        seen.add(lowerTech);
        cleaned.push(tech);
        if (cleaned.length >= 5) break;
      }
    }
  }

  // Pass 3 (fake category default injection) removed: Never force unmentioned skills.

  return cleaned.slice(0, 6);
}
