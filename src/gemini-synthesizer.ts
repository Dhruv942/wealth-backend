import { z } from "zod";
import type {
  Client,
  ClientContextNote,
  ClientOpportunity,
  ClientRelationshipMoment,
  CrmGeneratedTask,
  CrmLiquiditySignal,
  HouseView,
  PortfolioAllocation,
  PortfolioHolding,
  Task,
  User,
} from "./domain.js";

const generatedTaskSchema = z.object({
  title: z.string().min(3),
  details: z.string().min(3),
  category: z.string().min(2),
  priority: z.enum(["Critical", "Urgent", "High", "Medium", "Low"]),
  assigneeRole: z.enum(["RM", "OPS"]),
});

const synthesisSchema = z.object({
  summary: z.string().min(10),
  sentiment: z.string().min(3),
  suitabilityGuardrail: z.string().min(10),
  crmStageUpdate: z.string().min(3),
  liquiditySignals: z.array(z.object({
    amountDisplay: z.string().min(1),
    amountNumeric: z.number().nullable(),
    asset: z.string().min(2),
    status: z.string().min(2),
    expectedDate: z.string().nullable(),
  })).min(1),
  generatedOpsTasks: z.array(generatedTaskSchema).min(1).max(6),
  whatsappDraft: z.string().min(10),
  emailSubject: z.string().min(3),
  emailBody: z.string().min(10),
});

export type AiSynthesis = z.infer<typeof synthesisSchema>;

const copilotAdviceSchema = z.object({
  summary: z.string().min(10),
  portfolioDiagnosis: z.string().min(10),
  riskFlags: z.array(z.string().min(3)).min(1).max(8),
  talkingPoints: z.array(z.string().min(10)).min(2).max(6),
  objectionResponses: z.array(z.object({
    objection: z.string().min(3),
    response: z.string().min(10),
  })).min(1).max(5),
  recommendedNextTasks: z.array(generatedTaskSchema).min(1).max(6),
  complianceGuardrails: z.array(z.string().min(10)).min(1).max(6),
});

export type CopilotAdvice = z.infer<typeof copilotAdviceSchema>;

interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> }; finishReason?: string }>;
  promptFeedback?: { blockReason?: string };
  error?: { message?: string };
}

export function hasGeminiConfig() {
  return Boolean(process.env.GEMINI_API_KEY);
}

export async function synthesizeWithGemini(input: { client: Client; rawText: string; users: User[] }): Promise<AiSynthesis> {
  const text = await callGeminiJson({ prompt: buildPrompt(input), responseSchema: geminiResponseSchema, failureLabel: "synthesis" });
  try {
    return synthesisSchema.parse(JSON.parse(stripJsonFence(text)));
  } catch (error) {
    throw Object.assign(new Error("Gemini returned an invalid meeting synthesis payload"), { statusCode: 502, cause: error });
  }
}

export function synthesizeWithDeterministicBackend(input: { client: Client; rawText: string }): AiSynthesis {
  const amountMatch = input.rawText.match(/₹\s?[\d.]+\s?(?:Cr|Crore|Lakhs?|L|K)?/i);
  const amountDisplay = amountMatch?.[0] ?? "Review amount";
  const hasKyc = /kyc|cafs|cams|aadhaar|pan/i.test(input.rawText);
  const hasStp = /stp|systematic transfer|mandate/i.test(input.rawText);
  const taskTitle = hasKyc
    ? `Complete KYC follow-up for ${input.client.name}`
    : hasStp
      ? `Prepare STP mandate for ${input.client.name}`
      : `Review follow-up action for ${input.client.name}`;

  return synthesisSchema.parse({
    summary: `Backend-generated meeting draft for ${input.client.name}: ${input.rawText.slice(0, 360)}${input.rawText.length > 360 ? "..." : ""}`,
    sentiment: /panic|worried|anxious|concern/i.test(input.rawText) ? "Concerned, needs reassurance" : "Constructive, action-oriented",
    suitabilityGuardrail: `Review against ${input.client.riskCategory} mandate before execution. RM confirmation remains required.`,
    crmStageUpdate: hasKyc ? "Stage: Compliance Follow-up Active" : "Stage: Meeting Follow-up Active",
    liquiditySignals: [{
      amountDisplay,
      amountNumeric: null,
      asset: hasKyc ? "Compliance blocker" : "Client discussion signal",
      status: "Captured from meeting notes",
      expectedDate: null,
    }],
    generatedOpsTasks: [{
      title: taskTitle,
      details: `Backend-created from meeting notes for ${input.client.name}. Notes: ${input.rawText.slice(0, 240)}${input.rawText.length > 240 ? "..." : ""}`,
      category: hasKyc ? "Compliance / KYC" : "Operations / Execution",
      priority: hasKyc ? "Critical" : "High",
      assigneeRole: "OPS",
    }],
    whatsappDraft: `Dear ${input.client.name}, thank you for your time today. We have captured the agreed follow-up and will proceed after the required checks.`,
    emailSubject: `Meeting follow-up | ${input.client.name}`,
    emailBody: `Dear ${input.client.name},\n\nThank you for your time today. We have recorded the key discussion points and follow-up actions in the CRM. Our team will proceed only after the required review and suitability checks.\n\nRegards,\nK2 WealthDesk`,
  });
}

