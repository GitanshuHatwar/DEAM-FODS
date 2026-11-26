import { useCallback, useEffect, useRef, useState } from "react";
import { fetchEventSource } from "@microsoft/fetch-event-source";
import { useQueryClient } from "@tanstack/react-query";
import { API_BASE_URL, api, getAccessToken } from "@/lib/api";
import { mockTapBus } from "@/lib/mocks/mockTapBus";
import { isMockMode } from "@/lib/supabase";
import type { SSEConnectionState, TapPayload } from "@/types/tap";

const STALE_TAP_THRESHOLD_MS = 30_000;

export function isFreshTap(payload: TapPayload, nowMs = Date.now()): boolean {
  const tapMs = new Date(payload.tapped_at).getTime();
  if (Number.isNaN(tapMs)) return false;
  return nowMs - tapMs <= STALE_TAP_THRESHOLD_MS;
}

export function useLiveTap(enabled: boolean) {
  const qc = useQueryClient();
  const [latestTap, setLatestTap] = useState<TapPayload | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [connectionStatus, setConnectionStatus] =
    useState<SSEConnectionState>(enabled ? "reconnecting" : "offline");
  const abortRef = useRef<AbortController | null>(null);

  const handleIncomingTap = useCallback(
    (payload: TapPayload, openDrawer = true) => {
      setLatestTap(payload);
      if (openDrawer) {
        setDrawerOpen(true);
      }
      void qc.invalidateQueries({ queryKey: ["tickets"] });
      if (payload.rfid_uid) {
        void qc.invalidateQueries({ queryKey: ["assets", payload.rfid_uid] });
        void qc.invalidateQueries({ queryKey: ["assets"] });
      }
    },
    [qc],
  );

  // Initial /rfid/latest hydration with 30s stale filter
  useEffect(() => {
    if (!enabled) {
      setLatestTap(null);
      setDrawerOpen(false);
      setConnectionStatus("offline");
      return;
    }

    let cancelled = false;
    api.rfid
      .latest()
      .then((payload) => {
        if (cancelled || !payload) return;
        if (isFreshTap(payload)) {
          handleIncomingTap(payload, true);
        }
      })
      .catch(() => {
        // Ignore initial latest fetch failure; SSE stream will hydrate
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, handleIncomingTap]);

  // SSE subscription (mock bus or live fetchEventSource)
  useEffect(() => {
    if (!enabled) return;

    if (isMockMode) {
      setConnectionStatus("connected");
      const unsub = mockTapBus.subscribe((payload) => {
        handleIncomingTap(payload, true);
      });
      return () => {
        unsub();
      };
    }

    const ctrl = new AbortController();
    abortRef.current = ctrl;
    let active = true;

    async function connectStream() {
      const token = await getAccessToken();
      if (!active || !token) {
        setConnectionStatus("offline");
        return;
      }

      setConnectionStatus("reconnecting");

      await fetchEventSource(`${API_BASE_URL}/rfid/stream`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "text/event-stream",
        },
        signal: ctrl.signal,
        openWhenHidden: true,
        async onopen(response) {
          if (response.ok) {
            setConnectionStatus("connected");
            return;
          }
          if (response.status === 401 || response.status === 403) {
            setConnectionStatus("offline");
            throw new Error(`SSE unauthorized (${response.status})`);
          }
          setConnectionStatus("reconnecting");
          throw new Error(`SSE HTTP ${response.status}`);
        },
        onmessage(event) {
          if (!event.data) return;
          try {
            const payload = JSON.parse(event.data) as TapPayload;
            handleIncomingTap(payload, true);
          } catch {
            // Ignore heartbeat / malformed frames
          }
        },
        onerror() {
          if (!active) return;
          setConnectionStatus("reconnecting");
        },
        onclose() {
          if (!active) return;
          setConnectionStatus("reconnecting");
        },
      });
    }

    connectStream().catch(() => {
      if (active) setConnectionStatus("offline");
    });

    return () => {
      active = false;
      ctrl.abort();
    };
  }, [enabled, handleIncomingTap]);

  const clearLatestTap = useCallback(() => {
    setLatestTap(null);
    setDrawerOpen(false);
  }, []);

  const pushSimulatedTap = useCallback(
    (payload: TapPayload) => {
      handleIncomingTap(payload, true);
    },
    [handleIncomingTap],
  );

  return {
    latestTap,
    drawerOpen,
    setDrawerOpen,
    connectionStatus,
    clearLatestTap,
    pushSimulatedTap,
  };
}
