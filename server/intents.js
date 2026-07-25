const DIRECT_ASSISTANCE = /\b(flood|flooding|flash flood|emergency|evacuat(?:e|ion)|diseased? (?:plant|leaf)|sick (?:plant|leaf)|upload (?:a )?(?:photo|picture|image)|voice (?:ai|agent|chat)|talk (?:to|with).{0,24}voice)\b|বন্যা|জরুরি|রোগ(?:াক্রান্ত)? (?:গাছ|পাতা)|ছবি (?:দিতে|আপলোড)|ভয়েস|কথা বল|\bbonna\b/i;

export function isDirectAssistanceRequest(message) {
  return DIRECT_ASSISTANCE.test(String(message || ""));
}
