import type { components } from "./types";
import { apiBlob, apiFetch } from "./client";

type S = components["schemas"];
export type VoiceVideo = S["VoiceVideo"];
export type VideoShape = S["MakeVideoRequest"]["shape"];

const id = encodeURIComponent;

/** LCH-07: "Make a video" on my own voice answer. Returns at once; the video is made in the background. */
export const makeVideo = (aid: string, shape: VideoShape) =>
  apiFetch<VoiceVideo>(`/answers/${id(aid)}/videos`, { method: "POST", authed: true, body: { shape } });
/** My videos of this answer and where each one is (QUEUED, MAKING, READY, FAILED). */
export const listVideos = (aid: string) => apiFetch<S["VoiceVideoList"]>(`/answers/${id(aid)}/videos`, { authed: true });
/** The MP4 itself, for me only. */
export const videoFile = (vid: string) => apiBlob(`/voice-videos/${id(vid)}/file`, { authed: true });
