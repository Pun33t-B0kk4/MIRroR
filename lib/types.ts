export type SignalKey =
  | "accusation"
  | "curiosity"
  | "apology"
  | "justification"
  | "honesty"
  | "kindness"
  | "respectBoundary"
  | "demandForgiveness"
  | "contempt"
  | "assumption"
  | "specific"
  | "appeasement"
  | "question";

export type Signals = Record<SignalKey, number>;

export type Expression =
  | "guarded"
  | "bristling"
  | "listening"
  | "open"
  | "steady"
  | "firm";

export type CriterionId = "C1" | "C2" | "C3";

export type Criterion = {
  id: CriterionId;
  /** Short label shown in the review, e.g. "Asks clarifying questions". */
  label: string;
  /** What a turn must do to meet this criterion. Used by the turn labeler. */
  meets: string;
  /** What a turn does to earn a strike against this criterion. */
  misses: string;
};

/** How one user turn was judged. Strikes and met criteria never mix on one turn. */
export type TurnLabel = {
  met: CriterionId[];
  strike: CriterionId | null;
  note: string;
  source: "live" | "rules";
};

export type Outcome = "open" | "resolved" | "cooldown";

/** Hidden game state. Never shown to the user during the conversation. */
export type Progress = {
  met: CriterionId[];
  strikes: number;
  warned: boolean;
  outcome: Outcome;
};

export type Act = "talk" | "review" | "mirror";

export type Voice = "live" | "house";

export type Message = {
  id: string;
  role: "user" | "character" | "stage" | "mirror-self";
  text: string;
  at: string;
  label?: TurnLabel;
  voice?: Voice;
};

export type ResponseFeedback = {
  messageId: string;
  text: string;
  reply: string;
  result: "met" | "strike" | "neutral";
  /** e.g. "C1 met: Asks clarifying questions" or "Strike: C2 miss". */
  tag: string;
  pros: string[];
  cons: string[];
  tryInstead: string;
};

export type Feedback = {
  summary: string;
  pros: string[];
  cons: string[];
  responses: ResponseFeedback[];
  createdAt: string;
};

export type Thread = {
  id: string;
  slug: string;
  act: Act;
  messages: Message[];
  mirrorMessages: Message[];
  progress: Progress;
  /** Whether the friend has shared their hidden backstory. */
  revealed: boolean;
  voice: Voice;
  createdAt: string;
  updatedAt: string;
  endedAt: string | null;
  feedback: Feedback | null;
};

export type ScenePublic = {
  slug: string;
  level: number;
  title: string;
  forgiveness: string;
  logline: string;
  setting: string;
  premise: string;
  character: {
    name: string;
    pronouns: string;
    role: string;
    personality: string;
  };
  criteria: Criterion[];
  trophy: {
    title: string;
    skill: string;
  };
};
