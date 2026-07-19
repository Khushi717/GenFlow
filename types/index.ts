export type Priority = 'low' | 'medium' | 'high';
export type TaskStatus = 'todo' | 'in_progress' | 'completed';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  createdAt: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  priority: Priority;
  dueDate: string;
  status: TaskStatus;
  category: string;
  userId: string;
  createdAt: string;
  suggestedByAI?: boolean;
}

export interface Meeting {
  id: string;
  title: string;
  date: string;
  time: string;
  duration: string; // e.g. "30 mins", "1 hour"
  summary: string;
  actionItems: string[];
  decisions: string[];
  participants: string[];
  userId: string;
  createdAt: string;
  transcript?: string;
  workflowTriggered?: boolean;
}

export interface DocumentSummary {
  id: string;
  name: string;
  type: string; // e.g. "pdf", "docx"
  size: string; // e.g. "2.4 MB"
  summary: string;
  keyPoints: string[];
  actionItems: string[];
  userId: string;
  uploadedAt: string;
}

export interface GeneratedEmail {
  id: string;
  subject: string;
  body: string;
  prompt: string;
  tone: 'professional' | 'friendly' | 'formal' | 'casual';
  userId: string;
  createdAt: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  description?: string;
  userId: string;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
}

export interface ChatSession {
  id: string;
  userId: string;
  title: string;
  messages: ChatMessage[];
  updatedAt: string;
}

export interface ProductivitySuggestions {
  suggestions: string[];
  score: number;
  completedTasksCount: number;
  totalTasksCount: number;
}
