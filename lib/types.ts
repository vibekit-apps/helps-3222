export type User = { id: string; email: string; name: string | null; createdAt: string };
export type Legislator = { id: string; name: string; party: string; state: string; chamber: string; district: string; email?: string; phone?: string; website?: string; image?: string };
export type StateDirectory = { state: string; name: string; directoryUrl: string; legislatureUrl: string; source: 'openstates' | 'official-directory'; legislators: Legislator[] };
export type Packet = { id: string; title: string; billName: string; state: string; summary: string; foiaNeed: string; sponsorTarget: string; nextStep: string; createdAt: string };
export type SavedLetter = { id: string; topic: string; recipient: string; tone: string; state: string; content: string; createdAt: string };
export type Plan = { id: string; name: string; priceLabel: string; amount: number; interval: 'week' | 'month' | 'year'; description: string };
