import type { Criterion, ScenePublic } from "@/lib/types";

/*
 * The five scenarios from "Confrontational Friend Scenarios" (Oct 10, 2026).
 * Every scenario is the same situation: the user made a hurtful joke about a
 * friend at a party, and the friend confronts them. Ordered easiest to hardest.
 * Scenarios 1 and 4 use the default criteria; 2, 3 and 5 use variants.
 */

const ASK: Criterion = {
  id: "C1",
  label: "Asks clarifying questions",
  meets:
    "Asks a genuine, open question about the friend's own experience or feelings (what hurt, what it was like, what happened for them). Rhetorical, deflecting, or impatient questions, and questions about other people, do not count.",
  misses:
    "Assumes, projects, or answers for the friend instead of asking: supplying their reason or feelings for them, speaking for how others reacted, or asking a rhetorical question like \"you're seriously mad about that?\"",
};

const validate = (name: string): Criterion => ({
  id: "C2",
  label: `Validates ${name}'s feelings`,
  meets: `Acknowledges that ${name}'s hurt makes sense, names why it hurt, or affirms their right to feel it, without minimizing.`,
  misses: `Dismisses, minimizes, blames ${name}, or excuses the joke with intent ("it was just a joke", "you're overthinking it", "it's not that big a deal", "you were laughing too").`,
});

const apologize = (name: string): Criterion => ({
  id: "C3",
  label: "Apologizes and asks what to do differently",
  meets: `Gives a clear apology for their own action (no "but", no "sorry you feel that way") and asks ${name} what to do differently or what would help.`,
  misses: `Gives a non-apology ("sorry you feel that way", "sorry if"), an apology with a "but", rushes or demands forgiveness, or refuses to ask what to change.`,
});

