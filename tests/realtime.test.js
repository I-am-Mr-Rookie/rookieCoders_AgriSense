import test from "node:test";
import assert from "node:assert/strict";

import {
  createRealtimeService,
  createSafetyIdentifier,
  REALTIME_INSTRUCTIONS,
} from "../server/realtime.js";
import {
  applyAssistantTranscript,
  realtimeTranscriptEvent,
  startRealtimeSession,
} from "../src/realtime.js";
import { Tier2UnavailableError } from "../server/market-intelligence.js";

test("creates a stable privacy-preserving safety identifier", () => {
  const first = createSafetyIdentifier("farm_secret_code", "session-1", "pepper");
  const second = createSafetyIdentifier("farm_secret_code", "session-1", "pepper");

  assert.equal(first, second);
  assert.match(first, /^agrisense_[a-f0-9]{48}$/);
  assert.doesNotMatch(first, /farm|session|secret/);
});

test("mints a bounded Bangla-first Realtime secret without returning the standard key", async () => {
  let captured;
  const service = createRealtimeService({
    apiKey: "sk-server-standard-key",
    model: "gpt-realtime-2.1",
    voice: "marin",
    safetySecret: "private-pepper",
    fetchImpl: async (url, options) => {
      captured = { url, options, body: JSON.parse(options.body) };
      return {
        ok: true,
        async json() {
          return { value: "ek_short_lived", expires_at: 1_775_000_000 };
        },
      };
    },
  });

  const result = await service.createClientSecret({
    memoryId: "farm_secret_code",
    sessionId: "session-1",
  });

  assert.equal(captured.url, "https://api.openai.com/v1/realtime/client_secrets");
  assert.equal(captured.options.headers.Authorization, "Bearer sk-server-standard-key");
  assert.match(captured.options.headers["OpenAI-Safety-Identifier"], /^agrisense_/);
  assert.equal(captured.body.session.model, "gpt-realtime-2.1");
  assert.equal(captured.body.session.reasoning.effort, "low");
  assert.equal(captured.body.session.audio.output.voice, "marin");
  assert.equal(captured.body.session.audio.input.transcription.model, "gpt-4o-mini-transcribe");
  assert.deepEqual(captured.body.session.audio.input.turn_detection, {
    type: "semantic_vad",
    eagerness: "low",
    create_response: true,
    interrupt_response: false,
  });
  assert.match(captured.body.session.instructions, /Bangla/i);
  assert.match(captured.body.session.instructions, /brief spoken preamble/i);
  assert.match(captured.body.session.instructions, /Never reveal hidden reasoning/i);
  assert.equal(captured.body.session.tools[0].name, "run_agrisense_task");
  assert.deepEqual(result, {
    value: "ek_short_lived",
    expiresAt: 1_775_000_000,
    model: "gpt-realtime-2.1",
    voice: "marin",
  });
  assert.doesNotMatch(JSON.stringify(result), /sk-server-standard-key|private-pepper|farm_secret_code/);
  assert.match(REALTIME_INSTRUCTIONS, /confirm/i);
});

test("fails recoverably when Realtime is not configured", async () => {
  const service = createRealtimeService({ apiKey: "" });
  await assert.rejects(
    service.createClientSecret({ sessionId: "session-1" }),
    (error) => error instanceof Tier2UnavailableError && error.statusCode === 503,
  );
});

