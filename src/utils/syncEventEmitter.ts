/**
 * Real-Time Sync Event Emitter for School Presensi
 * SMPN 4 Satu Atap Taliabu Barat
 * 
 * Provides pub/sub events for visual feedback during data synchronization
 * across LocalStorage and Cloud/Firebase.
 */

export type SyncEntity = 'student' | 'class' | 'record' | 'leave' | 'all';
export type SyncTarget = 'localStorage' | 'firebase';
export type SyncRowStatus = 'idle' | 'syncing' | 'synced' | 'error';

export interface SyncRowEvent {
  entity: SyncEntity;
  rowId?: string; // Target entity ID (e.g. student.id), or undefined if batch
  status: SyncRowStatus;
  target: SyncTarget;
  timestamp: number;
  message?: string;
}

export type SyncEventListener = (event: SyncRowEvent) => void;

class SyncEventEmitter {
  private listeners: Set<SyncEventListener> = new Set();

  /**
   * Subscribe to sync events. Returns an unsubscribe cleanup function.
   */
  public subscribe(listener: SyncEventListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Emit a sync event to all active subscribers
   */
  public emit(event: SyncRowEvent): void {
    this.listeners.forEach((listener) => {
      try {
        listener(event);
      } catch (err) {
        console.error('Error in sync event listener:', err);
      }
    });
  }

  /**
   * Convenience helper to trigger an animated sync cycle for a specific row or entity
   */
  public triggerRowSyncCycle(
    entity: SyncEntity,
    rowId: string,
    target: SyncTarget = 'localStorage',
    durationMs: number = 600
  ): void {
    this.emit({
      entity,
      rowId,
      status: 'syncing',
      target,
      timestamp: Date.now(),
      message: `Menyimpan ke ${target === 'firebase' ? 'Cloud Firebase' : 'Penyimpanan Lokal'}...`,
    });

    setTimeout(() => {
      this.emit({
        entity,
        rowId,
        status: 'synced',
        target,
        timestamp: Date.now(),
        message: `Tersinkron ke ${target === 'firebase' ? 'Cloud Firebase' : 'Penyimpanan Lokal'}`,
      });
    }, durationMs);
  }

  /**
   * Convenience helper to trigger a batch sync cycle across multiple row IDs
   */
  public triggerBatchSync(
    entity: SyncEntity,
    rowIds: string[],
    target: SyncTarget = 'localStorage',
    staggerMs: number = 50
  ): void {
    rowIds.forEach((id, index) => {
      setTimeout(() => {
        this.triggerRowSyncCycle(entity, id, target, 500);
      }, index * staggerMs);
    });
  }
}

export const syncEventEmitter = new SyncEventEmitter();
