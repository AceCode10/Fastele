import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { supabase } from './supabase';

const KEY = 'fastele.offline_queue';

type QueuedAction = {
  id: string;
  type: 'milestone_update';
  payload: {
    requestId: string;
    status: string;
    updates: Record<string, any>;
  };
  createdAt: string;
};

async function loadQueue(): Promise<QueuedAction[]> {
  const raw = await AsyncStorage.getItem(KEY);
  return raw ? JSON.parse(raw) : [];
}

async function saveQueue(q: QueuedAction[]) {
  await AsyncStorage.setItem(KEY, JSON.stringify(q));
}

export async function enqueueMilestoneUpdate(
  requestId: string,
  status: string,
  updates: Record<string, any>
) {
  const q = await loadQueue();
  q.push({
    id: `${requestId}-${status}-${Date.now()}`,
    type: 'milestone_update',
    payload: { requestId, status, updates },
    createdAt: new Date().toISOString(),
  });
  await saveQueue(q);
}

export async function flushQueue() {
  const q = await loadQueue();
  if (!q.length) return;

  const state = await NetInfo.fetch();
  if (!state.isConnected) return;

  const remaining: QueuedAction[] = [];
  for (const action of q) {
    try {
      if (action.type === 'milestone_update') {
        const { error } = await (supabase as any)
          .from('requests')
          .update(action.payload.updates)
          .eq('id', action.payload.requestId);
        if (error) remaining.push(action);
      }
    } catch {
      remaining.push(action);
    }
  }
  await saveQueue(remaining);
}

// Call once on app boot and on NetInfo reconnect.
export function startOfflineSync() {
  const unsub = NetInfo.addEventListener((state) => {
    if (state.isConnected) flushQueue();
  });
  return unsub;
}
