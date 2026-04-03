'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  connectCodeLinkSocket,
  emitWebRtcAnswer,
  emitWebRtcIceCandidate,
  emitWebRtcOffer,
  emitWebRtcReady,
  joinRealtimeSession,
} from '@/lib/codelink-socket';
import { useMentorshipStore } from '@/store/mentorship-store';

function getPeerConnectionConfig(): RTCConfiguration {
  const stunUrl =
    process.env.NEXT_PUBLIC_WEBRTC_STUN_URL ?? 'stun:stun.l.google.com:19302';
  const turnUrl = process.env.NEXT_PUBLIC_WEBRTC_TURN_URL;
  const turnUsername = process.env.NEXT_PUBLIC_WEBRTC_TURN_USERNAME;
  const turnCredential = process.env.NEXT_PUBLIC_WEBRTC_TURN_CREDENTIAL;

  const iceServers: RTCIceServer[] = [{ urls: stunUrl }];

  if (turnUrl && turnUsername && turnCredential) {
    iceServers.push({
      urls: turnUrl,
      username: turnUsername,
      credential: turnCredential,
    });
  }

  return { iceServers };
}

type CallStatus =
  | 'Preparing camera...'
  | 'Waiting for other participant'
  | 'Connecting...'
  | 'Connected'
  | 'Reconnecting...'
  | 'Camera/microphone unavailable';

interface SignalSessionDescription {
  type?: string;
  sdp?: string;
}

interface SignalIceCandidate {
  candidate?: string;
  sdpMid?: string | null;
  sdpMLineIndex?: number | null;
  usernameFragment?: string | null;
}

export interface SessionWebRtcState {
  callStatus: CallStatus;
  hasLocalStream: boolean;
  hasRemoteStream: boolean;
  localVideoRef: (element: HTMLVideoElement | null) => void;
  remoteVideoRef: (element: HTMLVideoElement | null) => void;
}

function buildRemoteStream(event: RTCTrackEvent, existingStream: MediaStream | null) {
  if (event.streams[0]) {
    return event.streams[0];
  }

  const nextStream = existingStream ?? new MediaStream();
  nextStream.addTrack(event.track);
  return nextStream;
}

function mergeStreams(existingStream: MediaStream | null, extraStream: MediaStream) {
  const nextStream = new MediaStream();

  existingStream?.getTracks().forEach((track) => {
    if (track.readyState === 'live') {
      nextStream.addTrack(track);
    }
  });

  extraStream.getTracks().forEach((track) => {
    nextStream.addTrack(track);
  });

  return nextStream;
}

function toSessionDescriptionInit(
  description: SignalSessionDescription,
): RTCSessionDescriptionInit | null {
  if (
    !description.type ||
    !['offer', 'answer', 'pranswer', 'rollback'].includes(description.type)
  ) {
    return null;
  }

  return {
    type: description.type as RTCSdpType,
    sdp: description.sdp,
  };
}

function toIceCandidateInit(candidate: SignalIceCandidate): RTCIceCandidateInit {
  return {
    candidate: candidate.candidate,
    sdpMid: candidate.sdpMid,
    sdpMLineIndex: candidate.sdpMLineIndex,
    usernameFragment: candidate.usernameFragment,
  };
}

function playVideoElement(element: HTMLVideoElement | null) {
  if (!element) {
    return;
  }

  void element.play().catch(() => {
    // Ignore autoplay timing errors; the stream is still attached.
  });
}

