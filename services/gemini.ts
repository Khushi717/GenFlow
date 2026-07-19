import { GoogleGenerativeAI } from '@google/generative-ai';

// Retrieve the Gemini API key
const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || '';

// Initialize the Gemini API client if the key exists
const ai = apiKey ? new GoogleGenerativeAI(apiKey) : null;

// Determine if we are using the live API
export const isGeminiConfigured = !!apiKey;

console.log(
  isGeminiConfigured
    ? 'Gemini API initialized successfully.'
    : 'Gemini API key missing. FlowMind will run in offline mock AI mode.'
);

/**
 * Helper to call Gemini model with a structured prompt.
 */
async function callGemini(prompt: string, fallbackResponse: string): Promise<string> {
  if (!isGeminiConfigured || !ai) {
    // Artificial latency for realistic loading experience
    await new Promise((resolve) => setTimeout(resolve, 800));
    return fallbackResponse;
  }

  try {
    const model = ai.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text().trim();
  } catch (error) {
    console.error('Gemini API Error, falling back to mock:', error);
    return fallbackResponse;
  }
}

/**
 * 1. AI Chat Assistant
 */
export async function chatWithAI(
  history: { sender: 'user' | 'assistant'; text: string }[],
  message: string,
  fileContent?: string
): Promise<string> {
  const fileContextPrompt = fileContent
    ? `Context file content provided by user:\n"""\n${fileContent}\n"""\n\n`
    : '';

  const chatHistoryPrompt = history
    .map((msg) => `${msg.sender === 'user' ? 'User' : 'AI'}: ${msg.text}`)
    .join('\n');

  const prompt = `${fileContextPrompt}You are FlowMind Copilot, a helpful AI productivity assistant. Here is the conversation history:\n${chatHistoryPrompt}\n\nUser: ${message}\nAI:`;

  const fallback = `I've analyzed your request. Based on your flow, here's what I suggest:
1. Finish the high priority task by 3 PM.
2. Focus on blocking out 1 hour for deep work.
Let me know if you would like me to set up a reminder or draft an email for you!`;

  return callGemini(prompt, fallback);
}

/**
 * 2. Document Summarizer
 */
export async function summarizeDocument(
  docName: string,
  docText: string
): Promise<{ summary: string; keyPoints: string[]; actionItems: string[] }> {
  const prompt = `You are an expert document summarizer. Summarize the following document titled "${docName}":\n\n"""\n${docText}\n"""\n\nReturn the output strictly in the following JSON format:
{
  "summary": "A high-level executive summary paragraph.",
  "keyPoints": ["Key point 1", "Key point 2", "Key point 3"],
  "actionItems": ["Action item 1", "Action item 2", "Action item 3"]
}`;

  const fallbackJSON = JSON.stringify({
    summary: `The document "${docName}" outlines the strategic quarterly goals and product spec improvements, focusing on optimizing client conversion rates and introducing a revamped design system.`,
    keyPoints: [
      'Introduces a dark-mode first modular layout structure.',
      'Aims to reduce loading latencies from 2.5s down to 350ms.',
      'Identifies Firebase and Gemini integrations as the main backend drivers.'
    ],
    actionItems: [
      'Migrate database tables to Firestore document collections.',
      'Implement OAuth login flow for verification.',
      'Conduct responsive layout testing on mobile devices.'
    ]
  });

  const responseText = await callGemini(prompt, fallbackJSON);

  try {
    // Clean JSON response (in case Gemini wraps it in ```json ... ```)
    const cleanedText = responseText.replace(/```json|```/gi, '').trim();
    return JSON.parse(cleanedText);
  } catch (e) {
    console.error('Failed to parse Gemini JSON for document summary, returning fallback:', e);
    return JSON.parse(fallbackJSON);
  }
}

/**
 * 3. Meeting Notes Summarizer & Workflow Automation
 */
export async function summarizeMeeting(
  transcript: string
): Promise<{ summary: string; actionItems: string[]; decisions: string[]; participants: string[] }> {
  const prompt = `Analyze this meeting transcript and extract summary, action items, decisions, and participants:\n\n"""\n${transcript}\n"""\n\nReturn the output strictly in the following JSON format:
{
  "summary": "Executive summary of the meeting.",
  "actionItems": ["Action item 1 (assigned to Person)", "Action item 2 (assigned to Person)"],
  "decisions": ["Decision 1", "Decision 2"],
  "participants": ["Participant Name 1", "Participant Name 2"]
}`;

  const fallbackJSON = JSON.stringify({
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
    participants: ['Sarah Jenkins', 'Alex Mercer', 'John Doe']
  });

  const responseText = await callGemini(prompt, fallbackJSON);

  try {
    const cleanedText = responseText.replace(/```json|```/gi, '').trim();
    return JSON.parse(cleanedText);
  } catch (e) {
    console.error('Failed to parse Gemini JSON for meeting summary, returning fallback:', e);
    return JSON.parse(fallbackJSON);
  }
}

