import { apiRequest } from './apiClient';

export interface CircleMember {
  id: string;
  displayName: string | null;
  email: string;
  completionsToday: number;
}

export interface CircleReaction {
  id: string;
  circleId: string;
  senderId: string;
  receiverId: string;
  emoji: string;
  createdAt: string;
}

export interface Circle {
  id: string;
  name: string;
  description?: string;
  inviteCode: string;
  createdById: string;
  members: CircleMember[];
  reactions: CircleReaction[];
}

export async function createCircle(name: string, description?: string): Promise<Circle> {
  return apiRequest<Circle>('/circles', {
    method: 'POST',
    body: JSON.stringify({ name, description }),
  });
}

export async function joinCircle(inviteCode: string): Promise<any> {
  return apiRequest('/circles/join', {
    method: 'POST',
    body: JSON.stringify({ inviteCode }),
  });
}

export async function getMyCircles(): Promise<Circle[]> {
  return apiRequest<Circle[]>('/circles');
}

export async function sendCircleReaction(
  circleId: string,
  receiverId: string,
  emoji: string,
): Promise<CircleReaction> {
  return apiRequest<CircleReaction>('/circles/react', {
    method: 'POST',
    body: JSON.stringify({ circleId, receiverId, emoji }),
  });
}
