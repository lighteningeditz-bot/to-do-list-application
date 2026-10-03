export type StarterTask = {
  title: string;
  description?: string;
  priority: "low" | "medium" | "high" | "urgent";
  tags: string[];
  estimatedMinutes?: number;
};

export type StarterList = {
  name: string;
  icon: string;
  color: string;
  tasks?: StarterTask[];
};

export type TemplateRole =
  | "school"
  | "college"
  | "professional"
  | "freelancer"
  | "developer"
  | "teacher"
  | "personal"
  | "other";

export const roleTemplates: Record<TemplateRole, StarterList[]> = {
  school: [
    {
      name: "Classes",
      icon: "book",
      color: "#8270d5",
      tasks: [
        { title: "Check this week's timetable", priority: "medium", tags: ["school", "plan"], estimatedMinutes: 10 },
        { title: "Pack books and supplies for tomorrow", priority: "low", tags: ["school", "routine"], estimatedMinutes: 10 },
      ],
    },
    {
      name: "Homework",
      icon: "check",
      color: "#54a992",
      tasks: [
        { title: "Finish the next homework assignment", priority: "high", tags: ["homework", "focus"], estimatedMinutes: 30 },
        { title: "Review notes for the next quiz", priority: "medium", tags: ["study", "review"], estimatedMinutes: 20 },
      ],
    },
    {
      name: "Activities",
      icon: "sparkles",
      color: "#e8a94d",
      tasks: [
        { title: "Check practice or club times", priority: "low", tags: ["activities"], estimatedMinutes: 5 },
        { title: "Set aside time for a proper break", priority: "low", tags: ["wellbeing"], estimatedMinutes: 15 },
      ],
    },
  ],
  college: [
    {
      name: "Coursework",
      icon: "book",
      color: "#8270d5",
      tasks: [
        { title: "Break the next assignment into steps", priority: "high", tags: ["coursework", "focus"], estimatedMinutes: 20 },
        { title: "Review lecture notes from this week", priority: "medium", tags: ["study", "review"], estimatedMinutes: 25 },
      ],
    },
    {
      name: "Campus life",
      icon: "graduation",
      color: "#54a992",
      tasks: [
        { title: "Check campus events and deadlines", priority: "low", tags: ["campus", "plan"], estimatedMinutes: 10 },
        { title: "Reply to a group project message", priority: "medium", tags: ["project", "people"], estimatedMinutes: 10 },
      ],
    },
    {
      name: "Personal",
      icon: "heart",
      color: "#e98278",
      tasks: [
        { title: "Plan a grocery run", priority: "low", tags: ["life-admin"], estimatedMinutes: 15 },
        { title: "Make room for a meal and a break", priority: "medium", tags: ["wellbeing"], estimatedMinutes: 30 },
      ],
    },
  ],
  professional: [
    {
      name: "Work",
      icon: "briefcase",
      color: "#8270d5",
      tasks: [
        { title: "Choose the one outcome that matters today", priority: "high", tags: ["focus", "plan"], estimatedMinutes: 10 },
        { title: "Move one project deliverable forward", priority: "high", tags: ["project", "deep-work"], estimatedMinutes: 45 },
      ],
    },
    {
      name: "Meetings",
      icon: "calendar",
      color: "#54a992",
      tasks: [
        { title: "Review the agenda for your next meeting", priority: "medium", tags: ["meeting", "prep"], estimatedMinutes: 10 },
        { title: "Send a short follow-up with next steps", priority: "medium", tags: ["meeting", "follow-up"], estimatedMinutes: 10 },
      ],
    },
    {
      name: "Personal",
      icon: "heart",
      color: "#e98278",
      tasks: [
        { title: "Take a real lunch break", priority: "low", tags: ["wellbeing"], estimatedMinutes: 30 },
        { title: "Write down tomorrow's first task", priority: "low", tags: ["routine", "plan"], estimatedMinutes: 5 },
      ],
    },
  ],
  freelancer: [
    {
      name: "Client work",
      icon: "briefcase",
      color: "#8270d5",
      tasks: [
        { title: "Confirm the next client milestone", priority: "high", tags: ["client", "project"], estimatedMinutes: 15 },
        { title: "Send a progress update", priority: "medium", tags: ["client", "communication"], estimatedMinutes: 15 },
      ],
    },
    {
      name: "Business admin",
      icon: "folder",
      color: "#54a992",
      tasks: [
        { title: "Log this week's billable hours", priority: "medium", tags: ["admin", "finance"], estimatedMinutes: 15 },
        { title: "Follow up on an open invoice", priority: "high", tags: ["admin", "finance"], estimatedMinutes: 10 },
      ],
    },
    {
      name: "Personal",
      icon: "heart",
      color: "#e8a94d",
      tasks: [
        { title: "Set a clear end time for work", priority: "low", tags: ["routine", "wellbeing"], estimatedMinutes: 5 },
        { title: "Plan a screen-free break", priority: "low", tags: ["wellbeing"], estimatedMinutes: 20 },
      ],
    },
  ],
  developer: [
    {
      name: "Build",
      icon: "zap",
      color: "#8270d5",
      tasks: [
        { title: "Define the next smallest shippable change", priority: "high", tags: ["build", "focus"], estimatedMinutes: 15 },
        { title: "Write or update a focused test", priority: "medium", tags: ["quality", "code"], estimatedMinutes: 25 },
      ],
    },
    {
      name: "Code review",
      icon: "check",
      color: "#54a992",
      tasks: [
        { title: "Review one pull request", priority: "medium", tags: ["review", "team"], estimatedMinutes: 30 },
        { title: "Share clear next steps on open feedback", priority: "medium", tags: ["review", "communication"], estimatedMinutes: 10 },
      ],
    },
    {
      name: "Learning",
      icon: "book",
      color: "#e8a94d",
      tasks: [
        { title: "Read one section of a technical guide", priority: "low", tags: ["learning"], estimatedMinutes: 20 },
        { title: "Capture a useful note for later", priority: "low", tags: ["notes", "learning"], estimatedMinutes: 5 },
      ],
    },
  ],
  teacher: [
    {
      name: "Lesson planning",
      icon: "book",
      color: "#8270d5",
      tasks: [
        { title: "Outline the next lesson's learning goal", priority: "high", tags: ["lesson", "planning"], estimatedMinutes: 20 },
        { title: "Prepare materials for tomorrow", priority: "medium", tags: ["lesson", "prep"], estimatedMinutes: 25 },
      ],
    },
    {
      name: "Classroom",
      icon: "graduation",
      color: "#54a992",
      tasks: [
        { title: "Check in with a student who needs support", priority: "medium", tags: ["students", "follow-up"], estimatedMinutes: 10 },
        { title: "Refresh the class notice board", priority: "low", tags: ["classroom"], estimatedMinutes: 15 },
      ],
    },
    {
      name: "Grading & admin",
      icon: "check",
      color: "#e8a94d",
      tasks: [
        { title: "Grade the next small batch of work", priority: "medium", tags: ["grading", "focus"], estimatedMinutes: 30 },
        { title: "Send a family or team update", priority: "low", tags: ["communication"], estimatedMinutes: 10 },
      ],
    },
  ],
  personal: [
    {
      name: "Home",
      icon: "folder",
      color: "#8270d5",
      tasks: [
        { title: "Reset one small area", priority: "low", tags: ["home"], estimatedMinutes: 15 },
        { title: "Check the household calendar", priority: "medium", tags: ["home", "plan"], estimatedMinutes: 10 },
      ],
    },
    {
      name: "Wellbeing",
      icon: "heart",
      color: "#54a992",
      tasks: [
        { title: "Step outside for a few minutes", priority: "low", tags: ["wellbeing"], estimatedMinutes: 10 },
        { title: "Make time for a meal without multitasking", priority: "medium", tags: ["wellbeing", "routine"], estimatedMinutes: 25 },
      ],
    },
    {
      name: "Errands",
      icon: "sparkles",
      color: "#e8a94d",
      tasks: [
        { title: "Add anything running low to your list", priority: "low", tags: ["errands"], estimatedMinutes: 5 },
        { title: "Choose a good time for the next errand", priority: "low", tags: ["errands", "plan"], estimatedMinutes: 5 },
      ],
    },
  ],
  other: [
    {
      name: "Work",
      icon: "briefcase",
      color: "#8270d5",
      tasks: [
        { title: "Pick one useful next step", priority: "high", tags: ["focus", "plan"], estimatedMinutes: 20 },
        { title: "Send an update to someone who is waiting", priority: "medium", tags: ["communication"], estimatedMinutes: 10 },
      ],
    },
    {
      name: "Personal",
      icon: "heart",
      color: "#54a992",
      tasks: [
        { title: "Make space for a proper break", priority: "low", tags: ["wellbeing"], estimatedMinutes: 15 },
        { title: "Take care of one small life-admin task", priority: "medium", tags: ["life-admin"], estimatedMinutes: 10 },
      ],
    },
    {
      name: "Ideas",
      icon: "sparkles",
      color: "#e8a94d",
      tasks: [
        { title: "Capture an idea before it slips away", priority: "low", tags: ["ideas"], estimatedMinutes: 5 },
        { title: "Choose one idea to explore next", priority: "medium", tags: ["ideas", "plan"], estimatedMinutes: 10 },
      ],
    },
  ],
};