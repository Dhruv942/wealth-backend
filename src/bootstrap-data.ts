export const demoCallScenarios = [
  {
    id: "scenario-1",
    momentType: "Liquidity Event / LRS Remittance",
    title: "Gurgaon Commercial Property Sale (₹4.2 Cr) & Arbitrage Deployment",
    clientId: "cli-1",
    clientName: "Vikramaditya Singhania",
    rawNotes: "Had a 12 min call with Vikramaditya. He confirmed he sold his commercial warehouse in Gurgaon for ₹4.2 Cr. Advance token of ₹75L received in his Kotak account today.",
    parsedResult: {
      summary: "Client confirmed receipt of ₹75 Lakhs advance token from Gurgaon commercial property liquidation.",
      sentiment: "Bullish on liquidity, tactically cautious on high equity entry valuations",
      liquiditySignals: [
        { amount: "₹75 Lakhs", status: "Received today", asset: "Commercial Property Advance" },
        { amount: "₹3.45 Cr", status: "Expected 20-10-26", asset: "Gurgaon Property Final Tranche" },
      ],
      suitabilityGuardrail: "Arbitrage + Weekly STP aligns with the client's moderate capital deployment mandate.",
      generatedOpsTasks: [
        {
          id: "gen-task-201",
          title: "Execute ₹25L Arbitrage Purchase + ₹1.5L Weekly STP Mandate",
          assignedTo: "ops-1",
          assignedToName: "Central Ops & Compliance",
          priority: "High",
          slaCountdown: "3h 00m",
          slaStatus: "urgent",
          category: "Operations / Execution",
          status: "pending_ops",
        },
      ],
      whatsappDraft: "Namaste Vikramaditya ji, thank you for your time today. We will proceed with the agreed next steps after confirmation.",
      emailSubject: "Summary of Portfolio Strategy & LRS Education Remittance | Vikramaditya Singhania",
      emailBody: "Dear Mr. Singhania,\n\nThank you for the update. We will proceed only after confirmation and suitability checks.",
      crmStageUpdate: "Stage: Liquidity Deployment (Pipeline +₹4.20 Cr)",
    },
  },
  {
    id: "scenario-2",
    momentType: "Market Volatility / Re-KYC Compliance",
    title: "Midcap Drawdown Panic & CAMS Re-KYC Blocker",
    clientId: "cli-2",
    clientName: "Sunita & Rajesh Goenka",
    rawNotes: "Rajesh called panicking after seeing TV headlines about midcap correction. CAMS Re-KYC blocker also surfaced.",
    parsedResult: {
      summary: "Client was re-anchored to long-term retirement milestone. Immediate CAMS Re-KYC action required.",
      sentiment: "Anxious / Risk-Averse; comforted after advisor intervention",
      liquiditySignals: [{ amount: "₹35 Lakhs", status: "Idle in HDFC Savings", asset: "Bonus payout preserved" }],
      suitabilityGuardrail: "Advisor avoided panic liquidation during a market dip.",
      generatedOpsTasks: [
        {
          id: "gen-task-203",
          title: "Trigger Instant DigiLocker Re-KYC Link for Sunita Goenka",
          assignedTo: "ops-1",
          assignedToName: "Central Ops & Compliance",
          priority: "Critical",
          slaCountdown: "1h 30m",
          slaStatus: "near_breach",
          category: "Compliance / KYC",
          status: "pending_ops",
        },
      ],
      whatsappDraft: "Dear Rajesh ji, your 2029 retirement plan remains on track. Ops has sent the DigiLocker Re-KYC link.",
      emailSubject: "Portfolio Volatility Review & Re-KYC Link | Rajesh & Sunita Goenka",
      emailBody: "Dear Rajesh and Sunita,\n\nYour portfolio remains aligned. Please complete the Re-KYC link.",
      crmStageUpdate: "Stage: Relationship Retained & Compliance Shield Active",
    },
  },
];

export const firmMetrics = {
  totalAUM: "₹265.2 Cr",
  activeClients: 96,
  rmsCount: 4,
  tasksDueToday: 12,
  nearBreachSLAs: 2,
  crmHygieneScore: "94.8%",
  unallocatedCashAcrossClients: "₹2.85 Cr",
  taxLossHarvestableWindow: "₹18.4 Lakhs",
};

export const playbookLibrary = [
  { momentType: "Liquidity Event / LRS Remittance", status: "demo", scenarioId: "scenario-1" },
  { momentType: "Market Volatility / Re-KYC Compliance", status: "demo", scenarioId: "scenario-2" },
  { momentType: "Recurring Investment Setup (STP)", status: "demo", scenarioId: "scenario-3" },
  { momentType: "Tax-Year-End Harvesting", status: "coming_soon" },
  { momentType: "ELSS Lock-In Expiry", status: "coming_soon" },
];
