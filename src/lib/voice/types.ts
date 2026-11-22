/**
 * Voice types for the interview platform.
 *
 * Currently uses browser Web Speech API (SpeechRecognition + SpeechSynthesis)
 * for voice interaction. The LLM response is handled by the existing
 * /api/ai/chat endpoint.
 *
 * Future: Can be extended to use server-side ASR/TTS providers
 * (e.g., Google Cloud Speech) for better quality.
 */

export interface VoiceSessionConfig {
  sessionId: string;
  interviewTitle: string;
  aiName: string;
  questionCount: number;
}
