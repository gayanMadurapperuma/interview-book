export type SubjectKey = 'js' | 'node' | 'ts' | 'db' | 'sd' | 'api' | 'sec' | 'k8s';

export interface Subject {
  key: SubjectKey;
  name: string;
  short: string;
  volume: string;
  blurb: string;
  parts: string[];
}

export const SUBJECTS: Subject[] = [
  {
    key: 'js', name: 'JavaScript', short: 'JS', volume: 'I',
    blurb: 'How the language really works: values, scope, objects, and the event loop that makes asynchronous code possible.',
    parts: ['Foundations', 'Engine & memory', 'Scope & functions', 'Objects & prototypes', 'Asynchrony', 'Modern JavaScript'],
  },
  {
    key: 'node', name: 'Node.js', short: 'Node', volume: 'II',
    blurb: 'JavaScript on the server: libuv, the six-phase event loop, streams, scaling across cores, and running services in production.',
    parts: ['Runtime', 'Core APIs', 'Building services', 'Production'],
  },
  {
    key: 'ts', name: 'TypeScript', short: 'TS', volume: 'III',
    blurb: 'A type system that exists only at compile time — how to use it to make wrong code impossible to write.',
    parts: ['Foundations', 'Classes & OOP', 'Type-level programming', 'Config & practice'],
  },
  {
    key: 'db', name: 'Databases', short: 'DB', volume: 'IV',
    blurb: 'Relational fundamentals, transactions and isolation, indexes and query plans, and how data stores scale.',
    parts: ['Fundamentals', 'Transactions', 'Performance', 'Scale', 'Data platform'],
  },
  {
    key: 'sd', name: 'System Design', short: 'SD', volume: 'V',
    blurb: 'The theory behind large systems, and a repeatable way to design one out loud in an interview.',
    parts: ['The interview', 'Distributed fundamentals', 'Guarantees & data flow', 'Performance & reliability', 'Architecture', 'Core components', 'Case studies'],
  },
  {
    key: 'api', name: 'APIs', short: 'API', volume: 'VI',
    blurb: 'HTTP from the ground up, REST and GraphQL done properly, and when gRPC, WebSockets or server-sent events fit better.',
    parts: ['HTTP', 'REST', 'GraphQL', 'Beyond request–response'],
  },
  {
    key: 'sec', name: 'Security', short: 'Sec', volume: 'VII',
    blurb: 'Authentication, OAuth and tokens, authorisation, the classic web vulnerabilities, and keeping secrets and infrastructure safe.',
    parts: ['Foundations', 'Identity', 'Web security', 'Infrastructure security'],
  },
  {
    key: 'k8s', name: 'Kubernetes', short: 'K8s', volume: 'VIII',
    blurb: 'Containers and Docker, how Kubernetes schedules and connects them, and running a production Node service on a cluster.',
    parts: ['Containers', 'Kubernetes core', 'Running in production'],
  },
];

export const subjectByKey = Object.fromEntries(SUBJECTS.map((s) => [s.key, s])) as Record<SubjectKey, Subject>;

export const withBase = (path: string) => {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  return base + (path.startsWith('/') ? path : '/' + path);
};