export async function generateCopilotAdviceWithGemini(input: {
  client: Client;
  query: string;
  contextMode: "pre_call" | "objection_defense" | "portfolio_review" | "next_best_action";
  users: User[];
  contextNotes: ClientContextNote[];
  relationshipMoments: ClientRelationshipMoment[];
  targetAllocation: PortfolioAllocation | null;
  currentAllocation: PortfolioAllocation | null;
  holdings: PortfolioHolding[];
  opportunities: ClientOpportunity[];
  openTasks: Task[];
  houseViews: HouseView[];
}): Promise<CopilotAdvice> {
  const text = await callGeminiJson({ prompt: buildCopilotPrompt(input), responseSchema: geminiCopilotAdviceSchema, failureLabel: "co-pilot advice" });
  try {
    return copilotAdviceSchema.parse(JSON.parse(stripJsonFence(text)));
  } catch (error) {
    throw Object.assign(new Error("Gemini returned an invalid co-pilot advice payload"), { statusCode: 502, cause: error });
  }
}

async function callGeminiJson(input: { prompt: string; responseSchema: Record<string, unknown>; failureLabel: string }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw Object.assign(new Error("GEMINI_API_KEY is required for AI synthesis"), { statusCode: 503 });

  const model = (process.env.GEMINI_MODEL ?? "gemini-2.5-flash").replace(/^models\//, "");
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: input.prompt }] }],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: "application/json",
        responseSchema: input.responseSchema,
      },
    }),
  });

  const body = await response.json() as GeminiResponse;
  if (!response.ok) {
    throw Object.assign(new Error(body.error?.message ?? `Gemini ${input.failureLabel} failed`), { statusCode: 502 });
  }
  if (body.promptFeedback?.blockReason) {
    throw Object.assign(new Error(`Gemini blocked the ${input.failureLabel} prompt: ${body.promptFeedback.blockReason}`), { statusCode: 502 });
  }

  const text = body.candidates?.flatMap((candidate) => candidate.content?.parts ?? []).map((part) => part.text ?? "").join("").trim();
  if (!text) throw Object.assign(new Error(`Gemini returned no ${input.failureLabel} text`), { statusCode: 502 });
  return text;
}

const geminiResponseSchema = {
  type: "OBJECT",
  properties: {
    summary: { type: "STRING" },
    sentiment: { type: "STRING" },
    suitabilityGuardrail: { type: "STRING" },
    crmStageUpdate: { type: "STRING" },
    liquiditySignals: {
      type: "ARRAY",
      minItems: 1,
      items: {
        type: "OBJECT",
        properties: {
          amountDisplay: { type: "STRING" },
          amountNumeric: { type: "NUMBER", nullable: true },
          asset: { type: "STRING" },
          status: { type: "STRING" },
          expectedDate: { type: "STRING", nullable: true },
        },
        required: ["amountDisplay", "amountNumeric", "asset", "status", "expectedDate"],
      },
    },
    generatedOpsTasks: {
      type: "ARRAY",
      minItems: 1,
      maxItems: 6,
      items: {
        type: "OBJECT",
        properties: {
          title: { type: "STRING" },
          details: { type: "STRING" },
          category: { type: "STRING" },
          priority: { type: "STRING", enum: ["Critical", "Urgent", "High", "Medium", "Low"] },
          assigneeRole: { type: "STRING", enum: ["RM", "OPS"] },
        },
        required: ["title", "details", "category", "priority", "assigneeRole"],
      },
    },
    whatsappDraft: { type: "STRING" },
    emailSubject: { type: "STRING" },
    emailBody: { type: "STRING" },
  },
  required: [
    "summary",
    "sentiment",
    "suitabilityGuardrail",
    "crmStageUpdate",
    "liquiditySignals",
    "generatedOpsTasks",
    "whatsappDraft",
    "emailSubject",
    "emailBody",
  ],
};

