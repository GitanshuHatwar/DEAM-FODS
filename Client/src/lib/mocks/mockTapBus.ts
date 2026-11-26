import type { TapPayload } from "@/types/tap";

type TapListener = (payload: TapPayload) => void;

class MockTapBus {
  private listeners = new Set<TapListener>();

  subscribe(listener: TapListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  emit(payload: TapPayload): void {
    this.listeners.forEach((listener) => {
      listener(payload);
    });
  }
}

export const mockTapBus = new MockTapBus();
