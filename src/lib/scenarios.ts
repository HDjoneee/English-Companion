import { BriefcaseBusiness, Plane, Utensils, UsersRound } from "lucide-react";
import type { Scenario } from "../types";

export const scenarios: Scenario[] = [
  {
    id: "interview",
    title: "面试",
    role: "Interviewer",
    brief: "自我介绍、项目经历、行为面试",
    icon: BriefcaseBusiness,
    opening:
      "Welcome. Let's start with a common interview question: could you briefly introduce yourself and tell me what kind of role you are looking for?",
    keywords: ["experience", "project", "team", "impact", "challenge", "improve", "result", "role"],
    phrases: [
      "I have hands-on experience in...",
      "One project I am proud of is...",
      "The main challenge was...",
      "I measured the result by...",
      "I would bring strong ownership to this role."
    ],
    prompts: {
      a2: [
        "What are your main strengths for this job?",
        "Can you tell me about one project you worked on?",
        "Why do you want this role?",
        "What do you want to improve in your work skills?"
      ],
      b1: [
        "Tell me about a time when you solved a difficult problem at work.",
        "How do you handle feedback from your manager or teammates?",
        "Why should we choose you over another candidate?",
        "Do you have any questions for me about the team?"
      ],
      b2: [
        "Describe a project where you influenced stakeholders without direct authority.",
        "How do you balance speed, quality, and collaboration under pressure?",
        "Tell me about a failure and what changed in your process afterward.",
        "What would your first 90 days look like in this role?"
      ]
    }
  },
  {
    id: "dining",
    title: "点餐",
    role: "Server",
    brief: "入座、点餐、改菜、结账",
    icon: Utensils,
    opening:
      "Good evening. Welcome in. Are you ready to order, or would you like a few more minutes with the menu?",
    keywords: ["order", "recommend", "spicy", "allergy", "bill", "water", "starter", "main"],
    phrases: [
      "Could I have a few more minutes?",
      "What do you recommend?",
      "I'd like to order...",
      "Could you make it less spicy?",
      "Could we have the bill, please?"
    ],
    prompts: {
      a2: [
        "What would you like to drink?",
        "Would you like a starter or just a main course?",
        "How would you like your dish cooked?",
        "Would you like anything else?"
      ],
      b1: [
        "We are out of that dish tonight. Would you like a recommendation?",
        "Do you have any allergies or dietary preferences?",
        "How is everything tasting so far?",
        "Would you like to split the bill or pay together?"
      ],
      b2: [
        "The chef can adjust the dish, but it may change the flavor. What would you prefer?",
        "There is a short wait for the table by the window. Would that be okay?",
        "I can suggest a pairing if you tell me what flavors you enjoy.",
        "Was there anything about the service we could improve tonight?"
      ]
    }
  },
  {
    id: "meeting",
    title: "会议",
    role: "Meeting host",
    brief: "同步进展、表达分歧、确认行动项",
    icon: UsersRound,
    opening:
      "Thanks for joining. Let's begin with your update: what progress have you made since our last meeting?",
    keywords: ["update", "deadline", "risk", "blocked", "priority", "owner", "decision", "action"],
    phrases: [
      "My quick update is...",
      "The main blocker is...",
      "I suggest we prioritize...",
      "Could we clarify the owner?",
      "The next action item is..."
    ],
    prompts: {
      a2: [
        "What is your next task?",
        "Do you need help from anyone?",
        "When can you finish it?",
        "Can you repeat the action item?"
      ],
      b1: [
        "What risks should the team know about this week?",
        "How would you push back if the deadline is unrealistic?",
        "What decision do we need from the group today?",
        "Can you summarize the next steps for everyone?"
      ],
      b2: [
        "How would you align two teams that disagree on the priority?",
        "What trade-off are you making, and how should we evaluate it?",
        "How would you reframe this problem for a senior stakeholder?",
        "Please close the meeting with owners, dates, and risks."
      ]
    }
  },
  {
    id: "travel",
    title: "旅行",
    role: "Front desk agent",
    brief: "入住、问路、改签、投诉",
    icon: Plane,
    opening:
      "Good afternoon. Welcome to the hotel. May I have your name and booking details, please?",
    keywords: ["booking", "reservation", "passport", "check-in", "direction", "delay", "refund", "room"],
    phrases: [
      "I have a reservation under...",
      "Could you tell me how to get to...",
      "Is breakfast included?",
      "Could I change my booking?",
      "There seems to be a problem with..."
    ],
    prompts: {
      a2: [
        "How many nights will you stay?",
        "Would you like one key card or two?",
        "Do you need directions to the nearest subway station?",
        "What time would you like to check out?"
      ],
      b1: [
        "Your room is not ready yet. Would you like to store your luggage?",
        "There is a problem with the booking name. Could you explain what happened?",
        "Would you prefer a quieter room or a room with a better view?",
        "How would you describe the issue to customer service?"
      ],
      b2: [
        "Your connecting flight was delayed. Please explain the situation and request a solution.",
        "The hotel cannot offer the room type you booked. What alternative would be acceptable?",
        "You received an unexpected charge. Ask for clarification politely but firmly.",
        "Please summarize the agreement before ending the conversation."
      ]
    }
  }
];

export function getScenario(id: string) {
  return scenarios.find((scenario) => scenario.id === id) ?? scenarios[0];
}
