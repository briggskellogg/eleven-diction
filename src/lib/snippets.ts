export type Industry =
  | 'medical'
  | 'hiring'
  | 'technical'
  | 'finance'
  | 'legal'
  | 'education'
  | 'customer_support'
  | 'general'

export interface IndustryConfig {
  id: Industry
  label: string
  description: string
  icon: 'atom' | 'users' | 'code' | 'dollar-circle' | 'shield-check' | 'book' | 'headphones' | 'chat-bubble'
  color: string
}

export const INDUSTRIES: IndustryConfig[] = [
  {
    id: 'medical',
    label: 'Medical',
    description: 'Healthcare, pharma, clinical',
    icon: 'atom',
    color: '#EEFFF2',
  },
  {
    id: 'hiring',
    label: 'Hiring & HR',
    description: 'Recruitment, onboarding, talent',
    icon: 'users',
    color: '#EBFDFF',
  },
  {
    id: 'technical',
    label: 'Technical',
    description: 'Software, engineering, devops',
    icon: 'code',
    color: '#FFF3FE',
  },
  {
    id: 'finance',
    label: 'Finance',
    description: 'Banking, investing, insurance',
    icon: 'dollar-circle',
    color: '#FEFFE7',
  },
  {
    id: 'legal',
    label: 'Legal',
    description: 'Law, compliance, contracts',
    icon: 'shield-check',
    color: '#FAF1FF',
  },
  {
    id: 'education',
    label: 'Education',
    description: 'Teaching, training, courses',
    icon: 'book',
    color: '#EFFEFA',
  },
  {
    id: 'customer_support',
    label: 'Support',
    description: 'Help desk, service, chat',
    icon: 'headphones',
    color: '#FEFFE7',
  },
  {
    id: 'general',
    label: 'General',
    description: 'Broad conversational content',
    icon: 'chat-bubble',
    color: '#E0DEDC',
  },
]

/**
 * Each industry has a set of conversational sentences designed to:
 * 1. Be easy to pronounce (no unusual words)
 * 2. Cover natural speech patterns (questions, statements, instructions)
 * 3. Include varied sentence lengths and cadences
 * 4. Represent the tone/register of that industry
 *
 * These get TTS'd with the original voice to build a corpus
 * of "general speech" training data for the IVC.
 */