const geminiCopilotAdviceSchema = {
  type: "OBJECT",
  properties: {
    summary: { type: "STRING" },
    portfolioDiagnosis: { type: "STRING" },
    riskFlags: { type: "ARRAY", minItems: 1, maxItems: 8, items: { type: "STRING" } },
    talkingPoints: { type: "ARRAY", minItems: 2, maxItems: 6, items: { type: "STRING" } },
    objectionResponses: {
      type: "ARRAY",
      minItems: 1,
      maxItems: 5,
      items: {
        type: "OBJECT",
        properties: {
          objection: { type: "STRING" },
          response: { type: "STRING" },
        },
        required: ["objection", "response"],
      },
    },
    recommendedNextTasks: {
      type: "ARRAY",
      minItems: 1,
      maxItems: 6,
      items: {
        type: "OBJECT",
        properties: {
          title: { type: "STRING" },
          details: { type: "STRING" },
          category: { type: "STRING" },
          priority: { type: "STRING", enum: ["Critical", "Urgent", "High", "Medium", "Low"] },
          assigneeRole: { type: "STRING", enum: ["RM", "OPS"] },
        },
        required: ["title", "details", "category", "priority", "assigneeRole"],
      },
    },
    complianceGuardrails: { type: "ARRAY", minItems: 1, maxItems: 6, items: { type: "STRING" } },
  },
  required: ["summary", "portfolioDiagnosis", "riskFlags", "talkingPoints", "objectionResponses", "recommendedNextTasks", "complianceGuardrails"],
};

export function buildGeneratedTaskRows(input: {
  crmDraftId: string;
  synthesis: AiSynthesis;
  users: User[];
  fallbackUserId: string;
}): Omit<CrmGeneratedTask, "id" | "taskId" | "status" | "idempotencyKey">[] {
  const opsUser = input.users.find((item) => item.role === "OPS");
  return input.synthesis.generatedOpsTasks.map((task) => ({
    crmDraftId: input.crmDraftId,
    title: task.title,
    details: task.details,
    category: task.category,
    priority: task.priority,
    assignedToUserId: task.assigneeRole === "OPS" ? (opsUser?.id ?? input.fallbackUserId) : input.fallbackUserId,
  }));
}

export function buildLiquiditySignalRows(input: { crmDraftId: string; synthesis: AiSynthesis }): Omit<CrmLiquiditySignal, "id">[] {
  return input.synthesis.liquiditySignals.map((signal) => ({
    crmDraftId: input.crmDraftId,
    amountNumeric: signal.amountNumeric,
    amountDisplay: signal.amountDisplay,
    asset: signal.asset,
    status: signal.status,
    expectedDate: signal.expectedDate,
  }));
}