export function useSessionWebRtc(): SessionWebRtcState {
  const currentSession = useMentorshipStore((state) => state.currentSession);
  const user = useMentorshipStore((state) => state.user);
  const isMuted = useMentorshipStore((state) => state.isMuted);
  const isCameraOff = useMentorshipStore((state) => state.isCameraOff);

  const currentSessionId = currentSession?.id ?? null;
  const currentUserId = user?.id ?? null;
  const currentUserRole = user?.role ?? null;

  const localVideoElementRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoElementRef = useRef<HTMLVideoElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const audioSenderRef = useRef<RTCRtpSender | null>(null);
  const videoSenderRef = useRef<RTCRtpSender | null>(null);
  const pendingIceCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const isCreatingOfferRef = useRef(false);
  const shouldRenegotiateRef = useRef(false);
  const isMutedRef = useRef(isMuted);
  const isCameraOffRef = useRef(isCameraOff);

  const [callStatus, setCallStatus] = useState<CallStatus>('Preparing camera...');
  const [hasLocalStream, setHasLocalStream] = useState(false);
  const [hasRemoteStream, setHasRemoteStream] = useState(false);

  useEffect(() => {
    isMutedRef.current = isMuted;
    isCameraOffRef.current = isCameraOff;
  }, [isCameraOff, isMuted]);

  const attachLocalStream = useCallback(() => {
    if (localVideoElementRef.current) {
      localVideoElementRef.current.srcObject = localStreamRef.current;
      playVideoElement(localVideoElementRef.current);
    }
  }, []);

  const attachRemoteStream = useCallback(() => {
    if (remoteVideoElementRef.current) {
      remoteVideoElementRef.current.srcObject = remoteStreamRef.current;
      playVideoElement(remoteVideoElementRef.current);
    }
  }, []);

  const setLocalVideoRef = useCallback((element: HTMLVideoElement | null) => {
    localVideoElementRef.current = element;

    if (element) {
      element.srcObject = localStreamRef.current;
      playVideoElement(element);
    }
  }, []);

  const setRemoteVideoRef = useCallback((element: HTMLVideoElement | null) => {
    remoteVideoElementRef.current = element;

    if (element) {
      element.srcObject = remoteStreamRef.current;
      playVideoElement(element);
    }
  }, []);

  const clearRemoteStream = useCallback(() => {
    remoteStreamRef.current = null;
    setHasRemoteStream(false);

    if (remoteVideoElementRef.current) {
      remoteVideoElementRef.current.srcObject = null;
    }
  }, []);

  const closePeerConnection = useCallback(
    (nextStatus: CallStatus = 'Waiting for other participant') => {
      const peerConnection = peerConnectionRef.current;

      if (peerConnection) {
        peerConnection.onicecandidate = null;
        peerConnection.ontrack = null;
        peerConnection.onconnectionstatechange = null;
        peerConnection.close();
      }

      peerConnectionRef.current = null;
      audioSenderRef.current = null;
      videoSenderRef.current = null;
      pendingIceCandidatesRef.current = [];
      isCreatingOfferRef.current = false;
      shouldRenegotiateRef.current = false;
      clearRemoteStream();
      setCallStatus(nextStatus);
    },
    [clearRemoteStream],
  );

  const stopLocalMedia = useCallback(() => {
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    setHasLocalStream(false);
    audioSenderRef.current = null;
    videoSenderRef.current = null;

    if (localVideoElementRef.current) {
      localVideoElementRef.current.srcObject = null;
    }
  }, []);

  const flushPendingIceCandidates = useCallback(async (peerConnection: RTCPeerConnection) => {
    const queuedCandidates = [...pendingIceCandidatesRef.current];
    pendingIceCandidatesRef.current = [];

    for (const candidate of queuedCandidates) {
      try {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (error) {
        console.error('Failed to apply queued ICE candidate:', error);
      }
    }
  }, []);

  const ensurePeerConnection = useCallback(() => {
    if (peerConnectionRef.current) {
      return peerConnectionRef.current;
    }

    const peerConnection = new RTCPeerConnection(getPeerConnectionConfig());
    const sessionId = currentSessionId;

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        const sender = peerConnection.addTrack(track, localStreamRef.current as MediaStream);

        if (track.kind === 'audio') {
          audioSenderRef.current = sender;
        }

        if (track.kind === 'video') {
          videoSenderRef.current = sender;
        }
      });
    }

    peerConnection.onicecandidate = (event) => {
      if (!event.candidate || !sessionId) {
        return;
      }

      emitWebRtcIceCandidate(sessionId, event.candidate.toJSON());
      console.log('ICE candidate sent', sessionId);
    };

    peerConnection.ontrack = (event) => {
      remoteStreamRef.current = buildRemoteStream(event, remoteStreamRef.current);
      attachRemoteStream();
      setHasRemoteStream(true);
      setCallStatus('Connected');
      console.log('Remote stream received', sessionId);
    };

    peerConnection.onconnectionstatechange = () => {
      switch (peerConnection.connectionState) {
        case 'connected':
          setCallStatus('Connected');
          setHasRemoteStream(true);
          console.log('Peer connected', sessionId);
          break;
        case 'connecting':
          setCallStatus('Connecting...');
          break;
        case 'disconnected':
          setCallStatus('Reconnecting...');
          setHasRemoteStream(false);
          break;
        case 'failed':
          closePeerConnection('Reconnecting...');
          if (sessionId) {
            emitWebRtcReady(sessionId);
          }
          break;
        case 'closed':
          setHasRemoteStream(false);
          break;
        default:
          break;
      }
    };

    peerConnectionRef.current = peerConnection;
    return peerConnection;
  }, [attachRemoteStream, closePeerConnection, currentSessionId]);

  const ensureLocalMedia = useCallback(
    async ({
      includeAudio = !isMutedRef.current,
      includeVideo = !isCameraOffRef.current,
    }: {
      includeAudio?: boolean;
      includeVideo?: boolean;
    } = {}) => {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Media devices are unavailable');
      }

      let stream = localStreamRef.current;

      if (!stream) {
        if (!includeAudio && !includeVideo) {
          stream = new MediaStream();
        } else {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: includeAudio,
            video: includeVideo,
          });
        }

        localStreamRef.current = stream;
      } else {
        const hasLiveAudioTrack = stream
          .getAudioTracks()
          .some((track) => track.readyState === 'live');
        const hasLiveVideoTrack = stream
          .getVideoTracks()
          .some((track) => track.readyState === 'live');

        if ((includeAudio && !hasLiveAudioTrack) || (includeVideo && !hasLiveVideoTrack)) {
          const extraStream = await navigator.mediaDevices.getUserMedia({
            audio: includeAudio && !hasLiveAudioTrack,
            video: includeVideo && !hasLiveVideoTrack,
          });

          stream = mergeStreams(stream, extraStream);
          localStreamRef.current = stream;
        }
      }

      setHasLocalStream(
        stream.getVideoTracks().some((track) => track.readyState === 'live'),
      );
      attachLocalStream();

      return stream;
    },
    [attachLocalStream],
  );

  const releaseMicrophoneTrack = useCallback(async () => {
    const stream = localStreamRef.current;

    if (!stream) {
      return;
    }

    const audioTrack = stream.getAudioTracks()[0];

    if (!audioTrack) {
      return;
    }

    audioTrack.enabled = false;

    if (audioSenderRef.current && audioSenderRef.current.track !== audioTrack) {
      await audioSenderRef.current.replaceTrack(audioTrack);
    }

    attachLocalStream();
  }, [attachLocalStream]);

  const releaseCameraTrack = useCallback(async () => {
    const stream = localStreamRef.current;

    if (!stream) {
      setHasLocalStream(false);
      return;
    }

    const videoTrack = stream.getVideoTracks()[0];

    if (!videoTrack) {
      setHasLocalStream(false);
      attachLocalStream();
      return;
    }

    videoTrack.enabled = false;

    if (videoSenderRef.current && videoSenderRef.current.track !== videoTrack) {
      await videoSenderRef.current.replaceTrack(videoTrack);
    }

    setHasLocalStream(false);
    attachLocalStream();
  }, [attachLocalStream]);

  const maybeCreateOffer = useCallback(async () => {
    if (!currentSessionId || currentUserRole !== 'mentor') {
      return;
    }

    const peerConnection = ensurePeerConnection();

    if (isCreatingOfferRef.current) {
      shouldRenegotiateRef.current = true;
      return;
    }

    if (peerConnection.signalingState !== 'stable') {
      shouldRenegotiateRef.current = true;
      console.warn(
        'Queueing WebRTC offer because signaling is not stable',
        peerConnection.signalingState,
      );
      return;
    }

    try {
      isCreatingOfferRef.current = true;
      shouldRenegotiateRef.current = false;
      setCallStatus('Connecting...');

      const offer = await peerConnection.createOffer();
      console.log('Offer created', currentSessionId);
      await peerConnection.setLocalDescription(offer);
      emitWebRtcOffer(currentSessionId, {
        type: offer.type,
        sdp: offer.sdp,
      });
      console.log('Offer sent', currentSessionId);
    } catch (error) {
      console.error('Failed to create WebRTC offer:', error);
      setCallStatus('Reconnecting...');
    } finally {
      isCreatingOfferRef.current = false;
    }
  }, [
    currentSessionId,
    currentUserRole,
    ensurePeerConnection,
  ]);

  const ensureMicrophoneTrack = useCallback(async () => {
    const stream = await ensureLocalMedia({
      includeAudio: true,
      includeVideo: !isCameraOffRef.current,
    });
    const liveAudioTrack = stream
      .getAudioTracks()
      .find((track) => track.readyState === 'live');

    if (!liveAudioTrack) {
      return;
    }

    liveAudioTrack.enabled = true;

    const peerConnection = peerConnectionRef.current;

    if (peerConnection) {
      if (audioSenderRef.current) {
        if (audioSenderRef.current.track !== liveAudioTrack) {
          await audioSenderRef.current.replaceTrack(liveAudioTrack);
        }
      } else {
        audioSenderRef.current = peerConnection.addTrack(liveAudioTrack, stream);

        if (currentSessionId) {
          if (currentUserRole === 'mentor') {
            void maybeCreateOffer();
          } else {
            emitWebRtcReady(currentSessionId);
          }
        }
      }
    }

    attachLocalStream();
  }, [
    attachLocalStream,
    currentSessionId,
    currentUserRole,
    ensureLocalMedia,
    maybeCreateOffer,
  ]);

  const ensureCameraTrack = useCallback(async () => {
    const stream = await ensureLocalMedia({
      includeAudio: !isMutedRef.current,
      includeVideo: true,
    });
    const liveVideoTrack = stream
      .getVideoTracks()
      .find((track) => track.readyState === 'live');

    if (!liveVideoTrack) {
      return;
    }

    liveVideoTrack.enabled = true;

    const peerConnection = peerConnectionRef.current;

    if (peerConnection) {
      if (videoSenderRef.current) {
        if (videoSenderRef.current.track !== liveVideoTrack) {
          await videoSenderRef.current.replaceTrack(liveVideoTrack);
        }
      } else {
        videoSenderRef.current = peerConnection.addTrack(liveVideoTrack, stream);

        if (currentSessionId) {
          if (currentUserRole === 'mentor') {
            void maybeCreateOffer();
          } else {
            emitWebRtcReady(currentSessionId);
          }
        }
      }
    }

    setHasLocalStream(true);
    attachLocalStream();
  }, [
    attachLocalStream,
    currentSessionId,
    currentUserRole,
    ensureLocalMedia,
    maybeCreateOffer,
  ]);

  useEffect(() => {
    if (!currentSessionId || !currentUserId) {
      closePeerConnection('Waiting for other participant');
      stopLocalMedia();
      return;
    }

    let isActive = true;
    const socket = connectCodeLinkSocket();

    if (!socket) {
      return;
    }

    const bootstrapRealtimeCall = async () => {
      try {
        setCallStatus('Preparing camera...');
        await ensureLocalMedia({
          includeAudio: !isMutedRef.current,
          includeVideo: !isCameraOffRef.current,
        });

        if (!isActive) {
          return;
        }

        const joinResponse = await joinRealtimeSession(currentSessionId);
        if (currentUserRole === 'mentor') {
          ensurePeerConnection();
        }
        emitWebRtcReady(currentSessionId);

        if (
          currentUserRole === 'mentor' &&
          (joinResponse.onlineUserIds?.length ?? 0) >= 2
        ) {
          setCallStatus('Connecting...');
          void maybeCreateOffer();
        } else {
          setCallStatus('Waiting for other participant');
        }
      } catch (error) {
        console.error('Failed to start realtime video:', error);
        setCallStatus('Camera/microphone unavailable');
      }
    };

    const handleSocketConnect = () => {
      closePeerConnection('Reconnecting...');
      void bootstrapRealtimeCall();
    };

    const handleWebRtcReady = (payload: {
      sessionId: string;
      readyUserId: string;
      readyUserRole: 'mentor' | 'student';
    }) => {
      if (payload.sessionId !== currentSessionId) {
        return;
      }

      if (
        currentUserRole === 'mentor' &&
        payload.readyUserId !== currentUserId
      ) {
        void maybeCreateOffer();
      } else if (payload.readyUserId !== currentUserId) {
        setCallStatus('Connecting...');
      }
    };

    const handleOffer = async (payload: {
      sessionId: string;
      offer: SignalSessionDescription;
    }) => {
      if (payload.sessionId !== currentSessionId) {
        return;
      }

      try {
        const offer = toSessionDescriptionInit(payload.offer);

        if (!offer) {
          return;
        }

        await ensureLocalMedia({
          includeAudio: !isMutedRef.current,
          includeVideo: !isCameraOffRef.current,
        });
        let peerConnection = ensurePeerConnection();

        if (
          peerConnection.signalingState !== 'stable' &&
          peerConnection.remoteDescription
        ) {
          closePeerConnection('Connecting...');
          await ensureLocalMedia({
            includeAudio: !isMutedRef.current,
            includeVideo: !isCameraOffRef.current,
          });
          peerConnection = ensurePeerConnection();
        }

        await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
        await flushPendingIceCandidates(peerConnection);

        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        console.log('Answer created', currentSessionId);
        emitWebRtcAnswer(currentSessionId, {
          type: answer.type,
          sdp: answer.sdp,
        });
      } catch (error) {
        console.error('Failed to handle WebRTC offer:', error);
        closePeerConnection('Reconnecting...');
      }
    };

    const handleAnswer = async (payload: {
      sessionId: string;
      answer: SignalSessionDescription;
    }) => {
      if (payload.sessionId !== currentSessionId || !peerConnectionRef.current) {
        return;
      }

      try {
        const answer = toSessionDescriptionInit(payload.answer);

        if (!answer) {
          return;
        }

        await peerConnectionRef.current.setRemoteDescription(
          new RTCSessionDescription(answer),
        );
        await flushPendingIceCandidates(peerConnectionRef.current);
        console.log('Answer received', currentSessionId);

        if (shouldRenegotiateRef.current) {
          void maybeCreateOffer();
        }
      } catch (error) {
        console.error('Failed to handle WebRTC answer:', error);
      }
    };

    const handleIceCandidate = async (payload: {
      sessionId: string;
      candidate: SignalIceCandidate;
    }) => {
      if (payload.sessionId !== currentSessionId || !payload.candidate) {
        return;
      }

      try {
        const candidate = toIceCandidateInit(payload.candidate);
        const peerConnection = ensurePeerConnection();

        if (peerConnection.remoteDescription) {
          await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        } else {
          pendingIceCandidatesRef.current.push(candidate);
        }

        console.log('ICE candidate exchanged', currentSessionId);
      } catch (error) {
        console.error('Failed to apply ICE candidate:', error);
      }
    };

    const handleUserLeft = (payload: { sessionId: string; userId: string }) => {
      if (payload.sessionId !== currentSessionId || payload.userId === currentUserId) {
        return;
      }

      closePeerConnection('Waiting for other participant');
    };

    const handleUserJoined = (payload: { sessionId: string; userId: string }) => {
      if (payload.sessionId !== currentSessionId || payload.userId === currentUserId) {
        return;
      }

      setCallStatus('Connecting...');
      emitWebRtcReady(currentSessionId);

      if (currentUserRole === 'mentor') {
        void maybeCreateOffer();
      }
    };

    socket.on('connect', handleSocketConnect);
    socket.on('webrtc-ready', handleWebRtcReady);
    socket.on('webrtc-offer', handleOffer);
    socket.on('webrtc-answer', handleAnswer);
    socket.on('webrtc-ice-candidate', handleIceCandidate);
    socket.on('user-joined', handleUserJoined);
    socket.on('user-left', handleUserLeft);

    if (socket.connected) {
      void handleSocketConnect();
    }

    return () => {
      isActive = false;
      socket.off('connect', handleSocketConnect);
      socket.off('webrtc-ready', handleWebRtcReady);
      socket.off('webrtc-offer', handleOffer);
      socket.off('webrtc-answer', handleAnswer);
      socket.off('webrtc-ice-candidate', handleIceCandidate);
      socket.off('user-joined', handleUserJoined);
      socket.off('user-left', handleUserLeft);
      closePeerConnection('Waiting for other participant');
      stopLocalMedia();
    };
  }, [
    closePeerConnection,
    currentSessionId,
    currentUserId,
    currentUserRole,
    ensureLocalMedia,
    ensurePeerConnection,
    flushPendingIceCandidates,
    maybeCreateOffer,
    stopLocalMedia,
  ]);

  useEffect(() => {
    const syncDeviceState = async () => {
      if (!currentSessionId || !localStreamRef.current) {
        return;
      }

      try {
        if (isMuted) {
          await releaseMicrophoneTrack();
        } else {
          await ensureMicrophoneTrack();
        }

        if (isCameraOff) {
          await releaseCameraTrack();
        } else {
          await ensureCameraTrack();
        }
      } catch (error) {
        console.error('Failed to sync media device state:', error);
      }
    };

    void syncDeviceState();
  }, [
    currentSessionId,
    ensureCameraTrack,
    ensureMicrophoneTrack,
    isCameraOff,
    isMuted,
    releaseMicrophoneTrack,
    releaseCameraTrack,
  ]);

  return {
    callStatus,
    hasLocalStream,
    hasRemoteStream,
    localVideoRef: setLocalVideoRef,
    remoteVideoRef: setRemoteVideoRef,
  };
}
