const DAY = 86_400_000;

export const STEPS = [
  {
    "day": 0,
    "step": "welcome",
    "subject": "Welcome to VeeAys — your first-week roadmap",
    "stem": "day-00-welcome",
    "variants": {
      "free": {
        "alias": "veeays-lifecycle-v3-day-00-welcome-free",
        "resendDraftId": "7975d03d-d09d-4f44-9afa-3d74bc36b8e8"
      },
      "pro": {
        "alias": "veeays-lifecycle-v3-day-00-welcome-pro",
        "resendDraftId": "73882972-8e7c-4e35-b377-fa91b25ced79"
      }
    }
  },
  {
    "day": 2,
    "step": "getting-started",
    "subject": "Three filters that make remote job hunting easier",
    "stem": "day-02-getting-started",
    "variants": {
      "free": {
        "alias": "veeays-lifecycle-v3-day-02-getting-started-free",
        "resendDraftId": "f4105a16-ac2d-41f4-9402-cd6fd91474c1"
      },
      "pro": {
        "alias": "veeays-lifecycle-v3-day-02-getting-started-pro",
        "resendDraftId": "7c7afc05-a20c-4645-bc32-67c44986c80e"
      }
    }
  },
  {
    "day": 3,
    "step": "va-skills-lab",
    "subject": "Thinking of becoming a VA? Start here",
    "stem": "day-03-va-skills-lab",
    "variants": {
      "free": {
        "alias": "veeays-lifecycle-v3-day-03-va-skills-lab-free",
        "resendDraftId": "78a27992-5c01-4b2f-bf88-860f055f0359"
      },
      "pro": {
        "alias": "veeays-lifecycle-v3-day-03-va-skills-lab-pro",
        "resendDraftId": "083e158a-45de-484c-8915-6850e6059d8b"
      }
    }
  },
  {
    "day": 5,
    "step": "profile-tip",
    "subject": "Turn everyday experience into a stronger profile",
    "stem": "day-05-profile",
    "variants": {
      "free": {
        "alias": "veeays-lifecycle-v3-day-05-profile-free",
        "resendDraftId": "3f485bb4-23b2-4726-96e9-3997695d688b"
      },
      "pro": {
        "alias": "veeays-lifecycle-v3-day-05-profile-pro",
        "resendDraftId": "ae4582ec-cb9d-4a59-9678-7a78a8985e98"
      }
    }
  },
  {
    "day": 7,
    "step": "pro-introduction",
    "subject": "The 20-minute routine that makes job searching manageable",
    "stem": "day-07-pro",
    "variants": {
      "free": {
        "alias": "veeays-lifecycle-v3-day-07-pro-free",
        "resendDraftId": "5eee84ae-d53c-420a-9224-2ade6213ee1e"
      },
      "pro": {
        "alias": "veeays-lifecycle-v3-day-07-pro-pro",
        "resendDraftId": "ab535e3c-64a0-4d3e-a3df-85bb67acef37"
      }
    }
  },
  {
    "day": 10,
    "step": "safer-search",
    "subject": "Five job scam warnings to remember",
    "stem": "day-10-job-safety",
    "variants": {
      "free": {
        "alias": "veeays-lifecycle-v3-day-10-job-safety-free",
        "resendDraftId": "54eb7cc8-b16b-4557-89d7-d4509cb773d0"
      },
      "pro": {
        "alias": "veeays-lifecycle-v3-day-10-job-safety-pro",
        "resendDraftId": "a6285804-c615-426b-9c6c-3354fdba2728"
      }
    }
  },
  {
    "day": 14,
    "step": "interview-tip",
    "subject": "The interview formula you can practise in 10 minutes",
    "stem": "day-14-interviews",
    "variants": {
      "free": {
        "alias": "veeays-lifecycle-v3-day-14-interviews-free",
        "resendDraftId": "edc11c7e-1323-4cec-b704-4753dc1e8c9e"
      },
      "pro": {
        "alias": "veeays-lifecycle-v3-day-14-interviews-pro",
        "resendDraftId": "4ea371b2-2a3e-45c9-895b-d82d93cdd1a4"
      }
    }
  },
  {
    "day": 19,
    "step": "resume-tip",
    "subject": "Three résumé fixes that help employers understand you",
    "stem": "day-19-resume",
    "variants": {
      "free": {
        "alias": "veeays-lifecycle-v3-day-19-resume-free",
        "resendDraftId": "00345a33-49b0-43ec-8503-939ea9d1e767"
      },
      "pro": {
        "alias": "veeays-lifecycle-v3-day-19-resume-pro",
        "resendDraftId": "3cb8a239-1c72-4817-8602-97a39550a6b2"
      }
    }
  },
  {
    "day": 24,
    "step": "follow-up-tip",
    "subject": "A follow-up email you can actually send",
    "stem": "day-24-follow-up",
    "variants": {
      "free": {
        "alias": "veeays-lifecycle-v3-day-24-follow-up-free",
        "resendDraftId": "c90b1a4d-abe7-4163-8d92-b5c623844f51"
      },
      "pro": {
        "alias": "veeays-lifecycle-v3-day-24-follow-up-pro",
        "resendDraftId": "332a5190-68c8-42eb-9aae-3b5bd50b5684"
      }
    }
  },
  {
    "day": 30,
    "step": "first-month",
    "subject": "Your first-month check-in + your next 30-day plan",
    "stem": "day-30-first-month",
    "variants": {
      "free": {
        "alias": "veeays-lifecycle-v3-day-30-first-month-free",
        "resendDraftId": "47d7a005-419d-4fd5-9cad-21c99289ef54"
      },
      "pro": {
        "alias": "veeays-lifecycle-v3-day-30-first-month-pro",
        "resendDraftId": "4aa024c0-6b1c-4af5-a7f5-15b865efda3e"
      }
    }
  }
];

const stepByDay = new Map(STEPS.map(step => [step.day, step]));

function activeConsent(consent, registered, milestone) {
  const granted = Date.parse(consent?.at);
  return consent?.enabled === true && granted >= registered && granted <= milestone;
}

// Candidate policy for the existing lifecycle runner. It requires authoritative
// consent, suppression, plan and delivery state, read again inside the send transaction.
export function dueLifecycleEmail(member, now, enrollmentStart) {
  const registered = Date.parse(member?.createdAt);
  const launch = Date.parse(enrollmentStart);
  const confirmed = Date.parse(member?.confirmedAt);
  const step = stepByDay.get(Math.floor((now - registered) / DAY));
  if (!step || !Number.isFinite(launch) || registered < launch ||
      !(confirmed >= registered && confirmed <= now) ||
      member.suppressed !== false || member.banned !== false ||
      !member.unsubscribeToken || !Array.isArray(member.completed) ||
      !['free', 'pro'].includes(member.plan) || member.completed.includes(step.step)) {
    return null;
  }

  // The independent account welcome and this milestone must share an atomic
  // deduplication boundary before the lifecycle version can be used.
  if (step.day === 0 && member.legacyWelcomeState !== 'clear') return null;

  const milestone = registered + step.day * DAY;
  if (!activeConsent(member.consent?.tips, registered, milestone)) return null;
  const canPromote = member.plan === 'free' &&
    activeConsent(member.consent?.pro, registered, milestone);
  const variant = canPromote ? 'free' : 'pro';
  return { step: step.step, variant, ...step.variants[variant] };
}