function buildPrompt(input: { client: Client; rawText: string; users: User[] }) {
  const rm = input.users.find((user) => user.id === input.client.assignedRmId);
  const ops = input.users.find((user) => user.role === "OPS");
  return [
    "You are K2 WealthDesk's post-meeting CRM synthesis engine for Indian wealth-management RMs.",
    "Extract a SEBI-suitable CRM summary, liquidity signals, and concrete follow-up tasks from the meeting notes.",
    "Return strict JSON only. Do not include markdown.",
    "",
    "JSON shape:",
    JSON.stringify({
      summary: "string",
      sentiment: "string",
      suitabilityGuardrail: "string",
      crmStageUpdate: "string",
      liquiditySignals: [{ amountDisplay: "string", amountNumeric: 0, asset: "string", status: "string", expectedDate: "yyyy-mm-dd or null" }],
      generatedOpsTasks: [{ title: "string", details: "string", category: "string", priority: "Critical|Urgent|High|Medium|Low", assigneeRole: "RM|OPS" }],
      whatsappDraft: "string",
      emailSubject: "string",
      emailBody: "string",
    }),
    "",
    "Rules:",
    "- Dates in client-facing text should use Indian context. Never claim execution happened unless notes say it happened.",
    "- Generated tasks must be concrete standup-board work items. Assign operations, KYC, mandate, documentation, CRM ops, and BSE StAR MF work to OPS. Assign advisory review/client objection handling to RM.",
    "- Do not provide regulated product advice beyond documenting suitability review and RM/client confirmation requirements.",
    "",
    `Client: ${input.client.name}`,
    `Risk mandate: ${input.client.riskCategory}`,
    `KYC status: ${input.client.kycStatus}`,
    `Assigned RM: ${rm?.name ?? input.client.assignedRmId}`,
    `Ops desk: ${ops?.name ?? "Central Ops"}`,
    "",
    "Meeting notes:",
    input.rawText,
  ].join("\n");
}

function buildCopilotPrompt(input: {
  client: Client;
  query: string;
  contextMode: "pre_call" | "objection_defense" | "portfolio_review" | "next_best_action";
  users: User[];
  contextNotes: ClientContextNote[];
  relationshipMoments: ClientRelationshipMoment[];
  targetAllocation: PortfolioAllocation | null;
  currentAllocation: PortfolioAllocation | null;
  holdings: PortfolioHolding[];
  opportunities: ClientOpportunity[];
  openTasks: Task[];
  houseViews: HouseView[];
}) {
  const rm = input.users.find((user) => user.id === input.client.assignedRmId);
  const context = {
    client: {
      name: input.client.name,
      firmOrFamily: input.client.firmOrFamily,
      tier: input.client.tier,
      city: input.client.city,
      assignedRm: rm?.name ?? input.client.assignedRmId,
      riskCategory: input.client.riskCategory,
      kycStatus: input.client.kycStatus,
      aumNumeric: input.client.aumNumeric,
    },
    portfolio: {
      targetAllocation: input.targetAllocation,
      currentAllocation: input.currentAllocation,
      holdings: input.holdings.map((holding) => ({
        name: holding.name,
        assetType: holding.assetType,
        valueDisplay: holding.valueDisplay,
        returnDisplay: holding.returnDisplay,
        sourceSystem: holding.sourceSystem,
      })),
      opportunities: input.opportunities.map((opportunity) => ({
        type: opportunity.type,
        title: opportunity.title,
        description: opportunity.description,
        severity: opportunity.severity,
        amountNumeric: opportunity.amountNumeric,
        status: opportunity.status,
      })),
    },
    openTasks: input.openTasks.map((task) => ({
      title: task.title,
      details: task.details,
      category: task.category,
      priority: task.priority,
      status: task.status,
      slaStatus: task.slaStatus,
      assignedToName: task.assignedToName,
      source: task.source,
    })),
    contextNotes: input.contextNotes.map((note) => ({ note: note.note, source: note.source, updatedAt: note.updatedAt })),
    relationshipMoments: input.relationshipMoments,
    approvedHouseViews: input.houseViews.map((view) => ({
      title: view.title,
      summary: view.summary,
      tags: view.tags,
      approvedBy: view.approvedBy,
      lastReviewedAt: view.lastReviewedAt,
      version: view.version,
    })),
  };

  return [
    "You are K2 WealthDesk's RM Co-Pilot for Indian private wealth relationship managers.",
    "Use only the provided repository context. If information is missing, say what needs verification instead of inventing it.",
    "Return strict JSON only. Do not include markdown.",
    "",
    "Goal:",
    "- Help the RM prepare for a client call, answer objections, review portfolio diagnostics, or choose next best actions.",
    "- Stay advisory-safe: no direct product execution instruction, no guaranteed returns, no unapproved house view, and no claim that suitability has passed unless context says so.",
    "- Recommended tasks must be practical standup-board work items. Assign operational/KYC/documentation/mandate work to OPS; assign advisory review/client conversation work to RM.",
    "",
    `Mode: ${input.contextMode}`,
    `RM query: ${input.query}`,
    "",
    "Repository context JSON:",
    JSON.stringify(context),
  ].join("\n");
}

function stripJsonFence(text: string) {
  return text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
}
