function parseJson(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function boundedTranscript(value) {
  return typeof value === "string" ? value.trim().slice(0, 4_000) : "";
}

function boundedDelta(value) {
  return typeof value === "string" ? value.slice(0, 4_000) : "";
}

export function realtimeTranscriptEvent(event) {
  if (!event || typeof event !== "object") return null;
  if (event.type === "conversation.item.input_audio_transcription.completed") {
    const text = boundedTranscript(event.transcript);
    return text ? { type: "user_transcript", text, final: true } : null;
  }
  if (event.type === "response.output_audio_transcript.delta") {
    const text = boundedDelta(event.delta);
    return text ? {
      type: "assistant_transcript",
      text,
      final: false,
      responseId: String(event.response_id || event.item_id || ""),
    } : null;
  }
  if (event.type === "response.output_audio_transcript.done") {
    const text = boundedTranscript(event.transcript);
    return text ? {
      type: "assistant_transcript",
      text,
      final: true,
      responseId: String(event.response_id || event.item_id || ""),
    } : null;
  }
  if (
    event.type === "response.function_call_arguments.done"
    && event.name === "run_agrisense_task"
  ) {
    const args = parseJson(event.arguments);
    const task = boundedTranscript(args?.task);
    return task && event.call_id
      ? { type: "heavy_task", callId: String(event.call_id), task }
      : null;
  }
  if (event.type === "error") {
    return {
      type: "error",
      text: boundedTranscript(event.error?.message) || "Realtime voice encountered an error.",
      final: true,
    };
  }
  return null;
}

export function applyAssistantTranscript(current, event) {
  const responseId = String(event?.responseId || "");
  const sameTurn = Boolean(responseId) && responseId === current?.responseId;
  const text = event?.final ? boundedTranscript(event?.text) : boundedDelta(event?.text);
  return {
    responseId,
    text: event?.final || !sameTurn
      ? text
      : `${current?.text || ""}${text}`.slice(0, 4_000),
  };
}

async function readJson(response, fallback) {
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error || fallback);
  return data;
}

export async function startRealtimeSession({
  tokenRequest,
  fetchImpl = globalThis.fetch,
  navigatorObject = globalThis.navigator,
  PeerConnection = globalThis.RTCPeerConnection,
  onEvent = () => {},
  onRemoteStream = () => {},
} = {}) {
  if (typeof fetchImpl !== "function" || typeof PeerConnection !== "function") {
    throw new Error("This browser cannot start Realtime voice.");
  }
  const tokenResponse = await fetchImpl("/api/realtime/client-secret", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(tokenRequest || {}),
  });
  const token = await readJson(tokenResponse, "Realtime voice could not start.");
  if (typeof token?.value !== "string" || !token.value) {
    throw new Error("Realtime voice returned an invalid session credential.");
  }

  const stream = await navigatorObject?.mediaDevices?.getUserMedia?.({ audio: true });
  if (!stream) throw new Error("Microphone access is unavailable.");

  const peerConnection = new PeerConnection();
  const dataChannel = peerConnection.createDataChannel("oai-events");
  const tracks = stream.getTracks();
  for (const track of tracks) peerConnection.addTrack(track, stream);
  peerConnection.ontrack = (event) => onRemoteStream(event.streams?.[0] ?? null);
  dataChannel.addEventListener("message", (message) => {
    const raw = parseJson(message.data);
    const event = realtimeTranscriptEvent(raw);
    if (event) onEvent(event);
  });

  try {
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    const answerResponse = await fetchImpl("https://api.openai.com/v1/realtime/calls", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token.value}`,
        "Content-Type": "application/sdp",
      },
      body: offer.sdp,
    });
    if (!answerResponse.ok) throw new Error("Realtime voice connection was rejected.");
    const answerSdp = await answerResponse.text();
    await peerConnection.setRemoteDescription({ type: "answer", sdp: answerSdp });
  } catch (error) {
    for (const track of tracks) track.stop();
    dataChannel.close();
    peerConnection.close();
    throw error;
  }

  function sendEvent(event) {
    if (dataChannel.readyState !== "open") {
      throw new Error("Realtime voice is not ready.");
    }
    dataChannel.send(JSON.stringify(event));
  }

  return {
    peerConnection,
    dataChannel,
    sendEvent,
    sendText(text) {
      sendEvent({
        type: "conversation.item.create",
        item: {
          type: "message",
          role: "user",
          content: [{ type: "input_text", text: boundedTranscript(text) }],
        },
      });
      sendEvent({ type: "response.create" });
    },
    submitToolResult(callId, output) {
      sendEvent({
        type: "conversation.item.create",
        item: {
          type: "function_call_output",
          call_id: String(callId),
          output: boundedTranscript(output),
        },
      });
      sendEvent({ type: "response.create" });
    },
    close() {
      for (const track of tracks) track.stop();
      dataChannel.close();
      peerConnection.close();
    },
  };
}
