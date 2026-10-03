// Read-only live configuration/eligibility/matching/Auth/public-view preflight.
// Supply credentials through the operator's environment; never as command-line arguments.
import {previewDailyDigest} from '../src/daily-digest.js';
try {
  const result=await previewDailyDigest(process.env,process.argv[2],Date.now());
  console.log(JSON.stringify(result));
} catch {
  // Suppress upstream bodies, personal data and credentials.
  console.error('Daily digest preflight failed. Check configuration, grants, Auth access and schema.');
  process.exitCode=1;
}