const SNIPPETS: Record<Industry, string[]> = {
  medical: [
    "Good morning. I'm calling to discuss your recent lab results with you today.",
    "The treatment plan we've outlined should help manage your symptoms over the next several weeks.",
    "Please take this medication once daily with food, preferably in the morning.",
    "We'll need to schedule a follow-up appointment in about two weeks to check your progress.",
    "Based on the imaging results, everything looks normal and there's no cause for concern.",
    "I want to make sure you understand all of the possible side effects before we begin.",
    "Your vital signs are within a healthy range, which is very encouraging.",
    "Let me walk you through the procedure step by step so you know exactly what to expect.",
    "The patient has been responding well to the current course of treatment.",
    "We always recommend getting a second opinion if you have any doubts about the diagnosis.",
    "I'll send the referral to the specialist today and their office will contact you directly.",
    "It's important to stay hydrated and get plenty of rest during your recovery period.",
    "The clinical trial results were very promising and we're cautiously optimistic about the outcome.",
    "Do you have any questions about the care instructions before you leave today?",
    "We take patient safety very seriously and follow all established protocols.",
    "Your insurance should cover most of the cost, but I'll have billing confirm the details.",
    "The nurse will come in shortly to take your blood pressure and temperature.",
    "I'd like to review your medical history before we proceed with the examination.",
    "This is a routine screening and should only take about fifteen minutes.",
    "We've seen excellent outcomes with this approach in similar cases.",
  ],

  hiring: [
    "Thank you for taking the time to speak with us today about this opportunity.",
    "Can you walk me through your experience and what brought you to this point in your career?",
    "We're looking for someone who can hit the ground running and make an immediate impact.",
    "The role involves a mix of independent work and close collaboration with the team.",
    "Our company culture values transparency, accountability, and continuous learning.",
    "Tell me about a challenge you faced at work and how you handled it.",
    "We offer competitive benefits including health coverage, retirement plans, and flexible scheduling.",
    "The onboarding process takes about two weeks and you'll be paired with a mentor.",
    "We have team members across multiple time zones, so communication skills are essential.",
    "What are you looking for in your next role, and what matters most to you?",
    "The hiring timeline is about three weeks from the initial interview to a final decision.",
    "We'd love to hear about a project you're particularly proud of.",
    "This position reports directly to the head of the department.",
    "We believe in promoting from within and there's a clear path for growth here.",
    "Do you have any questions about the team or the day-to-day responsibilities?",
    "We'll follow up with next steps within the next few business days.",
    "The ideal candidate brings strong problem-solving skills and a collaborative mindset.",
    "We value diversity of thought and background on our teams.",
    "Let me tell you a little more about what a typical day looks like in this role.",
    "We're excited about the direction the company is headed and hope you'll be part of it.",
  ],

  technical: [
    "Let me walk you through the system architecture and how the components interact.",
    "We deployed the latest update to production last night and everything is running smoothly.",
    "The database query was taking too long, so we added an index to improve performance.",
    "Can you review this pull request before we merge it into the main branch?",
    "We're using a microservices approach to keep each component independent and scalable.",
    "The API endpoint returns a standard response format with status codes and error messages.",
    "I've set up automated testing to catch regressions before they reach production.",
    "The load balancer distributes traffic evenly across all available server instances.",
    "We should refactor this module to reduce complexity and improve maintainability.",
    "The monitoring dashboard shows that memory usage has been stable over the past week.",
    "I'll document the setup process so new developers can get started quickly.",
    "The cache layer sits between the application and the database to reduce latency.",
    "We follow a trunk-based development workflow with short-lived feature branches.",
    "The container image is built during the pipeline and pushed to the registry automatically.",
    "Let me know if you run into any issues during local development and I can help debug.",
    "We've implemented rate limiting to prevent abuse and protect the service.",
    "The configuration is managed through environment variables for flexibility across environments.",
    "Security patches should be applied within the maintenance window this weekend.",
    "The data pipeline processes incoming events in real time and writes to the data warehouse.",
    "I recommend breaking this into smaller tasks so we can ship incrementally.",
  ],

  finance: [
    "Let's review your portfolio performance over the last quarter.",
    "The interest rate on this account is fixed for the first twelve months.",
    "We recommend diversifying your investments to manage risk more effectively.",
    "Your monthly statement is available online and includes a detailed breakdown of all transactions.",
    "The market has shown steady growth this year, which has been encouraging for long-term investors.",
    "We'll need to verify your identity before we can proceed with this transaction.",
    "The annual percentage rate applies to any balance carried beyond the grace period.",
    "I can walk you through the different savings options and help you choose the best fit.",
    "Tax-advantaged accounts can make a meaningful difference in your long-term financial plan.",
    "The transfer should be completed within one to two business days.",
    "We take the security of your financial information very seriously.",
    "Your credit score has improved significantly since our last review.",
    "Let me explain the fee structure so there are no surprises down the road.",
    "We offer both short-term and long-term investment strategies depending on your goals.",
    "The compliance team has reviewed this and everything is in order.",
    "I'll send you a summary of our conversation along with the recommended next steps.",
    "The funds will be deposited directly into your primary account.",
    "We always recommend maintaining an emergency fund of three to six months of expenses.",
    "The quarterly earnings report exceeded expectations across all major segments.",
    "Please review the terms carefully before signing the agreement.",
  ],

  legal: [
    "Let me outline the key terms of the agreement for your review.",
    "Both parties have agreed to the conditions set forth in the contract.",
    "We recommend consulting with legal counsel before making any final decisions.",
    "The filing deadline is in thirty days, so we need to act promptly.",
    "This clause protects both parties in the event of a dispute.",
    "I'll prepare the necessary documents and have them ready for your signature by Friday.",
    "The terms of the settlement are confidential and should not be disclosed.",
    "We've conducted a thorough review and found no material compliance issues.",
    "The regulation requires annual reporting and disclosure of all relevant activities.",
    "Let me walk you through your rights and obligations under this agreement.",
    "The opposing counsel has responded and we're reviewing their position now.",
    "We've included a standard arbitration clause to handle any potential disagreements.",
    "The effective date of the policy change is the first of next month.",
    "All documentation should be retained for a minimum of seven years.",
    "I want to make sure you fully understand the implications before we proceed.",
    "The court has scheduled the hearing for the second week of next month.",
    "We're confident in our position and have strong supporting evidence.",
    "The non-disclosure agreement covers all proprietary information shared during the engagement.",
    "I'll coordinate with the other parties to finalize the terms as quickly as possible.",
    "Please feel free to reach out if you have any additional questions or concerns.",
  ],

  education: [
    "Welcome to today's session. Let's pick up where we left off last time.",
    "I'd like everyone to take a moment and think about the main idea we discussed.",
    "This concept builds on what we covered in the previous lesson.",
    "Let's work through this example together step by step.",
    "Does anyone have questions before we move on to the next topic?",
    "I've posted the reading materials online for you to review before our next meeting.",
    "The assignment is due by the end of the week and should take about two hours.",
    "Great question. Let me explain that in a slightly different way.",
    "I encourage you to work in small groups and share your ideas with each other.",
    "The key takeaway from today is that practice and repetition lead to improvement.",
    "We'll have a short review session before the final assessment.",
    "I want to make sure everyone feels comfortable with the material before we move forward.",
    "This is a safe space to ask questions and make mistakes. That's how we learn.",
    "Let's look at a real-world example to see how this applies in practice.",
    "Your feedback on the course has been really helpful and I appreciate your input.",
    "The grading criteria are clearly outlined in the syllabus for your reference.",
    "Take your time with this exercise. There's no need to rush.",
    "I'd like to hear from someone who hasn't spoken yet today.",
    "The supplemental resources are optional but highly recommended for deeper understanding.",
    "Excellent work today, everyone. I'll see you at the same time next week.",
  ],

  customer_support: [
    "Thank you for calling. How can I help you today?",
    "I understand your frustration and I'm going to do everything I can to resolve this for you.",
    "Let me pull up your account so I can take a closer look at the issue.",
    "Could you describe what happened so I can better understand the situation?",
    "I've made a note on your account and this will be addressed within twenty-four hours.",
    "Is there anything else I can help you with before we end the call?",
    "I'm going to transfer you to a specialist who can assist you further.",
    "Your satisfaction is our top priority and we want to make this right.",
    "The replacement will be shipped out today and you should receive it within three to five days.",
    "I completely understand and I apologize for the inconvenience.",
    "Let me check on the status of your order. Can you provide me with your order number?",
    "We've issued a full refund and it should appear on your statement within a few business days.",
    "I'll escalate this to our team lead to make sure it gets the attention it deserves.",
    "Thank you for your patience while I look into this for you.",
    "For security purposes, could you verify the email address associated with your account?",
    "I want to make sure we've covered everything. Is there anything else on your mind?",
    "Our team is available around the clock if you need additional support.",
    "I've updated your account with the changes we discussed.",
    "We value your feedback and it helps us improve our service for everyone.",
    "Thank you for being a loyal customer. We truly appreciate your business.",
  ],

  general: [
    "Good morning. Thank you for joining us today.",
    "I'd like to take a moment to introduce myself and share a little about my background.",
    "Let me start by giving you an overview of what we'll be covering.",
    "That's a great point and I think it's worth exploring further.",
    "We've made significant progress and I'm excited about where things are headed.",
    "I want to make sure we're all on the same page before we move forward.",
    "Can you share your thoughts on this? I'd love to hear your perspective.",
    "The timeline looks realistic and I'm confident we can deliver on schedule.",
    "Let's take a step back and look at the bigger picture for a moment.",
    "I appreciate you bringing that up. It's an important consideration.",
    "We should circle back on this topic once we have more information available.",
    "The results speak for themselves and we should be proud of what we've accomplished.",
    "I'll follow up with a summary and next steps after our meeting today.",
    "Thank you for your time and for the thoughtful discussion.",
    "I'm happy to answer any questions you might have at this point.",
    "Let's schedule a follow-up to continue this conversation next week.",
    "The key takeaway here is that preparation makes all the difference.",
    "I believe we're heading in the right direction and the data supports that.",
    "Please don't hesitate to reach out if anything comes up in the meantime.",
    "It was great speaking with you today. Let's stay in touch.",
  ],
}