export const scenes: ScenePublic[] = [
  {
    slug: "jordan",
    level: 1,
    title: "The Loading Screen",
    forgiveness: "Easily forgiving",
    logline: "You called Jordan \"the human loading screen\" in front of their crush.",
    setting: "The day after Friday's party.",
    premise:
      "At a Friday party, you called Jordan \"the human loading screen\" while Jordan was talking to someone they like. People laughed, and the crush walked off. Jordan wants to talk.",
    character: {
      name: "Jordan",
      pronouns: "they/them",
      role: "your best friend since freshman year",
      personality: "Warm, conflict-averse, downplays their own feelings at first.",
    },
    criteria: [ASK, validate("Jordan"), apologize("Jordan")],
    trophy: { title: "The Loading Screen", skill: "Curious first, sorry second." },
  },
  {
    slug: "priya",
    level: 2,
    title: "The Early Exit",
    forgiveness: "Gentle but guarded",
    logline: "You mocked Priya for leaving the party early to study.",
    setting: "Your shared dorm room, the next morning.",
    premise:
      "When Priya left the party early, you announced, \"Priya's going home to make out with her textbook,\" and the room laughed. Priya brings it up the next morning.",
    character: {
      name: "Priya",
      pronouns: "she/her",
      role: "your roommate and best friend",
      personality: "Soft-spoken, private, shuts down when misread.",
    },
    criteria: [
      {
        ...ASK,
        label: "Asks clarifying questions instead of assuming",
      },
      {
        id: "C2",
        label: "Reflects Priya's feelings back in their own words",
        meets:
          "Puts Priya's feeling into their own words in a way that shows they understood it (not just \"I get it\"), e.g. naming that the joke made her feel like an outsider.",
        misses:
          "Dismisses, minimizes, or tells Priya what she feels (\"it's the stress talking\", \"you'll get used to it\", \"it'll feel smaller tomorrow\").",
      },
      {
        id: "C3",
        label: "Offers one concrete repair action",
        meets:
          "Apologizes and offers one specific, concrete thing they will do differently (e.g. walking her out and telling people she has an exam).",
        misses:
          "Gives a non-apology (\"sorry if it came out wrong\"), refuses to commit to any change, or deflects (\"I can't control what other people think\", \"I don't know what you want from me\").",
      },
    ],
    trophy: { title: "The Early Exit", skill: "Ask, don't assume." },
  },
  {
    slug: "marcus",
    level: 3,
    title: "The Drink Run",
    forgiveness: "Defensive, sarcastic",
    logline: "You joked about Marcus not being able to afford drinks.",
    setting: "Outside the dining hall, two days after the party.",
    premise:
      "When Marcus passed on the drink run, you said, \"Don't worry, Marcus's scholarship doesn't cover fun.\" Marcus finds you after class.",
    character: {
      name: "Marcus",
      pronouns: "he/him",
      role: "your best friend from high school, now at the same college",
      personality: "Jokes to cover hurt, quick to bristle, loyal once trust returns.",
    },
    criteria: [
      ASK,
      {
        id: "C2",
        label: "Takes responsibility with no \"but\" or intent excuses",
        meets:
          "Owns the impact plainly, with no \"but\" and no excuse about intent or being drunk (e.g. \"That's on me. Being drunk doesn't change that.\").",
        misses:
          "Excuses or minimizes: \"it was a joke\", \"everyone was drunk\", \"I didn't mean it like that\", \"I'm sorry, but...\", or \"you joke about money yourself\".",
      },
      {
        id: "C3",
        label: "Apologizes and asks which topics are off-limits",
        meets:
          "Gives a clean apology and asks Marcus what topics they should never joke about.",
        misses:
          "Treats the apology as a box to check (\"I said sorry, what else do you want?\") or refuses to ask what to change.",
      },
    ],
    trophy: { title: "The Drink Run", skill: "No buts." },
  },
  {
    slug: "sofia",
    level: 4,
    title: "The Secret",
    forgiveness: "Hurt, accusatory",
    logline: "You turned a breakup Sofia told you in confidence into a joke.",
    setting: "Sofia's doorway, the day after the party.",
    premise:
      "Sofia told you privately that her ex broke up with her over text. At the party, you joked, \"Careful, Sofia's phone might dump you,\" and people asked her about it all night.",
    character: {
      name: "Sofia",
      pronouns: "she/her",
      role: "your closest friend since orientation",
      personality: "Direct, emotional, keeps score when hurt, deeply loyal.",
    },
    criteria: [ASK, validate("Sofia"), apologize("Sofia")],
    trophy: { title: "The Secret", skill: "Trust is the real topic." },
  },
  {
    slug: "dev",
    level: 5,
    title: "The Story",
    forgiveness: "Least forgiving, needs space",
    logline: "Your body-shaming joke about Dev ended up on someone's Instagram story.",
    setting: "After intramural practice.",
    premise:
      "As Dev went back for more food, you said, \"Third plate, someone warn the couch.\" A partygoer filmed it and posted it to their Instagram story. Dev has seen it.",
    character: {
      name: "Dev",
      pronouns: "he/him",
      role: "your best friend and teammate on the intramural soccer team",
      personality: "Blunt, slow to trust, shuts the door when pushed.",
    },
    criteria: [
      ASK,
      {
        ...validate("Dev"),
        label: "Validates Dev's feelings without minimizing them",
      },
      {
        id: "C3",
        label: "Apologizes, takes one repair step, and respects Dev's need for space",
        meets:
          "Apologizes, takes or commits to one concrete repair step (e.g. asking the poster to take it down, correcting it with the team), and respects Dev's request for space without pushing. This criterion is met only once all three parts have happened, across one or more turns.",
        misses:
          "Rushes or demands forgiveness (\"so are we good?\", \"can we just hang out tonight?\"), pushes after Dev asks for space, or treats the apology as a transaction.",
      },
    ],
    trophy: { title: "The Story", skill: "Resolution isn't always instant." },
  },
];

export function getScene(slug: string) {
  return scenes.find((scene) => scene.slug === slug);
}