test("normalizes only visible transcript and heavy-task events", () => {
  assert.deepEqual(realtimeTranscriptEvent({
    type: "conversation.item.input_audio_transcription.completed",
    transcript: "আমার আলুর দাম দেখুন",
  }), {
    type: "user_transcript",
    text: "আমার আলুর দাম দেখুন",
    final: true,
  });
  assert.deepEqual(realtimeTranscriptEvent({
    type: "response.output_audio_transcript.delta",
    response_id: "response-1",
    delta: "আমি খুঁজছি",
  }), {
    type: "assistant_transcript",
    text: "আমি খুঁজছি",
    final: false,
    responseId: "response-1",
  });
  assert.deepEqual(realtimeTranscriptEvent({
    type: "response.function_call_arguments.done",
    name: "run_agrisense_task",
    call_id: "call-1",
    arguments: "{\"task\":\"price intelligence\"}",
  }), {
    type: "heavy_task",
    callId: "call-1",
    task: "price intelligence",
  });
  assert.equal(realtimeTranscriptEvent({ type: "response.reasoning.delta", delta: "private" }), null);
});

test("keeps assistant transcript deltas ordered within one response and resets between turns", () => {
  let state = { responseId: "", text: "" };
  state = applyAssistantTranscript(state, {
    type: "assistant_transcript",
    responseId: "response-1",
    text: "first ",
    final: false,
  });
  state = applyAssistantTranscript(state, {
    type: "assistant_transcript",
    responseId: "response-1",
    text: "turn",
    final: false,
  });
  assert.deepEqual(state, { responseId: "response-1", text: "first turn" });

  state = applyAssistantTranscript(state, {
    type: "assistant_transcript",
    responseId: "response-2",
    text: "second turn",
    final: true,
  });
  assert.deepEqual(state, { responseId: "response-2", text: "second turn" });
});

test("browser Realtime session uses only an ephemeral credential and closes every media resource", async () => {
  const calls = [];
  let stopped = 0;
  const track = { stop() { stopped += 1; } };
  const stream = { getTracks: () => [track] };
  class FakeDataChannel {
    constructor() {
      this.readyState = "open";
      this.sent = [];
      this.listeners = new Map();
      this.closed = false;
    }
    addEventListener(name, listener) {
      this.listeners.set(name, listener);
    }
    send(value) {
      this.sent.push(value);
    }
    close() {
      this.closed = true;
    }
  }
  class FakePeerConnection {
    constructor() {
      this.channel = new FakeDataChannel();
      this.closed = false;
      this.addedTracks = [];
    }
    addTrack(item, itemStream) {
      this.addedTracks.push([item, itemStream]);
    }
    createDataChannel() {
      return this.channel;
    }
    async createOffer() {
      return { type: "offer", sdp: "offer-sdp" };
    }
    async setLocalDescription(value) {
      this.localDescription = value;
    }
    async setRemoteDescription(value) {
      this.remoteDescription = value;
    }
    close() {
      this.closed = true;
    }
  }
  const events = [];
  let mediaConstraints;
  const session = await startRealtimeSession({
    tokenRequest: { memoryId: "farm_code", sessionId: "session-1" },
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      if (url === "/api/realtime/client-secret") {
        return {
          ok: true,
          async json() {
            return { value: "ek_browser_only", model: "gpt-realtime-2.1" };
          },
        };
      }
      return {
        ok: true,
        async text() {
          return "answer-sdp";
        },
      };
    },
    navigatorObject: {
      mediaDevices: {
        async getUserMedia(constraints) {
          mediaConstraints = constraints;
          return stream;
        },
      },
    },
    PeerConnection: FakePeerConnection,
    onEvent: (event) => events.push(event),
  });

  assert.equal(calls[1].url, "https://api.openai.com/v1/realtime/calls");
  assert.equal(calls[1].options.headers.Authorization, "Bearer ek_browser_only");
  assert.equal(session.peerConnection.remoteDescription.sdp, "answer-sdp");
  assert.deepEqual(mediaConstraints, {
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      channelCount: 1,
    },
  });
  session.sendEvent({ type: "response.create" });
  assert.deepEqual(JSON.parse(session.dataChannel.sent[0]), { type: "response.create" });

  session.close();

  assert.equal(stopped, 1);
  assert.equal(session.dataChannel.closed, true);
  assert.equal(session.peerConnection.closed, true);
  assert.deepEqual(events, []);
});
