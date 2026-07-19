import {
  collection,
  doc,
  addDoc,
  setDoc,
  getDocs,
  getDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '@/firebase/config';
import { Task, Meeting, DocumentSummary, GeneratedEmail, CalendarEvent, ChatSession, ChatMessage } from '@/types';

// Helper to check if window is defined for SSR
const isClient = typeof window !== 'undefined';

// ==========================================
// MOCK INITIAL DATA FOR FIRST RUN (OFFLINE)
// ==========================================

const INITIAL_TASKS = (userId: string): Task[] => [
  {
    id: 'task-1',
    title: 'Design System Migration',
    description: 'Migrate legacy CSS styles to Tailwind v4 theme variables.',
    priority: 'high',
    dueDate: new Date().toISOString().split('T')[0],
    status: 'in_progress',
    category: 'Design',
    userId,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'task-2',
    title: 'Configure OAuth Auth State',
    description: 'Set up Firebase Authentication Context wrappers and routing guards.',
    priority: 'high',
    dueDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
    status: 'todo',
    category: 'Backend',
    userId,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'task-3',
    title: 'Meeting transcript parser helper',
    description: 'Write transcript extraction code to structure participants and action items.',
    priority: 'medium',
    dueDate: new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0],
    status: 'todo',
    category: 'AI Service',
    userId,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'task-4',
    title: 'Write project documentation',
    description: 'Document architecture layers, Firebase schemas, and Gemini prompting structures.',
    priority: 'low',
    dueDate: new Date(Date.now() + 86400000 * 4).toISOString().split('T')[0],
    status: 'completed',
    category: 'Documentation',
    userId,
    createdAt: new Date().toISOString(),
  }
];

const INITIAL_MEETINGS = (userId: string): Meeting[] => [
  {
    id: 'meeting-1',
    title: 'Product Sync & Gemini Integration',
    date: new Date().toISOString().split('T')[0],
    time: '14:00',
    duration: '45 mins',
    summary: 'The project sync aligned the design and engineering teams on the launch timeline. The team decided to release the initial full-stack draft by next Friday, prioritizing authentication and task flows.',
    actionItems: [
      'Configure Firebase Firestore credentials (assigned to Sarah)',
      'Design the Kanban board layout components (assigned to Alex)',
      'Prepare email follow-up sequence (assigned to John)'
    ],
    decisions: [
      'Release v1.0 by next Friday.',
      'Use Next.js 15 and Tailwind v4 for deployment.'
    ],
    participants: ['Sarah Jenkins', 'Alex Mercer', 'John Doe'],
    userId,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'meeting-2',
    title: 'UI Design Walkthrough',
    date: new Date(Date.now() - 86400000).toISOString().split('T')[0],
    time: '11:00',
    duration: '30 mins',
    summary: 'Discussed dark mode styling guidelines and custom glassmorphism components.',
    actionItems: [
      'Export custom typography styles.',
      'Fix card border hover transitions.'
    ],
    decisions: [
      'Keep dark theme background fixed at #131313.'
    ],
    participants: ['Alex Mercer', 'Dora Explorer'],
    userId,
    createdAt: new Date().toISOString(),
  }
];

const INITIAL_DOCUMENTS = (userId: string): DocumentSummary[] => [
  {
    id: 'doc-1',
    name: 'Annual_Report.pdf',
    type: 'pdf',
    size: '2.4 MB',
    summary: 'The document outlines strategic quarterly goals, financial milestones, and spec improvements for Q4.',
    keyPoints: [
      'Achieved a 15% increase in operational productivity.',
      'Completed the layout refactoring phases ahead of schedule.'
    ],
    actionItems: [
      'Audit the database storage tables.',
      'Deploy v1.0 of the application by mid-quarter.'
    ],
    userId,
    uploadedAt: new Date().toISOString(),
  },
  {
    id: 'doc-2',
    name: 'Product_Spec_v2.docx',
    type: 'docx',
    size: '1.1 MB',
    summary: 'This document defines the functional requirements and architectural breakdown of FlowMind AI.',
    keyPoints: [
      'Specifies Firestore for real-time document-task sync.',
      'Lays out App Router pages structure.'
    ],
    actionItems: [
      'Confirm shadcn button configurations.',
      'Integrate generative model endpoint.'
    ],
    userId,
    uploadedAt: new Date().toISOString(),
  }
];