/**
 * 4. Email Generator
 */
export async function generateEmail(
  promptInput: string,
  tone: 'professional' | 'friendly' | 'formal' | 'casual'
): Promise<{ subject: string; body: string }> {
  const prompt = `Write an email in a ${tone} tone based on the following instruction:\n"${promptInput}"\n\nReturn the response strictly in the following JSON format:
{
  "subject": "Email Subject Line",
  "body": "Hi [Name],\\n\\n[Email Body Text]\\n\\nBest regards,\\n[Your Name]"
}`;

  const fallbackJSON = JSON.stringify({
    subject: `Follow-up: Action Items & FlowMind Project Next Steps`,
    body: `Hi Team,\n\nI hope you're having a great day. Just following up on our recent sync regarding the FlowMind AI full-stack migration. Here is a summary of the next steps:\n\n- Sarah will be setting up the Firebase configurations.\n- Alex is finishing the Kanban UI components.\n- John will draft the follow-up templates.\n\nPlease review these items, and let me know if you have any questions.\n\nBest regards,\nAlex Mercer`
  });

  const responseText = await callGemini(prompt, fallbackJSON);

  try {
    const cleanedText = responseText.replace(/```json|```/gi, '').trim();
    return JSON.parse(cleanedText);
  } catch (e) {
    console.error('Failed to parse Gemini JSON for email generator, returning fallback:', e);
    return JSON.parse(fallbackJSON);
  }
}

/**
 * 5. Task Breakdown
 */
export async function suggestTasksBreakdown(taskTitle: string, taskDesc: string): Promise<string[]> {
  const prompt = `Break down this task into 3 to 5 smaller actionable sub-tasks:\nTask: ${taskTitle}\nDescription: ${taskDesc}\n\nReturn output strictly as a JSON array of strings: ["Sub-task 1", "Sub-task 2", ...]`;

  const fallbackJSON = JSON.stringify([
    'Configure environment variables in .env.local',
    'Initialize Firebase App and configure security rules',
    'Write Authentication Context provider hook',
    'Add Google sign-in and email auth forms to frontend'
  ]);

  const responseText = await callGemini(prompt, fallbackJSON);

  try {
    const cleanedText = responseText.replace(/```json|```/gi, '').trim();
    return JSON.parse(cleanedText);
  } catch (e) {
    return JSON.parse(fallbackJSON);
  }
}

/**
 * 6. Smart Task & Priority Suggestions for Dashboard
 */
export async function suggestTasksFromDashboard(existingTasks: string[]): Promise<string[]> {
  const prompt = `Given these existing tasks: ${JSON.stringify(existingTasks)}, suggest 3 smart, high-productivity daily habits or task additions to optimize workflow. Return as a JSON array of strings.`;

  const fallbackJSON = JSON.stringify([
    'Schedule a 15-minute morning standup with the design leads.',
    'Perform a 20-minute inbox zero cleanup before starting deep work.',
    'Review outstanding pull requests and merge the landing page component.'
  ]);

  const responseText = await callGemini(prompt, fallbackJSON);

  try {
    const cleanedText = responseText.replace(/```json|```/gi, '').trim();
    return JSON.parse(cleanedText);
  } catch (e) {
    return JSON.parse(fallbackJSON);
  }
}

/**
 * 7. Calendar Scheduling Suggestions
 */
export async function suggestCalendarScheduling(
  eventTitle: string,
  existingEvents: { title: string; date: string; startTime: string }[]
): Promise<string> {
  const prompt = `Suggest an optimal scheduling window for the event: "${eventTitle}". Take into account existing events: ${JSON.stringify(existingEvents)}. Briefly explain why this is the best time in one sentence.`;
  const fallback = `I suggest scheduling "${eventTitle}" on Wednesday at 2:00 PM. This avoids your heavy Tuesday meeting block and places it after your focused morning work hours.`;

  return callGemini(prompt, fallback);
}

/**
 * 8. Workflow Recommendations
 */
export async function getWorkflowRecommendations(
  tasks: any[],
  meetings: any[]
): Promise<{ recommendation: string; action: string }> {
  // Simple heuristic recommendations
  await new Promise((resolve) => setTimeout(resolve, 300));
  if (tasks.filter((t) => t.status !== 'completed').length > 5) {
    return {
      recommendation: 'Your task queue is filling up quickly. We suggest breaking down big tasks into smaller micro-tasks to unblock progress.',
      action: 'Break down tasks'
    };
  }
  if (meetings.length > 3) {
    return {
      recommendation: 'You have multiple meetings scheduled. Consider using "Meeting Notes Summarizer" to automatically extract action items and recover 40 mins.',
      action: 'Summarize syncs'
    };
  }
  return {
    recommendation: 'Your calendar and task lists are fully optimized. We recommend starting with your highest priority task: "Design System Migration".',
    action: 'Start Deep Work'
  };
}
