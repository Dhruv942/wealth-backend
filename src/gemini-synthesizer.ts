import { z } from "zod";
import type { Client, CrmGeneratedTask, CrmLiquiditySignal, User } from "./domain.js";

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

interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> }; finishReason?: string }>;
  promptFeedback?: { blockReason?: string };
  error?: { message?: string };
}

export function hasGeminiConfig() {
  return Boolean(process.env.GEMINI_API_KEY);
}

export async function synthesizeWithGemini(input: { client: Client; rawText: string; users: User[] }): Promise<AiSynthesis> {
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
      contents: [
        {
          role: "user",
          parts: [{ text: buildPrompt(input) }],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: "application/json",
        responseSchema: geminiResponseSchema,
      },
    }),
  });

  const body = await response.json() as GeminiResponse;
  if (!response.ok) {
    throw Object.assign(new Error(body.error?.message ?? "Gemini synthesis failed"), { statusCode: 502 });
  }
  if (body.promptFeedback?.blockReason) {
    throw Object.assign(new Error(`Gemini blocked the synthesis prompt: ${body.promptFeedback.blockReason}`), { statusCode: 502 });
  }

  const text = body.candidates?.flatMap((candidate) => candidate.content?.parts ?? []).map((part) => part.text ?? "").join("").trim();
  if (!text) throw Object.assign(new Error("Gemini returned no synthesis text"), { statusCode: 502 });
  try {
    return synthesisSchema.parse(JSON.parse(stripJsonFence(text)));
  } catch (error) {
    throw Object.assign(new Error("Gemini returned an invalid meeting synthesis payload"), { statusCode: 502, cause: error });
  }
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

function stripJsonFence(text: string) {
  return text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
}