const INITIAL_EMAILS = (userId: string): GeneratedEmail[] => [
  {
    id: 'email-1',
    subject: 'Follow-up: Action Items & FlowMind Project Next Steps',
    body: 'Hi Team,\n\nJust following up on our recent sync regarding the FlowMind AI full-stack migration. Here is a summary of the next steps:\n\n- Sarah will be setting up the Firebase configurations.\n- Alex is finishing the Kanban UI components.\n- John will draft the follow-up templates.\n\nPlease review these items, and let me know if you have any questions.\n\nBest regards,\nAlex Mercer',
    prompt: 'Write a follow up email summarizing action items from our product sync meeting.',
    tone: 'professional',
    userId,
    createdAt: new Date().toISOString(),
  }
];

const INITIAL_EVENTS = (userId: string): CalendarEvent[] => [
  {
    id: 'event-1',
    title: 'Product Sync & Gemini Integration',
    date: new Date().toISOString().split('T')[0],
    startTime: '14:00',
    endTime: '14:45',
    description: 'Align design and engineering teams on launch timelines.',
    userId,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'event-2',
    title: 'AI Feature Review',
    date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
    startTime: '10:00',
    endTime: '11:00',
    description: 'Review document summary and chatbot storage prompts.',
    userId,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'event-3',
    title: 'Weekly Standup',
    date: new Date(Date.now() - 86400000).toISOString().split('T')[0],
    startTime: '09:30',
    endTime: '10:00',
    description: 'Brief progress update.',
    userId,
    createdAt: new Date().toISOString(),
  }
];

// ==========================================
// STORAGE UTILITIES
// ==========================================

function getMockStorage<T>(key: string, initializer: () => T[]): T[] {
  if (!isClient) return [];
  const stored = localStorage.getItem(key);
  if (!stored) {
    const initial = initializer();
    localStorage.setItem(key, JSON.stringify(initial));
    return initial;
  }
  return JSON.parse(stored);
}

function setMockStorage<T>(key: string, data: T[]): void {
  if (!isClient) return;
  localStorage.setItem(key, JSON.stringify(data));
}

// ==========================================
// FIRESTORE CRUD OPERATIONS
// ==========================================