/**
 * Returns conversational snippets for the given industry, cycling through
 * the pool as many times as needed to reach the requested count.
 */
export function getCorpusSnippets(industry: Industry, count: number = 15): string[] {
  const pool = [...SNIPPETS[industry]].sort(() => Math.random() - 0.5)
  const result: string[] = []
  for (let i = 0; i < count; i++) {
    result.push(pool[i % pool.length])
  }
  return result
}

/**
 * Groups snippets into longer passages (3-4 sentences each) for more natural-sounding
 * TTS output. Longer passages give the IVC more continuous speech to learn from.
 */
export function getCorpusPassages(industry: Industry, passageCount: number = 5): string[] {
  const snippets = getCorpusSnippets(industry, passageCount * 3)
  const passages: string[] = []

  for (let i = 0; i < snippets.length; i += 3) {
    const group = snippets.slice(i, i + 3)
    if (group.length > 0) {
      passages.push(group.join(' '))
    }
  }

  return passages
}

/**
 * Large bank of sentence templates with {word} placeholder.
 * Used for sentence splicing — the golden pronunciation clip replaces
 * the word's audio segment in each generated sentence.
 * Organized for positional and prosodic variety.
 */
const SPLICE_TEMPLATES: string[] = [
  // Word at beginning
  "{word} is an important topic we need to discuss.",
  "{word} has been gaining attention in recent months.",
  "{word} plays a critical role in our overall strategy.",
  "{word} represents a significant advancement in the field.",
  "{word} was mentioned several times during the meeting.",
  "{word} is something everyone should be familiar with.",
  "{word} has become a key focus area for the entire team.",
  "{word} is worth taking a closer look at this quarter.",
  "{word} could change the way we approach this challenge.",
  "{word} is at the center of this important discussion.",

  // Word in middle — short
  "We discussed {word} earlier today.",
  "I've heard about {word} from several sources.",
  "The report mentions {word} on multiple occasions.",
  "Let me explain {word} in more detail.",
  "Our focus on {word} has been paying off.",
  "The impact of {word} cannot be overstated.",
  "I believe {word} is the right approach here.",
  "The research on {word} is very promising.",
  "We need to address {word} before moving forward.",
  "I'd recommend looking into {word} more closely.",

  // Word in middle — medium
  "When we talk about {word}, we need to consider all the implications.",
  "I think the best approach to {word} involves careful planning and execution.",
  "Based on our analysis, {word} shows significant potential for growth.",
  "The team working on {word} has made remarkable progress this quarter.",
  "Our understanding of {word} has evolved considerably over the past year.",
  "If you look at the data around {word}, you'll see some interesting patterns.",
  "One thing I want to highlight about {word} is its practical applications.",
  "The feedback we received about {word} has been overwhelmingly positive.",
  "When I first learned about {word}, I was immediately impressed.",
  "The discussion around {word} has generated a lot of interest internally.",

  // Word in middle — long
  "I've spent considerable time reviewing {word} and I'm confident in our direction.",
  "The comprehensive analysis we conducted on {word} reveals several important insights.",
  "After extensive testing and evaluation, {word} has proven to be exactly what we need.",
  "I'd like to walk you through the key aspects of {word} so we can decide together.",
  "The strategic importance of {word} to our long-term goals cannot be emphasized enough.",
  "Everything we've learned so far about {word} suggests we're on the right track.",
  "I want to make sure everyone understands the significance of {word} before we proceed.",
  "The more I learn about {word}, the more convinced I am of its value.",
  "We need to allocate additional resources to {word} if we want to see results.",
  "The initial results from our work on {word} have exceeded all expectations.",

  // Word at end
  "Let me tell you more about {word}.",
  "The report includes a full section on {word}.",
  "We should definitely prioritize {word}.",
  "I'd like everyone to review the materials on {word}.",
  "There's been a lot of discussion recently about {word}.",
  "I'll send you the latest research on {word}.",
  "Our next meeting will focus primarily on {word}.",
  "Several team members have asked about {word}.",
  "The client was particularly interested in {word}.",
  "I was quite impressed when I first heard about {word}.",

  // Questions
  "Have you had a chance to review {word}?",
  "What are your thoughts on {word} so far?",
  "Did the team discuss {word} during the meeting?",
  "How should we approach {word} going forward?",
  "Do you think {word} is the right choice for this project?",
  "Has anyone else looked into {word} recently?",
  "When do you expect to have an update on {word}?",
  "Can you walk me through your understanding of {word}?",
  "Would it make sense to prioritize {word} this quarter?",
  "What impact do you think {word} will have on our timeline?",

  // Instructions / emphasis
  "Please review all available information on {word} before our next meeting.",
  "Make sure to include {word} in the final presentation.",
  "Take a moment to familiarize yourself with {word} and its implications.",
  "Consider how {word} fits into the broader strategy before proceeding.",
  "I want to emphasize that {word} is critical to our success.",
]

/**
 * Returns shuffle-selected splice sentence templates with the word injected.
 */
export function getSpliceTemplates(word: string, count: number): string[] {
  const shuffled = [...SPLICE_TEMPLATES].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, Math.min(count, SPLICE_TEMPLATES.length)).map(
    (t) => t.replace(/\{word\}/g, word)
  )
}

/**
 * Returns industry-appropriate sentences with the target word injected.
 * Used for validation — tests the word in realistic context from the same industry.
 */
export function getValidationSentences(word: string, industry: Industry): string[] {
  const templates: Record<Industry, string[]> = {
    medical: [
      `The patient has been prescribed {word} as part of their treatment plan.`,
      `We should review the clinical data on {word} before the next appointment.`,
      `Have you experienced any side effects from {word}?`,
    ],
    hiring: [
      `The candidate mentioned {word} during the technical interview.`,
      `Our team needs someone familiar with {word} for this role.`,
      `Can you describe your experience working with {word}?`,
    ],
    technical: [
      `We deployed {word} to production last night and it's running smoothly.`,
      `The documentation for {word} needs to be updated before release.`,
      `Let me walk you through how {word} integrates with the system.`,
    ],
    finance: [
      `Our analysis of {word} shows promising returns for the quarter.`,
      `The regulatory implications of {word} are significant.`,
      `I recommend we increase our position in {word} this quarter.`,
    ],
    legal: [
      `The contract includes a provision regarding {word}.`,
      `We need to verify compliance with {word} before proceeding.`,
      `The ruling on {word} could set an important precedent.`,
    ],
    education: [
      `Today we're going to learn about {word} and how it works.`,
      `Can anyone tell me what {word} means in this context?`,
      `The exam will cover everything we discussed about {word}.`,
    ],
    customer_support: [
      `I can help you with your question about {word}.`,
      `Let me look into the {word} issue on your account right now.`,
      `We've resolved the problem with {word} and it should be working.`,
    ],
    general: [
      `Let me tell you more about {word} and why it matters.`,
      `The team has been discussing {word} quite a bit this week.`,
      `We need to review the {word} documentation before our next meeting.`,
    ],
  }

  return (templates[industry] || templates.general).map((t) =>
    t.replace(/\{word\}/g, word)
  )
}