export const dbService = {
  // Tasks CRUD
  async getTasks(userId: string): Promise<Task[]> {
    if (!isFirebaseConfigured || !db) {
      return getMockStorage(`flowmind_tasks_${userId}`, () => INITIAL_TASKS(userId));
    }
    const q = query(collection(db, 'tasks'), where('userId', '==', userId), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Task));
  },

  async saveTask(userId: string, task: Omit<Task, 'id' | 'createdAt' | 'userId'> & { id?: string }): Promise<Task> {
    if (!isFirebaseConfigured || !db) {
      const tasks = getMockStorage(`flowmind_tasks_${userId}`, () => INITIAL_TASKS(userId));
      if (task.id) {
        // Edit
        const idx = tasks.findIndex((t) => t.id === task.id);
        const updatedTask = { ...tasks[idx], ...task } as Task;
        tasks[idx] = updatedTask;
        setMockStorage(`flowmind_tasks_${userId}`, tasks);
        return updatedTask;
      } else {
        // Create
        const newTask: Task = {
          ...task,
          id: `task-${Math.random().toString(36).substr(2, 9)}`,
          userId,
          createdAt: new Date().toISOString(),
        } as Task;
        tasks.unshift(newTask);
        setMockStorage(`flowmind_tasks_${userId}`, tasks);
        return newTask;
      }
    }

    if (task.id) {
      const docRef = doc(db, 'tasks', task.id);
      await updateDoc(docRef, { ...task });
      const snap = await getDoc(docRef);
      return { id: snap.id, ...snap.data() } as Task;
    } else {
      const docRef = await addDoc(collection(db, 'tasks'), {
        ...task,
        userId,
        createdAt: new Date().toISOString(),
      });
      const snap = await getDoc(docRef);
      return { id: snap.id, ...snap.data() } as Task;
    }
  },

  async deleteTask(userId: string, taskId: string): Promise<void> {
    if (!isFirebaseConfigured || !db) {
      const tasks = getMockStorage(`flowmind_tasks_${userId}`, () => INITIAL_TASKS(userId));
      setMockStorage(`flowmind_tasks_${userId}`, tasks.filter((t) => t.id !== taskId));
      return;
    }
    await deleteDoc(doc(db, 'tasks', taskId));
  },

  // Meetings CRUD
  async getMeetings(userId: string): Promise<Meeting[]> {
    if (!isFirebaseConfigured || !db) {
      return getMockStorage(`flowmind_meetings_${userId}`, () => INITIAL_MEETINGS(userId));
    }
    const q = query(collection(db, 'meetings'), where('userId', '==', userId), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Meeting));
  },

  async saveMeeting(userId: string, meeting: Omit<Meeting, 'id' | 'createdAt' | 'userId'> & { id?: string }): Promise<Meeting> {
    if (!isFirebaseConfigured || !db) {
      const meetings = getMockStorage(`flowmind_meetings_${userId}`, () => INITIAL_MEETINGS(userId));
      if (meeting.id) {
        const idx = meetings.findIndex((m) => m.id === meeting.id);
        const updated = { ...meetings[idx], ...meeting } as Meeting;
        meetings[idx] = updated;
        setMockStorage(`flowmind_meetings_${userId}`, meetings);
        return updated;
      } else {
        const newMeeting: Meeting = {
          ...meeting,
          id: `meeting-${Math.random().toString(36).substr(2, 9)}`,
          userId,
          createdAt: new Date().toISOString(),
        } as Meeting;
        meetings.unshift(newMeeting);
        setMockStorage(`flowmind_meetings_${userId}`, meetings);
        return newMeeting;
      }
    }

    if (meeting.id) {
      const docRef = doc(db, 'meetings', meeting.id);
      await updateDoc(docRef, { ...meeting });
      const snap = await getDoc(docRef);
      return { id: snap.id, ...snap.data() } as Meeting;
    } else {
      const docRef = await addDoc(collection(db, 'meetings'), {
        ...meeting,
        userId,
        createdAt: new Date().toISOString(),
      });
      const snap = await getDoc(docRef);
      return { id: snap.id, ...snap.data() } as Meeting;
    }
  },

  async deleteMeeting(userId: string, meetingId: string): Promise<void> {
    if (!isFirebaseConfigured || !db) {
      const meetings = getMockStorage(`flowmind_meetings_${userId}`, () => INITIAL_MEETINGS(userId));
      setMockStorage(`flowmind_meetings_${userId}`, meetings.filter((m) => m.id !== meetingId));
      return;
    }
    await deleteDoc(doc(db, 'meetings', meetingId));
  },

  // Documents CRUD
  async getDocuments(userId: string): Promise<DocumentSummary[]> {
    if (!isFirebaseConfigured || !db) {
      return getMockStorage(`flowmind_documents_${userId}`, () => INITIAL_DOCUMENTS(userId));
    }
    const q = query(collection(db, 'documents'), where('userId', '==', userId), orderBy('uploadedAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as DocumentSummary));
  },

  async saveDocument(userId: string, docSummary: Omit<DocumentSummary, 'id' | 'uploadedAt' | 'userId'>): Promise<DocumentSummary> {
    if (!isFirebaseConfigured || !db) {
      const docs = getMockStorage(`flowmind_documents_${userId}`, () => INITIAL_DOCUMENTS(userId));
      const newDoc: DocumentSummary = {
        ...docSummary,
        id: `doc-${Math.random().toString(36).substr(2, 9)}`,
        userId,
        uploadedAt: new Date().toISOString(),
      };
      docs.unshift(newDoc);
      setMockStorage(`flowmind_documents_${userId}`, docs);
      return newDoc;
    }

    const docRef = await addDoc(collection(db, 'documents'), {
      ...docSummary,
      userId,
      uploadedAt: new Date().toISOString(),
    });
    const snap = await getDoc(docRef);
    return { id: snap.id, ...snap.data() } as DocumentSummary;
  },

  async deleteDocument(userId: string, docId: string): Promise<void> {
    if (!isFirebaseConfigured || !db) {
      const docs = getMockStorage(`flowmind_documents_${userId}`, () => INITIAL_DOCUMENTS(userId));
      setMockStorage(`flowmind_documents_${userId}`, docs.filter((d) => d.id !== docId));
      return;
    }
    await deleteDoc(doc(db, 'documents', docId));
  },

  // Emails CRUD
  async getEmails(userId: string): Promise<GeneratedEmail[]> {
    if (!isFirebaseConfigured || !db) {
      return getMockStorage(`flowmind_emails_${userId}`, () => INITIAL_EMAILS(userId));
    }
    const q = query(collection(db, 'emails'), where('userId', '==', userId), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as GeneratedEmail));
  },

  async saveEmail(userId: string, email: Omit<GeneratedEmail, 'id' | 'createdAt' | 'userId'>): Promise<GeneratedEmail> {
    if (!isFirebaseConfigured || !db) {
      const emails = getMockStorage(`flowmind_emails_${userId}`, () => INITIAL_EMAILS(userId));
      const newEmail: GeneratedEmail = {
        ...email,
        id: `email-${Math.random().toString(36).substr(2, 9)}`,
        userId,
        createdAt: new Date().toISOString(),
      };
      emails.unshift(newEmail);
      setMockStorage(`flowmind_emails_${userId}`, emails);
      return newEmail;
    }

    const docRef = await addDoc(collection(db, 'emails'), {
      ...email,
      userId,
      createdAt: new Date().toISOString(),
    });
    const snap = await getDoc(docRef);
    return { id: snap.id, ...snap.data() } as GeneratedEmail;
  },

  // CalendarEvents CRUD
  async getEvents(userId: string): Promise<CalendarEvent[]> {
    if (!isFirebaseConfigured || !db) {
      return getMockStorage(`flowmind_events_${userId}`, () => INITIAL_EVENTS(userId));
    }
    const q = query(collection(db, 'calendarEvents'), where('userId', '==', userId), orderBy('date', 'asc'));
    const snap = await getDocs(q);
    return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as CalendarEvent));
  },

  async saveEvent(userId: string, event: Omit<CalendarEvent, 'id' | 'createdAt' | 'userId'> & { id?: string }): Promise<CalendarEvent> {
    if (!isFirebaseConfigured || !db) {
      const events = getMockStorage(`flowmind_events_${userId}`, () => INITIAL_EVENTS(userId));
      if (event.id) {
        const idx = events.findIndex((e) => e.id === event.id);
        const updated = { ...events[idx], ...event } as CalendarEvent;
        events[idx] = updated;
        setMockStorage(`flowmind_events_${userId}`, events);
        return updated;
      } else {
        const newEvent: CalendarEvent = {
          ...event,
          id: `event-${Math.random().toString(36).substr(2, 9)}`,
          userId,
          createdAt: new Date().toISOString(),
        } as CalendarEvent;
        events.push(newEvent);
        setMockStorage(`flowmind_events_${userId}`, events);
        return newEvent;
      }
    }

    if (event.id) {
      const docRef = doc(db, 'calendarEvents', event.id);
      await updateDoc(docRef, { ...event });
      const snap = await getDoc(docRef);
      return { id: snap.id, ...snap.data() } as CalendarEvent;
    } else {
      const docRef = await addDoc(collection(db, 'calendarEvents'), {
        ...event,
        userId,
        createdAt: new Date().toISOString(),
      });
      const snap = await getDoc(docRef);
      return { id: snap.id, ...snap.data() } as CalendarEvent;
    }
  },

  async deleteEvent(userId: string, eventId: string): Promise<void> {
    if (!isFirebaseConfigured || !db) {
      const events = getMockStorage(`flowmind_events_${userId}`, () => INITIAL_EVENTS(userId));
      setMockStorage(`flowmind_events_${userId}`, events.filter((e) => e.id !== eventId));
      return;
    }
    await deleteDoc(doc(db, 'calendarEvents', eventId));
  },

  // ChatHistory CRUD
  async getChatSessions(userId: string): Promise<ChatSession[]> {
    if (!isFirebaseConfigured || !db) {
      const defaultChats: ChatSession[] = [
        {
          id: 'session-1',
          userId,
          title: 'Daily Task Organization',
          messages: [
            { id: 'm1', sender: 'assistant', text: 'How can I help you optimize your schedule today?', timestamp: new Date().toISOString() },
            { id: 'm2', sender: 'user', text: 'Summarize my 2PM meeting notes.', timestamp: new Date().toISOString() }
          ],
          updatedAt: new Date().toISOString(),
        }
      ];
      return getMockStorage(`flowmind_chats_${userId}`, () => defaultChats);
    }
    const q = query(collection(db, 'chatHistory'), where('userId', '==', userId), orderBy('updatedAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as ChatSession));
  },

  async saveChatSession(userId: string, session: ChatSession): Promise<void> {
    if (!isFirebaseConfigured || !db) {
      const sessions = getMockStorage(`flowmind_chats_${userId}`, () => [] as ChatSession[]);
      const idx = sessions.findIndex((s) => s.id === session.id);
      if (idx !== -1) {
        sessions[idx] = session;
      } else {
        sessions.unshift(session);
      }
      setMockStorage(`flowmind_chats_${userId}`, sessions);
      return;
    }
    await setDoc(doc(db, 'chatHistory', session.id), session);
  }
};
